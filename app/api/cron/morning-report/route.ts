import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { getProductionQueue } from '@/app/actions/production'
import { generateMorningReportPDF } from '@/lib/morning-report-pdf'
import { createServiceRoleSupabaseClient } from '@/lib/supabase/service-role'
import * as notificationService from '@/lib/notificationService'

function makeSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: () => undefined,
        set: (_name: string, _value: string, _options: CookieOptions) => {},
        remove: (_name: string, _options: CookieOptions) => {},
      },
    }
  )
}

export async function GET(request: Request) {
  // --- Auth check ---
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Service role when set (RLS + storage); otherwise anon — queue/WhatsApp rows may be empty without it.
    const supabase = createServiceRoleSupabaseClient() ?? makeSupabaseClient()
    const queueResult = await getProductionQueue({ supabase })
    if (!queueResult.success) {
      return NextResponse.json({ error: queueResult.error }, { status: 500 })
    }

    const pendingRows = queueResult.data.rows.filter((r) => r.remainingUntilDone > 0)

    // --- Fetch logo (best-effort) ---
    let logoDataUrl: string | undefined
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://sunkool-management.vercel.app').replace(/\/$/, '')
    if (appUrl) {
      try {
        const logoRes = await fetch(`${appUrl}/images/logo.png`)
        if (logoRes.ok) {
          const logoBuffer = await logoRes.arrayBuffer()
          const base64 = Buffer.from(logoBuffer).toString('base64')
          logoDataUrl = `data:image/png;base64,${base64}`
        }
      } catch {
        // Logo not critical — proceed without it
      }
    }

    // --- Generate PDF ---
    const { blob, filename } = generateMorningReportPDF(pendingRows, logoDataUrl)

    // --- Upload PDF to Supabase storage ---
    const pdfBuffer = await blob.arrayBuffer()
    const pdfPath = `reports/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('production-reports')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    let pdfUrl = ''
    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from('production-reports')
        .getPublicUrl(pdfPath)
      pdfUrl = urlData?.publicUrl ?? ''
    } else {
      console.error('[cron/morning-report] PDF upload failed:', uploadError.message)
    }

    // --- Fetch WhatsApp config ---
    const { data: configRow } = await supabase
      .from('whatsapp_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    const waConfig =
      configRow?.api_endpoint_url?.trim() &&
      configRow?.user_id?.trim() &&
      configRow?.password?.trim()
        ? {
            url: configRow.api_endpoint_url.trim(),
            username: configRow.user_id.trim(),
            password: configRow.password.trim(),
          }
        : null

    // --- Fetch morning report manager phones ---
    const { data: templateRow } = await supabase
      .from('notification_templates')
      .select('template_body')
      .eq('event_type', 'morning_report_config')
      .maybeSingle()

    let managerPhones: string[] = []
    let reportEnabled = false
    if (templateRow?.template_body) {
      try {
        const cfg = JSON.parse(templateRow.template_body) as {
          enabled?: boolean
          manager_phones?: string[]
        }
        reportEnabled = cfg.enabled === true
        managerPhones = Array.isArray(cfg.manager_phones) ? cfg.manager_phones : []
      } catch {
        // Malformed config — skip
      }
    }

    if (!reportEnabled) {
      return NextResponse.json({ success: true, sent: 0, message: 'Morning report is disabled' })
    }

    if (!waConfig || managerPhones.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'WhatsApp not configured or no manager phones set',
        sent: 0,
      })
    }

    // --- Build and send message ---
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    })

    const notStarted = pendingRows.filter(
      (r) => !r.hasInProductionRecord && !r.hasCompletedRecord
    ).length
    const totalRemaining = pendingRows.reduce((s, r) => s + r.remainingUntilDone, 0)

    // Count distinct pending orders
    const distinctOrders = new Set(pendingRows.map((r) => r.orderId)).size

    const message =
      `📊 *Morning Production Report — ${dateStr}*\n` +
      `\n` +
      `*Pending Orders:* ${distinctOrders}\n` +
      `*Total Units Remaining:* ${totalRemaining}\n` +
      `*Not Started:* ${notStarted}\n` +
      (pdfUrl ? `\n📄 Download Report: ${pdfUrl}\n` : '') +
      `\nPlease review and assign production tasks.`

    let sentCount = 0
    for (const phone of managerPhones) {
      if (!phone?.trim()) continue
      const result = await notificationService.sendMessage(waConfig, phone.trim(), message)
      if (result.ok) sentCount++
    }

    return NextResponse.json({ success: true, sent: sentCount, pdfUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
