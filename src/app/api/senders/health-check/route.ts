import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

/**
 * GET — Run health checks across the user's email senders, phone numbers,
 * and social accounts. Returns per-item status so the dashboard can show
 * live green/amber/red indicators.
 *
 * Results are cached on each row so UI reads last-known status instantly.
 */

interface SenderStatus {
  id: string;
  type: "email" | "phone" | "social";
  label: string;
  status: "operational" | "degraded" | "down" | "unknown";
  last_check: string;
  last_error?: string;
  details?: Record<string, unknown>;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const results: SenderStatus[] = [];

  // ── Check email senders ───────────────────────────────────────────
  const { data: emails } = await supabase
    .from("email_senders")
    .select("id, email, smtp_host, smtp_port, smtp_user, smtp_password, bounce_rate, status")
    .eq("user_id", user.id);

  if (Array.isArray(emails)) {
    for (const sender of emails) {
      let status: SenderStatus["status"] = "unknown";
      let lastError: string | undefined;
      const s = sender as { id: string; email: string; smtp_host?: string; smtp_port?: number; smtp_user?: string; smtp_password?: string; bounce_rate?: number };

      if (s.smtp_host && s.smtp_user && s.smtp_password) {
        try {
          const transporter = nodemailer.createTransport({
            host: s.smtp_host,
            port: s.smtp_port || 587,
            secure: (s.smtp_port || 587) === 465,
            auth: { user: s.smtp_user, pass: s.smtp_password },
            connectionTimeout: 8000,
          });
          await transporter.verify();
          status = "operational";
          // Degrade if bounce rate is high
          if ((s.bounce_rate ?? 0) > 5) status = "degraded";
        } catch (err) {
          status = "down";
          lastError = err instanceof Error ? err.message.slice(0, 180) : "SMTP verify failed";
        }
      } else {
        status = "unknown";
        lastError = "No SMTP credentials";
      }

      results.push({
        id: s.id,
        type: "email",
        label: s.email,
        status,
        last_check: new Date().toISOString(),
        last_error: lastError,
        details: { bounce_rate: s.bounce_rate },
      });

      // Cache back to DB (safe-fail)
      try {
        await service.from("email_senders").update({
          status: status === "operational" ? "active" : status === "down" ? "error" : status,
          last_check: new Date().toISOString(),
          last_error: lastError || null,
        }).eq("id", s.id);
      } catch {}
    }
  }

  // ── Check phone senders ───────────────────────────────────────────
  const { data: phones } = await supabase
    .from("phone_senders")
    .select("id, phone_number, provider, twilio_sid, status")
    .eq("user_id", user.id);

  if (Array.isArray(phones)) {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;

    for (const phone of phones) {
      const p = phone as { id: string; phone_number: string; provider?: string; twilio_sid?: string };
      let status: SenderStatus["status"] = "unknown";
      let lastError: string | undefined;

      if ((p.provider || "twilio").toLowerCase() === "twilio" && twilioSid && twilioToken && p.twilio_sid) {
        try {
          const res = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers/${p.twilio_sid}.json`,
            {
              headers: {
                "Authorization": `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
              },
              signal: AbortSignal.timeout(8000),
            },
          );
          if (res.ok) {
            status = "operational";
          } else if (res.status === 404) {
            status = "down";
            lastError = "Number not found on Twilio";
          } else {
            status = "degraded";
            lastError = `Twilio returned ${res.status}`;
          }
        } catch (err) {
          status = "down";
          lastError = err instanceof Error ? err.message.slice(0, 180) : "Twilio check failed";
        }
      } else if (!twilioSid || !twilioToken) {
        status = "unknown";
        lastError = "Twilio credentials not configured";
      } else {
        status = "unknown";
        lastError = "No provider SID";
      }

      results.push({
        id: p.id,
        type: "phone",
        label: p.phone_number,
        status,
        last_check: new Date().toISOString(),
        last_error: lastError,
      });

      try {
        await service.from("phone_senders").update({
          status: status === "operational" ? "active" : status === "down" ? "error" : status,
          last_check: new Date().toISOString(),
          last_error: lastError || null,
        }).eq("id", p.id);
      } catch {}
    }
  }

  // ── Check social accounts (token expiry + last error) ─────────────
  const { data: socials } = await supabase
    .from("social_accounts")
    .select("id, platform, account_name, token_expires_at, status, metadata")
    .eq("user_id", user.id);

  if (Array.isArray(socials)) {
    for (const acc of socials) {
      const a = acc as { id: string; platform: string; account_name: string; token_expires_at?: string; status?: string; metadata?: Record<string, unknown> };
      let status: SenderStatus["status"] = "operational";
      let lastError: string | undefined;

      if (a.status === "expired" || a.status === "revoked" || a.status === "error") {
        status = "down";
        lastError = `Account is ${a.status}`;
      } else if (a.token_expires_at && new Date(a.token_expires_at) < new Date()) {
        status = "down";
        lastError = "Access token expired — please reconnect";
      } else if (a.token_expires_at && new Date(a.token_expires_at).getTime() - Date.now() < 7 * 86400000) {
        status = "degraded";
        lastError = "Token expires within 7 days — renew soon";
      }

      results.push({
        id: a.id,
        type: "social",
        label: `${a.account_name} (${a.platform})`,
        status,
        last_check: new Date().toISOString(),
        last_error: lastError,
      });
    }
  }

  // ── Overall summary ───────────────────────────────────────────────
  const counts = {
    operational: results.filter(r => r.status === "operational").length,
    degraded: results.filter(r => r.status === "degraded").length,
    down: results.filter(r => r.status === "down").length,
    unknown: results.filter(r => r.status === "unknown").length,
  };

  return NextResponse.json({
    success: true,
    checked_at: new Date().toISOString(),
    total: results.length,
    counts,
    results,
  });
}
