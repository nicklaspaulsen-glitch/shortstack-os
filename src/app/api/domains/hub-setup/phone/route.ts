import { NextRequest, NextResponse } from "next/server";
import {
  loadJobAsCaller,
  setServiceStatus,
  setServiceDone,
  setServiceFailed,
} from "@/lib/domains/hub-job";

/**
 * Phone sub-task: pick a Twilio number matching the domain's area (either
 * an explicit area_code from the client or a sane US default if omitted)
 * and purchase it under the agency's Twilio account.
 *
 * No ElevenLabs agent here — this is the "Hub provisioning" pass, the
 * agency can attach an ElevenAgent later from the Caller page. Keeping
 * this fast + dependency-light means a Twilio outage doesn't block 4/5
 * other sub-tasks.
 */

export async function POST(request: NextRequest) {
  let body: { job_id?: string; domain?: string; area_code?: string; country?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { job_id: jobId, domain, area_code, country } = body;
  if (!jobId || !domain) {
    return NextResponse.json({ error: "job_id and domain required" }, { status: 400 });
  }

  const loaded = await loadJobAsCaller(jobId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  await setServiceStatus(jobId, "phone", "in_progress");

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    await setServiceFailed(
      jobId,
      "phone",
      "Twilio not configured — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN",
    );
    return NextResponse.json({ ok: false, error: "Twilio not configured" }, { status: 500 });
  }

  const countryCode = country || "US";
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    // 1. Look up available numbers. If area_code is empty, Twilio picks any
    //    local number in the country — better than failing with "no area".
    const searchParams = new URLSearchParams({
      SmsEnabled: "true",
      VoiceEnabled: "true",
      ...(area_code ? { AreaCode: area_code } : {}),
    });
    const searchRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${countryCode}/Local.json?${searchParams}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    const searchData = await searchRes.json();

    if (!searchRes.ok) {
      await setServiceFailed(
        jobId,
        "phone",
        `Twilio search failed: ${searchData.message || searchRes.status}`,
      );
      return NextResponse.json({ ok: false, error: searchData.message }, { status: 502 });
    }

    const candidates = searchData.available_phone_numbers || [];
    if (candidates.length === 0) {
      await setServiceFailed(
        jobId,
        "phone",
        `No Twilio numbers available${area_code ? ` in area ${area_code}` : ""}. Retry with a different area.`,
      );
      return NextResponse.json({ ok: false, error: "No numbers available" }, { status: 404 });
    }

    const chosen = candidates[0];

    // 2. Purchase it. Friendly name encodes the domain so ops can find the
    //    number later without spelunking through Trinity logs.
    const buyRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          PhoneNumber: chosen.phone_number,
          FriendlyName: `ShortStack Hub - ${domain}`,
        }),
      },
    );
    const buyData = await buyRes.json();

    if (!buyRes.ok) {
      await setServiceFailed(
        jobId,
        "phone",
        `Twilio purchase failed: ${buyData.message || buyRes.status}`,
      );
      return NextResponse.json({ ok: false, error: buyData.message }, { status: 502 });
    }

    await setServiceDone(jobId, "phone", {
      phone_number: buyData.phone_number,
      twilio_sid: buyData.sid,
      area_code: chosen.phone_number?.slice(2, 5) || area_code || null,
      locality: chosen.locality || null,
      region: chosen.region || null,
      monthly_cost_usd: 1.15,
    });

    return NextResponse.json({ ok: true, phone_number: buyData.phone_number });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setServiceFailed(jobId, "phone", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
