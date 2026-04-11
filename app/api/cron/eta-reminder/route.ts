import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/service-role'
import * as notificationService from '@/lib/notificationService'

const ETA_REMINDER_EVENT_TYPE = 'eta_reminder_config'
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'returned', 'rto_initiated']

const DEFAULT_TEMPLATE =
  `📦 *ETA Delivery Reminder — {{date}}*\n` +
  `\n` +
  `*{{count}} shipment(s) due today — please confirm delivery status:*\n` +
  `\n` +
  `{{shipment_list}}\n` +
  `\n` +
  `Please update each order's status in the system.`

function makeAnonClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    () => undefined,
        set:    (_name: string, _value: string, _options: CookieOptions) => {},
        remove: (_name: string, _options: CookieOptions) => {},
      },
    }
  )
}

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  if (process.env.VERCEL === '1' && !cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 })
  }
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (!auth || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = createServiceRoleSupabaseClient() ?? makeAnonClient()

    // ── Read ETA reminder config ───────────────────────────────────────────
    const { data: configRow } = await supabase
      .from('notification_templates')
      .select('template_body')
      .eq('event_type', ETA_REMINDER_EVENT_TYPE)
      .maybeSingle()

    let enabled  = false
    let phones:   string[] = []
    let template = DEFAULT_TEMPLATE

    if (configRow?.template_body) {
      try {
        const cfg = JSON.parse(configRow.template_body) as {
          enabled?:  boolean | string
          phones?:   string[]
          template?: string
        }
        enabled  = cfg.enabled === true || cfg.enabled === 'true'
        phones   = Array.isArray(cfg.phones) ? cfg.phones : []
        template = typeof cfg.template === 'string' && cfg.template.trim()
          ? cfg.template
          : DEFAULT_TEMPLATE
      } catch {
        // invalid JSON — treat as disabled
      }
    }

    if (!enabled) {
      return NextResponse.json({
        success: true,
        sent:    0,
        message: 'ETA reminder is disabled. Enable it from Dashboard → Notifications → ETA Delivery Reminder.',
      })
    }

    if (phones.length === 0) {
      return NextResponse.json({
        success: false,
        error:   'No phone numbers configured for ETA reminder.',
        sent:    0,
      })
    }

    // ── Deduplicate: skip if already sent for today ────────────────────────
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

    const { data: existingLog } = await supabase
      .from('tracking_reminder_log')
      .select('id')
      .eq('reminder_date', todayIST)
      .eq('status', 'sent')
      .maybeSingle()

    if (existingLog) {
      return NextResponse.json({
        success: true,
        sent:    0,
        message: `ETA reminder already sent for ${todayIST}. Skipping.`,
      })
    }

    // ── WhatsApp config ────────────────────────────────────────────────────
    const { data: waRow } = await supabase
      .from('whatsapp_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    const waConfig =
      waRow?.api_endpoint_url?.trim() &&
      waRow?.user_id?.trim() &&
      waRow?.password?.trim()
        ? {
            url:      waRow.api_endpoint_url.trim(),
            username: waRow.user_id.trim(),
            password: waRow.password.trim(),
          }
        : null

    if (!waConfig) {
      return NextResponse.json({
        success: false,
        error:   'WhatsApp not configured (missing endpoint, username, or password).',
        sent:    0,
      })
    }

    // ── Fetch shipments due today that aren't delivered ────────────────────
    const { data: rawShipments, error: fetchError } = await supabase
      .from('dispatches')
      .select(`
        id,
        tracking_id,
        shipment_status,
        orders (
          internal_order_number,
          sales_order_number,
          customers:customer_id ( name )
        ),
        courier_companies ( name )
      `)
      .lte('estimated_delivery', todayIST)
      .not('estimated_delivery', 'is', null)
      .neq('dispatch_type', 'return')
      .order('estimated_delivery', { ascending: true })
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const shipments = (rawShipments ?? []).filter(
      (s: any) => !TERMINAL_STATUSES.includes(s.shipment_status)
    )

    if (shipments.length === 0) {
      await supabase.from('tracking_reminder_log').insert({
        reminder_date:   todayIST,
        shipment_count:  0,
        sent_count:      0,
        phones_notified: phones,
        dispatch_ids:    [],
        status:          'skipped',
      })
      return NextResponse.json({
        success:       true,
        sent:          0,
        shipmentCount: 0,
        message:       'No undelivered shipments with ETA today.',
      })
    }

    // ── Build message ──────────────────────────────────────────────────────
    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    })

    const STATUS_LABELS: Record<string, string> = {
      pending:          'Pending',
      ready:            'Ready for Pickup',
      picked_up:        'Picked Up',
      in_transit:       'In Transit',
      out_for_delivery: 'Out for Delivery',
      failed_delivery:  'Failed Delivery',
      rto_initiated:    'RTO Initiated',
    }

    const shipmentList = shipments.map((s: any, i: number) => {
      const order       = Array.isArray(s.orders)            ? s.orders[0]            : s.orders
      const cust        = Array.isArray(order?.customers)    ? order.customers[0]     : order?.customers
      const courier     = Array.isArray(s.courier_companies) ? s.courier_companies[0] : s.courier_companies
      const orderNo     = order?.internal_order_number || order?.sales_order_number || '—'
      const statusLabel = STATUS_LABELS[s.shipment_status] ?? s.shipment_status ?? '—'
      const etaLabel    = s.estimated_delivery
        ? new Date(s.estimated_delivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' })
        : '—'
      const overdue = s.estimated_delivery && s.estimated_delivery < todayIST ? ' ⚠️' : ''
      return `${i + 1}. Order #${orderNo} | ${cust?.name ?? '—'} | ${courier?.name ?? '—'} | ${s.tracking_id ?? '—'} | *${statusLabel}* | ETA: ${etaLabel}${overdue}`
    }).join('\n')

    const message = template
      .replace(/\{\{date\}\}/g, dateStr)
      .replace(/\{\{count\}\}/g, String(shipments.length))
      .replace(/\{\{shipment_list\}\}/g, shipmentList)

    // ── Send ───────────────────────────────────────────────────────────────
    let sentCount = 0
    for (const phone of phones) {
      if (!phone?.trim()) continue
      const result = await notificationService.sendMessage(waConfig, phone.trim(), message)
      if (result.ok) sentCount++
    }

    // ── Log ────────────────────────────────────────────────────────────────
    await supabase.from('tracking_reminder_log').insert({
      reminder_date:   todayIST,
      shipment_count:  shipments.length,
      sent_count:      sentCount,
      phones_notified: phones,
      dispatch_ids:    shipments.map((s: any) => s.id),
      status:          sentCount > 0 ? 'sent' : 'failed',
    })

    return NextResponse.json({
      success:       true,
      sent:          sentCount,
      shipmentCount: shipments.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
