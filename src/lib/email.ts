/**
 * Transactional email service.
 * Uses Resend via SMTP (nodemailer). Falls back to Telegram if SMTP is not configured.
 *
 * Usage:
 *   await sendEmail({ to: "user@example.com", subject: "Welcome!", html: "<p>Hi!</p>" });
 *   await sendWelcomeEmail("user@example.com", "John");
 *   await sendUsageWarningEmail("user@example.com", "Pro", 90);
 */

import { BRAND } from "@/lib/brand-config";
import nodemailer from "nodemailer";

const FROM_EMAIL = process.env.SMTP_FROM || "growth@mail.shortstack.work";
// Sender display name pulls from brand-config so agencies that flip the
// white-label toggle send emails from their own brand rather than Trinity.
const FROM_NAME = BRAND.product_name;

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via Resend SMTP.
 * Returns true if sent, false if SMTP is not configured.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("[email] SMTP not configured, skipping email to", payload.to);
    await notifyTelegram(`Email not sent (no SMTP):\nTo: ${payload.to}\nSubject: ${payload.subject}`);
    return false;
  }

  try {
    const port = Number(process.env.SMTP_PORT) || 587;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transport.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

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

export async function sendWelcomeEmail(email: string, name: string, planTier?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";
  // Email clients render SVG inconsistently — keep PNG for email rendering.
  // The PNG will be regenerated from the new SVG in a follow-up asset pass.
  const logoUrl = `${appUrl}/icons/shortstack-logo.png`;

  const planBadge = planTier
    ? `<span style="display:inline-block;background:#c8a855;color:#0b0d12;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">${planTier} Plan</span>`
    : "";

  return sendEmail({
    to: email,
    subject: `Welcome to Trinity${planTier ? ` — ${planTier} Plan Activated` : ""}`,
    html: `
      <div style="${baseStyle}">
        <!-- Logo -->
        <div style="text-align:center;margin-bottom:24px;">
          <img src="${logoUrl}" alt="Trinity" width="60" height="60" style="border-radius:12px;" />
        </div>

        <h1 style="color:#fff;font-size:24px;margin-bottom:4px;text-align:center;">Welcome aboard, ${name}!</h1>
        ${planBadge ? `<div style="text-align:center;margin:12px 0 24px;">${planBadge}</div>` : ""}

        <p style="color:#a0a0a0;font-size:14px;line-height:1.7;">
          Your agency command center is live. Trinity gives you AI-powered lead generation,
          content creation, client management, and automated outreach — all in one place.
        </p>

        <!-- Quick Start Steps -->
        <div style="background:#111318;border-radius:8px;padding:20px;margin:20px 0;">
          <h2 style="color:#c8a855;font-size:14px;margin:0 0 12px;font-weight:600;">Quick Start Guide</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#888;font-size:13px;width:28px;vertical-align:top;">1.</td>
              <td style="padding:8px 0;color:#d0d0d0;font-size:13px;"><strong style="color:#fff;">Complete your profile</strong> — Set your agency name, timezone, and branding</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">2.</td>
              <td style="padding:8px 0;color:#d0d0d0;font-size:13px;"><strong style="color:#fff;">Add your first client</strong> — Import or create a client to start managing their account</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">3.</td>
              <td style="padding:8px 0;color:#d0d0d0;font-size:13px;"><strong style="color:#fff;">Connect integrations</strong> — Link Meta, TikTok, Google, and social accounts</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#888;font-size:13px;vertical-align:top;">4.</td>
              <td style="padding:8px 0;color:#d0d0d0;font-size:13px;"><strong style="color:#fff;">Launch AI agents</strong> — Set up AI calling, content generation, and lead scraping</td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${appUrl}/dashboard/getting-started" style="${goldBtn}">Open Your Dashboard</a>
        </div>

        <!-- Key Resources -->
        <div style="border-top:1px solid #1e2028;padding-top:20px;margin-top:24px;">
          <h3 style="color:#fff;font-size:13px;margin:0 0 12px;">Key Resources</h3>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;"><a href="${appUrl}/dashboard/getting-started" style="color:#c8a855;font-size:12px;text-decoration:none;">Getting Started Guide</a></td>
              <td style="padding:6px 0;"><a href="${appUrl}/dashboard/integrations" style="color:#c8a855;font-size:12px;text-decoration:none;">Connect Integrations</a></td>
            </tr>
            <tr>
              <td style="padding:6px 0;"><a href="${appUrl}/dashboard/settings" style="color:#c8a855;font-size:12px;text-decoration:none;">Account Settings</a></td>
              <td style="padding:6px 0;"><a href="${appUrl}/dashboard/eleven-agents" style="color:#c8a855;font-size:12px;text-decoration:none;">AI Agent Setup</a></td>
            </tr>
          </table>
        </div>

        <!-- License Info -->
        ${planTier ? `
        <div style="background:#111318;border:1px solid #1e2028;border-radius:8px;padding:16px;margin:20px 0;">
          <h3 style="color:#fff;font-size:13px;margin:0 0 8px;">Your License</h3>
          <p style="color:#a0a0a0;font-size:12px;line-height:1.6;margin:0;">
            Plan: <strong style="color:#c8a855;">${planTier}</strong><br/>
            Status: <span style="color:#10b981;">Active</span><br/>
            Billing: Monthly, auto-renews. Manage at <a href="${appUrl}/dashboard/settings" style="color:#c8a855;text-decoration:none;">Settings &rarr; Billing</a>
          </p>
        </div>
        ` : ""}

        <div style="border-top:1px solid #1e2028;padding-top:16px;margin-top:24px;text-align:center;">
          <p style="color:#666;font-size:11px;margin:0;">
            Need help? Email <a href="mailto:growth@shortstack.work" style="color:#888;">growth@shortstack.work</a>
            or message us on the dashboard.
          </p>
          <p style="color:#444;font-size:10px;margin-top:12px;">
            Trinity &mdash; Your Agency, Automated.
          </p>
        </div>
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
    subject: `Invoice from ${BRAND.company_name}: $${amount.toFixed(2)}`,
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
