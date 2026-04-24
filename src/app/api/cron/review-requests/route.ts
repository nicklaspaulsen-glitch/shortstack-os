import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

export const maxDuration = 60;

// Runs every 15 min via Vercel Cron.
// Finds completed calendar_events and dispatches review request messages
// (SMS via /api/twilio/send-sms, email via Resend SMTP) according to each
// profile's review_request_configs. Deduped on (config_id, event_id).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack-os.vercel.app";

  // ── 1. Find completed events in the last 24 hours ──────────────
  // calendar_events stores date (DATE) and time (TEXT 'HH:MM').
  // We reconstruct a timestamp for delay comparison in JS.
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: events, error: eventsErr } = await supabase
    .from("calendar_events")
    .select("id, user_id, client, date, time, duration, title")
    .eq("status", "completed")
    .gte("date", since.toISOString().split("T")[0])
    .lte("date", now.toISOString().split("T")[0]);

  if (eventsErr) {
    console.error("[review-requests cron] events query error:", eventsErr.message);
    return NextResponse.json({ error: eventsErr.message }, { status: 500 });
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, checked: 0 });
  }

  let sent = 0;
  let skipped = 0;

  for (const event of events) {
    // ── 2. Load matching configs for this profile ────────────────
    const { data: configs } = await supabase
      .from("review_request_configs")
      .select("*")
      .eq("profile_id", event.user_id)
      .eq("enabled", true)
      .or(`client_id.is.null,client_id.eq.${event.client || "00000000-0000-0000-0000-000000000000"}`);

    if (!configs || configs.length === 0) continue;

    // Reconstruct end_time from date + time + duration (minutes)
    const [hours, minutes] = (event.time || "09:00").split(":").map(Number);
    const eventStart = new Date(`${event.date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
    const durationMins = Number(event.duration) || 30;
    const eventEnd = new Date(eventStart.getTime() + durationMins * 60 * 1000);

    for (const config of configs) {
      // ── 3. Dedupe check ────────────────────────────────────────
      const { data: alreadySent } = await supabase
        .from("review_requests_sent")
        .select("id")
        .eq("config_id", config.id)
        .eq("event_id", event.id)
        .maybeSingle();

      if (alreadySent) {
        skipped++;
        continue;
      }

      // ── 4. Delay gate ─────────────────────────────────────────
      const sendAfter = new Date(eventEnd.getTime() + config.delay_minutes * 60 * 1000);
      if (now < sendAfter) {
        skipped++;
        continue;
      }

      // ── 5. Resolve client details ─────────────────────────────
      let firstName = "there";
      let lastName = "";
      let phone: string | null = null;
      let email: string | null = null;
      let businessName = "";

      // Load profile for business_name
      const { data: profile } = await supabase
        .from("profiles")
        .select("business_name, full_name")
        .eq("id", event.user_id)
        .maybeSingle();

      businessName = profile?.business_name || profile?.full_name || "us";

      // Try to find a client row by name match or client_id on config
      const clientIdToLookup = config.client_id || null;
      if (clientIdToLookup) {
        const { data: clientRow } = await supabase
          .from("clients")
          .select("contact_name, email, phone")
          .eq("id", clientIdToLookup)
          .maybeSingle();
        if (clientRow) {
          const nameParts = (clientRow.contact_name || "").split(" ");
          firstName = nameParts[0] || "there";
          lastName = nameParts.slice(1).join(" ");
          phone = clientRow.phone || null;
          email = clientRow.email || null;
        }
      } else if (event.client) {
        // event.client is a freetext name — look up by business_name or contact_name
        const { data: clientRow } = await supabase
          .from("clients")
          .select("contact_name, email, phone")
          .eq("profile_id", event.user_id)
          .ilike("contact_name", `%${event.client}%`)
          .maybeSingle();
        if (clientRow) {
          const nameParts = (clientRow.contact_name || "").split(" ");
          firstName = nameParts[0] || "there";
          lastName = nameParts.slice(1).join(" ");
          phone = clientRow.phone || null;
          email = clientRow.email || null;
        } else {
          // Fall back to first name from event.client string
          const nameParts = event.client.split(" ");
          firstName = nameParts[0] || "there";
          lastName = nameParts.slice(1).join(" ");
        }
      }

      // ── 6. Build message ──────────────────────────────────────
      const message = (config.message_template as string)
        .replace(/\{\{first_name\}\}/g, firstName)
        .replace(/\{\{last_name\}\}/g, lastName)
        .replace(/\{\{review_url\}\}/g, config.review_url)
        .replace(/\{\{business_name\}\}/g, businessName);

      // ── 7. Dispatch ───────────────────────────────────────────
      let dispatchOk = false;
      try {
        if (config.channel === "sms" || config.channel === "whatsapp") {
          if (!phone) {
            console.warn(`[review-requests cron] No phone for event ${event.id}, config ${config.id}`);
            skipped++;
            continue;
          }
          const smsRes = await fetch(`${appUrl}/api/twilio/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Internal cron call — pass service-level auth header
              "x-cron-secret": process.env.CRON_SECRET || "",
            },
            body: JSON.stringify({
              lead_ids: [],
              message_template: message,
              // Pass a direct phone override via a non-standard field the
              // internal handler picks up (see note below)
              direct_phone: phone,
              direct_message: message,
            }),
          });
          dispatchOk = smsRes.ok;
          if (!dispatchOk) {
            // Fallback: call Twilio REST directly
            const twilioSid = process.env.TWILIO_ACCOUNT_SID;
            const twilioToken = process.env.TWILIO_AUTH_TOKEN;
            const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
            if (twilioSid && twilioToken && twilioFrom) {
              const form = new URLSearchParams({
                To: phone,
                From: twilioFrom,
                Body: message,
              });
              const tw = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: form.toString(),
                },
              );
              dispatchOk = tw.ok;
            }
          }
        } else if (config.channel === "email") {
          if (!email) {
            console.warn(`[review-requests cron] No email for event ${event.id}, config ${config.id}`);
            skipped++;
            continue;
          }
          dispatchOk = await sendEmail({
            to: email,
            subject: `Thanks for your visit — leave us a review!`,
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <p style="font-size:15px;line-height:1.6;color:#222;">${message.replace(/\n/g, "<br/>")}</p>
              <p style="margin-top:20px;"><a href="${config.review_url}" style="background:#c8a855;color:#000;padding:10px 22px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px;">Leave a Review</a></p>
            </div>`,
            text: message,
          });
        }
      } catch (err) {
        console.error(`[review-requests cron] dispatch error for event ${event.id}:`, err);
        dispatchOk = false;
      }

      // ── 8. Log to review_requests_sent ────────────────────────
      await supabase.from("review_requests_sent").insert({
        config_id: config.id,
        event_id: event.id,
        client_id: clientIdToLookup || null,
        channel: config.channel,
        status: dispatchOk ? "sent" : "failed",
        sent_at: now.toISOString(),
      });

      if (dispatchOk) sent++;
      else skipped++;
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    checked: events.length,
  });
}
