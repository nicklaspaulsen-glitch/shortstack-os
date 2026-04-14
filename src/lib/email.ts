/**
 * Transactional email service.
 * Uses SendGrid for delivery. Falls back to Telegram notification if SendGrid is not configured.
 *
 * Usage:
 *   await sendEmail({ to: "user@example.com", subject: "Welcome!", html: "<p>Hi!</p>" });
 *   await sendWelcomeEmail("user@example.com", "John");
 *   await sendUsageWarningEmail("user@example.com", "Pro", 90);
 */

const SENDGRID_API = "https://api.sendgrid.com/v3/mail/send";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@shortstack.work";
const FROM_NAME = "ShortStack OS";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via SendGrid.
 * Returns true if sent, false if SendGrid is not configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.warn("[email] SendGrid not configured, skipping email to", payload.to);
    // Fallback: send via Telegram if configured
    await notifyTelegram(`Email not sent (no SendGrid):\nTo: ${payload.to}\nSubject: ${payload.subject}`);
    return false;
  }

  try {
    const res = await fetch(SENDGRID_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: payload.subject,
        content: [
          ...(payload.text ? [{ type: "text/plain", value: payload.text }] : []),
          { type: "text/html", value: payload.html },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[email] SendGrid error:", res.status, await res.text().catch(() => ""));
      return false;
    }

    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

// ── Pre-built templates ─────────────────────────────────────────

const baseStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 560px; margin: 0 auto; padding: 32px 24px;
  background: #0b0d12; color: #e0e0e0; border-radius: 12px;
`;
const goldBtn = `
  display: inline-block; padding: 10px 24px; background: #c8a855;
  color: #0b0d12; text-decoration: none; border-radius: 6px;
  font-weight: 600; font-size: 14px;
`;

export async function sendWelcomeEmail(email: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  return sendEmail({
    to: email,
    subject: "Welcome to ShortStack OS",
    html: `
      <div style="${baseStyle}">
        <h1 style="color:#fff;font-size:22px;margin-bottom:8px;">Welcome, ${name}!</h1>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
          Your agency command center is ready. Here's how to get started:
        </p>
        <ol style="color:#d0d0d0;font-size:13px;line-height:1.8;padding-left:20px;">
          <li>Complete your profile and choose a plan</li>
          <li>Add your first client</li>
          <li>Connect your social accounts</li>
          <li>Let AI agents start working for you</li>
        </ol>
        <div style="text-align:center;margin:24px 0;">
          <a href="${appUrl}/dashboard/getting-started" style="${goldBtn}">Get Started</a>
        </div>
        <p style="color:#666;font-size:11px;margin-top:32px;">
          Questions? Reply to this email or reach us at growth@shortstack.work
        </p>
      </div>
    `,
  });
}

export async function sendUsageWarningEmail(
  email: string,
  planTier: string,
  usagePercent: number
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  return sendEmail({
    to: email,
    subject: `Usage Alert: You've used ${usagePercent}% of your ${planTier} plan`,
    html: `
      <div style="${baseStyle}">
        <h1 style="color:#fff;font-size:20px;margin-bottom:8px;">Usage Alert</h1>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
          You've used <strong style="color:#ef4444;">${usagePercent}%</strong> of your
          <strong style="color:#c8a855;">${planTier}</strong> plan limits this billing cycle.
        </p>
        <p style="color:#a0a0a0;font-size:13px;line-height:1.6;">
          To avoid service interruptions, consider upgrading your plan.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${appUrl}/pricing" style="${goldBtn}">Upgrade Plan</a>
        </div>
      </div>
    `,
  });
}

export async function sendInvoiceEmail(
  email: string,
  clientName: string,
  amount: number,
  invoiceUrl?: string
) {
  return sendEmail({
    to: email,
    subject: `Invoice from ShortStack: $${amount.toFixed(2)}`,
    html: `
      <div style="${baseStyle}">
        <h1 style="color:#fff;font-size:20px;margin-bottom:8px;">Invoice</h1>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
          Hi ${clientName}, your invoice for <strong style="color:#10b981;">$${amount.toFixed(2)}</strong> is ready.
        </p>
        ${invoiceUrl ? `
          <div style="text-align:center;margin:24px 0;">
            <a href="${invoiceUrl}" style="${goldBtn}">View Invoice</a>
          </div>
        ` : ""}
      </div>
    `,
  });
}

export async function sendPaymentFailedEmail(email: string, clientName: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  return sendEmail({
    to: email,
    subject: "Payment Failed — Action Required",
    html: `
      <div style="${baseStyle}">
        <h1 style="color:#ef4444;font-size:20px;margin-bottom:8px;">Payment Failed</h1>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
          Hi ${clientName}, we were unable to process your latest payment.
          Please update your payment method to avoid service interruption.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${appUrl}/dashboard/settings" style="${goldBtn}">Update Payment</a>
        </div>
      </div>
    `,
  });
}

// ── Telegram fallback ───────────────────────────────────────────

async function notifyTelegram(text: string) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}
