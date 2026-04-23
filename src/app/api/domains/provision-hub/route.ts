import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * Domain-as-Hub orchestrator.
 *
 * Client POSTs { domain, enable_email, enable_phone, enable_website,
 *               enable_portal, enable_chat, area_code? } and gets back a
 * `{ jobId }` immediately. The 5 sub-tasks fire async via internal
 * fetches to `/api/domains/hub-setup/{service}` — we DON'T await them so
 * the response is snappy and the UI polls `/api/domains/hub-setup/job/[id]`
 * for progress.
 *
 * Why not await each? Vercel's function timeout (10s hobby / 60s pro) would
 * abort us on slow chains (Resend + GoDaddy PATCH + Twilio search all add up).
 * Fire-and-forget lets each sub-task own its own budget.
 */

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    domain?: string;
    enable_email?: boolean;
    enable_phone?: boolean;
    enable_website?: boolean;
    enable_portal?: boolean;
    enable_chat?: boolean;
    area_code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = body.domain?.trim().toLowerCase();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Valid domain required" }, { status: 400 });
  }

  // Default every toggle to true — the UI passes explicit booleans, but a
  // caller that omits any flag still gets the full bundle (that's the
  // product promise: "one click = everything").
  const flags = {
    enable_email: body.enable_email ?? true,
    enable_phone: body.enable_phone ?? true,
    enable_website: body.enable_website ?? true,
    enable_portal: body.enable_portal ?? true,
    enable_chat: body.enable_chat ?? true,
  };

  // Any disabled sub-task starts as 'skipped' so the UI doesn't show a
  // perpetual gray dot waiting for something that will never fire.
  const skipIfDisabled = (enabled: boolean) => enabled ? "pending" : "skipped";

  const svc = createServiceClient();
  const { data: job, error } = await svc
    .from("domain_setup_jobs")
    .insert({
      profile_id: ownerId,
      domain,
      ...flags,
      email_status: skipIfDisabled(flags.enable_email),
      phone_status: skipIfDisabled(flags.enable_phone),
      website_status: skipIfDisabled(flags.enable_website),
      portal_status: skipIfDisabled(flags.enable_portal),
      chat_status: skipIfDisabled(flags.enable_chat),
    })
    .select("id")
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: `Failed to create job: ${error?.message || "unknown"}` },
      { status: 500 },
    );
  }

  // Fire each enabled sub-task. We pass the Cookie header through so each
  // sub-route can re-auth as the same user; the service key path wouldn't
  // know which caller this is.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const cookie = request.headers.get("cookie") || "";

  const fire = (path: string, payload: Record<string, unknown>) => {
    // Intentionally not awaited — each sub-task writes back to the job row
    // on its own timeline. Errors are logged inside the sub-task.
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ job_id: job.id, domain, ...payload }),
      // Node fetch keeps the socket open; we don't care about the response.
    }).catch(err => {
      console.error(`[provision-hub] sub-task ${path} failed to fire:`, err);
    });
  };

  if (flags.enable_email) fire("/api/domains/hub-setup/email", {});
  if (flags.enable_phone) fire("/api/domains/hub-setup/phone", { area_code: body.area_code });
  if (flags.enable_website) fire("/api/domains/hub-setup/website", {});
  if (flags.enable_portal) fire("/api/domains/hub-setup/portal", {});
  if (flags.enable_chat) fire("/api/domains/hub-setup/chat", {});

  return NextResponse.json({ success: true, job_id: job.id });
}
