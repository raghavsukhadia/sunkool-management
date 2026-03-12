/**
 * Central notification service for MessageAutoSender (WhatsApp).
 * Uses application/x-www-form-urlencoded with username, password, receiverMobileNo, message.
 * Config and recipients are passed in (from DB or env) so this module stays stateless.
 */

export type MessageAutoSenderConfig = {
  url: string
  username: string
  password: string
}

export type SendMessageResult = {
  ok: boolean
  status?: number
  data?: { status?: number; message?: string; result?: { id?: unknown } }
  error?: string
}

/** Normalize phone for API: digits only, then + prefix if had country code */
function toReceiverMobileNo(raw: string): string {
  const s = (raw || "").trim()
  const digits = s.replace(/\D/g, "")
  if (!digits) return s
  return s.startsWith("+") ? `+${digits}` : digits
}

/**
 * Send a single message via MessageAutoSender API.
 * Content-Type: application/x-www-form-urlencoded.
 */
export async function sendMessage(
  config: MessageAutoSenderConfig,
  receiverMobileNo: string,
  message: string
): Promise<SendMessageResult> {
  const normalizedReceiver = toReceiverMobileNo(receiverMobileNo)
  // Normalize line endings to \n, collapse multiple newlines/spaces; preserve single newlines for formatting
  const normalizedMessage = message
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  const body = new URLSearchParams({
    username: config.username,
    password: config.password,
    receiverMobileNo: normalizedReceiver,
    message: normalizedMessage,
  })

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    const text = await res.text()
    let data: SendMessageResult["data"]
    try {
      data = JSON.parse(text) as SendMessageResult["data"]
    } catch {
      data = undefined
    }

    if (!res.ok) {
      console.error("[notificationService] sendMessage failed", res.status, "receiverMobileNo:", normalizedReceiver, "response:", text)
      return { ok: false, status: res.status, data, error: text }
    }

    if (data?.status === 200) {
      console.info("[notificationService] sent to", normalizedReceiver, "messageId=", data?.result?.id)
    }
    return { ok: true, status: res.status, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[notificationService] sendMessage fetch error for", normalizedReceiver, err)
    return { ok: false, error: msg }
  }
}

/**
 * Send the same message to multiple recipients.
 */
export async function sendMessageToRecipients(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  message: string
): Promise<SendMessageResult[]> {
  const results: SendMessageResult[] = []
  for (const phone of recipientPhones) {
    if (!phone?.trim()) continue
    const result = await sendMessage(config, phone, message)
    results.push(result)
  }
  return results
}

// --- Order event helpers (message templates) ---

export async function sendOrderCreated(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: { orderNumber: string; customerName: string; salesOrderNumber?: string }
): Promise<SendMessageResult[]> {
  const message =
    `New Order Added to Production Queue. ` +
    `Order Number: ${payload.orderNumber}. ` +
    `Customer Name: ${payload.customerName}. ` +
    (payload.salesOrderNumber ? `Sales Order: ${payload.salesOrderNumber}. ` : "") +
    `Please review and begin production.`
  return sendMessageToRecipients(config, recipientPhones, message)
}

export type ProductionRecordCreatedPayload = {
  orderNumber: string
  customerName: string
  items: { name: string; quantity: number }[]
  orderSystemBaseUrl: string
  orderId: string
}

export async function sendProductionRecordCreated(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: ProductionRecordCreatedPayload
): Promise<SendMessageResult[]> {
  const orderUrl = `${payload.orderSystemBaseUrl.replace(/\/$/, "")}/dashboard/orders/${payload.orderId}`
  const itemLines = payload.items
    .map((item, i) => `${i + 1}. ${item.name} – Ordered: ${item.quantity}`)
    .join("\n")
  const message =
    `🚨 *New Order Added to Production Queue*\n\n` +
    `*Order Number:* ${payload.orderNumber}\n` +
    `*Customer Name:* ${payload.customerName}\n\n` +
    `*Item Details:*\n\n` +
    (itemLines || "No items") +
    `\n\nOpen Order System:\n${orderUrl}\n\n` +
    `Please open the order in the system, review specifications, and begin production.`
  return sendMessageToRecipients(config, recipientPhones, message)
}

export async function sendProductionStarted(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: { orderNumber: string }
): Promise<SendMessageResult[]> {
  const message =
    `Production Started. Order Number: ${payload.orderNumber}. ` +
    `The work has begun in the production unit.`
  return sendMessageToRecipients(config, recipientPhones, message)
}

export async function sendOrderCompleted(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: { orderNumber: string }
): Promise<SendMessageResult[]> {
  const message =
    `Production Completed. Order Number: ${payload.orderNumber}. ` +
    `The order is ready for delivery.`
  return sendMessageToRecipients(config, recipientPhones, message)
}

export async function sendDeliveryReady(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: { orderNumber: string }
): Promise<SendMessageResult[]> {
  const message =
    `Order ${payload.orderNumber} is ready for delivery. ` +
    `Please arrange dispatch.`
  return sendMessageToRecipients(config, recipientPhones, message)
}

export async function sendDelivered(
  config: MessageAutoSenderConfig,
  recipientPhones: string[],
  payload: { orderNumber: string }
): Promise<SendMessageResult[]> {
  const message =
    `Order ${payload.orderNumber} has been delivered.`
  return sendMessageToRecipients(config, recipientPhones, message)
}
