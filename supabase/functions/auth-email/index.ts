/**
 * auth-email — Supabase send_email Auth Hook
 *
 * Intercepts every Supabase auth email (signup confirm, magic link,
 * password reset, team invite, email change) and replaces the default
 * boring Supabase template with branded ShortStack HTML.
 *
 * Wiring (one-time, in Supabase Dashboard):
 *   Authentication → Hooks → Send Email → Enable
 *   URL: https://<project-ref>.supabase.co/functions/v1/auth-email
 *   Secret: set AUTH_EMAIL_HOOK_SECRET in project secrets (any random string)
 *
 * Required secrets (set in Supabase project → Settings → Edge Function Secrets):
 *   RESEND_API_KEY   — your Resend key (starts with re_)
 *   SMTP_FROM        — from address  e.g. "ShortStack <noreply@mail.shortstack.work>"
 *   AUTH_EMAIL_HOOK_SECRET — the secret you set in the hook config above
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ── Brand tokens (kept inline — no shared lib in edge functions) ──────────
const BRAND = {
  lime: "#D4FF00",
  black: "#0A0A0B",
  white: "#FFFFFF",
  pageBg: "#F9FAFB",
  cardBg: "#FFFFFF",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#6B7280",
  borderLight: "#E5E7EB",
};

const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const SITE_NAME = "ShortStack";
const SITE_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.shortstack.work";
const FROM = Deno.env.get("SMTP_FROM") || `${SITE_NAME} <noreply@mail.shortstack.work>`;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("SMTP_PASS") || "";
const HOOK_SECRET = Deno.env.get("AUTH_EMAIL_HOOK_SECRET") || "";

// ── HTML shell (light-mode — email clients don't reliably support dark mode) ──
function shell(body: string, previewText: string, subject: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};-webkit-font-smoothing:antialiased;">
  <!-- inbox preview text -->
  <span style="display:none;font-size:1px;color:${BRAND.pageBg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escHtml(previewText)}</span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
          style="max-width:560px;width:100%;background:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.04),0 8px 24px rgba(15,23,42,0.07);">

          <!-- Logo bar -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <!-- Stack mark: three lime rectangles -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="width:28px;height:6px;background:${BRAND.lime};border-radius:3px;display:block;"></td>
                </tr>
                <tr><td style="height:3px;"></td></tr>
                <tr>
                  <td style="width:20px;height:6px;background:${BRAND.lime};border-radius:3px;display:block;margin-left:4px;"></td>
                </tr>
                <tr><td style="height:3px;"></td></tr>
                <tr>
                  <td style="width:12px;height:6px;background:${BRAND.lime};border-radius:3px;display:block;margin-left:8px;"></td>
                </tr>
              </table>
              <p style="font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.textMuted};margin:10px 0 0;">${SITE_NAME}</p>
            </td>
          </tr>

          <!-- Body -->
          ${body}

          <!-- Footer -->
          <tr>
            <td style="padding:0 40px 32px;border-top:1px solid ${BRAND.borderLight};">
              <p style="font-family:${FONT};font-size:12px;line-height:1.6;color:${BRAND.textMuted};margin:24px 0 0;text-align:center;">
                ${SITE_NAME} &middot; <a href="${SITE_URL}" style="color:${BRAND.textMuted};">${SITE_URL.replace("https://", "")}</a>
              </p>
              <p style="font-family:${FONT};font-size:11px;color:${BRAND.textMuted};margin:8px 0 0;text-align:center;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- / Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `
  <tr>
    <td style="padding:24px 40px 32px;text-align:center;">
      <a href="${escHtml(url)}"
        style="display:inline-block;background:${BRAND.lime};color:${BRAND.black};padding:14px 36px;border-radius:10px;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-0.01em;">
        ${escHtml(label)}
      </a>
      <p style="font-family:${FONT};font-size:12px;color:${BRAND.textMuted};margin:16px 0 0;">
        Or copy this link: <a href="${escHtml(url)}" style="color:${BRAND.textMuted};word-break:break-all;">${escHtml(url)}</a>
      </p>
    </td>
  </tr>`;
}

function heading(text: string): string {
  return `<h1 style="font-family:${FONT};font-size:26px;font-weight:700;line-height:1.3;color:${BRAND.textPrimary};margin:0 0 12px;">${escHtml(text)}</h1>`;
}

function para(text: string): string {
  return `<p style="font-family:${FONT};font-size:16px;line-height:1.65;color:${BRAND.textSecondary};margin:0 0 8px;">${text}</p>`;
}

// ── Templates per action type ─────────────────────────────────────────────

type AuthEmailPayload = {
  user: { id: string; email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    new_email?: string;
    otp?: string;
  };
};

function buildEmail(payload: AuthEmailPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const { email_action_type, token_hash, redirect_to, otp, new_email } = payload.email_data;
  const email = payload.user.email;
  const baseUrl = redirect_to || SITE_URL;

  switch (email_action_type) {
    case "signup":
    case "email_confirmation":
    case "confirm": {
      const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=signup&next=${encodeURIComponent(redirect_to || "/dashboard")}`;
      const subject = `Confirm your ${SITE_NAME} account`;
      const preview = "One click and you're in.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Confirm your email.")}
          ${para(`You signed up for ${SITE_NAME} with <strong>${escHtml(email)}</strong>. Hit the button below to confirm your address and activate your account.`)}
        </td></tr>
        ${ctaButton("Confirm my email", confirmUrl)}`;
      const text = `Confirm your ${SITE_NAME} account\n\nClick the link below to confirm your email (${email}):\n\n${confirmUrl}\n\nLink expires in 24 hours. Didn't sign up? Ignore this email.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    case "recovery":
    case "password_reset": {
      const resetUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=recovery&next=${encodeURIComponent("/update-password")}`;
      const subject = `Reset your ${SITE_NAME} password`;
      const preview = "Set a new password in one click.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Reset your password.")}
          ${para(`We received a request to reset the password for <strong>${escHtml(email)}</strong>. Click below to set a new one. Link expires in 1 hour.`)}
        </td></tr>
        ${ctaButton("Reset my password", resetUrl)}`;
      const text = `Reset your ${SITE_NAME} password\n\nClick to reset your password:\n\n${resetUrl}\n\nLink expires in 1 hour. Didn't request this? Ignore this email — your password stays the same.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    case "magic_link":
    case "magiclink": {
      const magicUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=magiclink&next=${encodeURIComponent(redirect_to || "/dashboard")}`;
      const subject = `Sign in to ${SITE_NAME}`;
      const preview = "Your one-time sign-in link.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Sign in to ${SITE_NAME}.")}
          ${para(`Use the button below to sign in as <strong>${escHtml(email)}</strong>. This link is single-use and expires in 1 hour.`)}
        </td></tr>
        ${ctaButton("Sign in", magicUrl)}`;
      const text = `Sign in to ${SITE_NAME}\n\nClick to sign in (${email}):\n\n${magicUrl}\n\nSingle-use, expires in 1 hour. Didn't request this? Ignore this email.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    case "invite": {
      const inviteUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=invite&next=${encodeURIComponent(redirect_to || "/dashboard")}`;
      const subject = `You've been invited to ${SITE_NAME}`;
      const preview = "Accept your invite — one click and you're in.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("You're invited.")}
          ${para(`Someone added <strong>${escHtml(email)}</strong> to ${SITE_NAME}. Click below to accept and set up your account. Link expires in 7 days.`)}
        </td></tr>
        ${ctaButton("Accept invite", inviteUrl)}`;
      const text = `You've been invited to ${SITE_NAME}\n\nAccept your invite:\n\n${inviteUrl}\n\nLink expires in 7 days. Weren't expecting this? Ignore this email.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    case "email_change":
    case "email_change_current":
    case "email_change_new": {
      const changeUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=email_change&next=${encodeURIComponent("/dashboard/settings")}`;
      const isNew = email_action_type === "email_change_new";
      const subject = `Confirm your email change on ${SITE_NAME}`;
      const preview = "Confirm your new email address.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Confirm your email change.")}
          ${para(isNew
            ? `Confirm <strong>${escHtml(new_email || email)}</strong> as your new ${SITE_NAME} email address.`
            : `We received a request to change the email on your ${SITE_NAME} account. Click below to confirm.`
          )}
        </td></tr>
        ${ctaButton("Confirm email change", changeUrl)}`;
      const text = `Confirm your email change on ${SITE_NAME}\n\nClick to confirm:\n\n${changeUrl}\n\nDidn't request this? Ignore this email.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    case "reauthentication": {
      const code = otp || "";
      const subject = `Your ${SITE_NAME} verification code`;
      const preview = "Your one-time code is below.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Verify it's you.")}
          ${para(`Use this code to complete your ${SITE_NAME} verification. It expires in 10 minutes.`)}
          <div style="text-align:center;padding:24px 0 32px;">
            <span style="font-family:monospace;font-size:36px;font-weight:800;letter-spacing:0.2em;color:${BRAND.textPrimary};background:${BRAND.pageBg};padding:16px 24px;border-radius:12px;display:inline-block;">${escHtml(code)}</span>
          </div>
        </td></tr>`;
      const text = `Your ${SITE_NAME} verification code: ${code}\n\nExpires in 10 minutes.`;
      return { subject, html: shell(body, preview, subject), text };
    }

    default: {
      // Fallback — should never reach here but handle gracefully
      const fallbackUrl = baseUrl;
      const subject = `${SITE_NAME} — action required`;
      const preview = "A link for your account.";
      const body = `
        <tr><td style="padding:28px 40px 0;">
          ${heading("Action required.")}
          ${para(`Click the button below to continue with your ${SITE_NAME} account.`)}
        </td></tr>
        ${ctaButton("Continue", fallbackUrl)}`;
      const text = `${SITE_NAME} — action required\n\n${fallbackUrl}`;
      return { subject, html: shell(body, preview, subject), text };
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Verify the Supabase Auth Hook HMAC-SHA256 signature. */
async function verifyHookSignature(req: Request, body: string): Promise<boolean> {
  if (!HOOK_SECRET) return true; // no secret configured — skip (dev/test only)
  const sig = req.headers.get("x-supabase-signature") || "";
  const expected = createHmac("sha256", HOOK_SECRET).update(body).digest("hex");
  const expectedBuf = Buffer.from(`v1,${expected}`, "utf8");
  const actualBuf = Buffer.from(sig, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/** Send the email via Resend. */
async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  if (!RESEND_KEY) {
    console.error("[auth-email] No RESEND_API_KEY / SMTP_PASS set — email not sent to", args.to);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-signature",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Verify signature
  const valid = await verifyHookSignature(req, rawBody);
  if (!valid) {
    console.error("[auth-email] Invalid hook signature");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: AuthEmailPayload;
  try {
    payload = JSON.parse(rawBody) as AuthEmailPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const recipientEmail = payload.user?.email;
  const actionType = payload.email_data?.email_action_type;

  if (!recipientEmail || !actionType) {
    console.error("[auth-email] Missing required fields in payload");
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    const { subject, html, text } = buildEmail(payload);
    await sendViaResend({ to: recipientEmail, subject, html, text });
    console.log(`[auth-email] Sent ${actionType} to ${recipientEmail}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[auth-email] Failed to send ${actionType} to ${recipientEmail}:`, msg);
    // Return 200 so Supabase doesn't retry indefinitely — it already has fallback behavior
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
