import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import type { ProRequestStatus } from "@/lib/pro-services";

/**
 * GET /api/pro-services/requests/[id]
 *
 * Detail for a single request — includes provider info, review (if any),
 * and the status timeline. RLS gates visibility (requester / provider /
 * admin).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: request, error } = await supabase
    .from("pro_services_requests")
    .select("*, pro_services_providers!inner(id, name, avatar_url, email, categories)")
    .eq("id", params.id)
    .single();

  if (error || !request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const { data: review } = await supabase
    .from("pro_services_reviews")
    .select("*")
    .eq("request_id", params.id)
    .maybeSingle();

  return NextResponse.json({ request, review: review ?? null });
}

/**
 * PATCH /api/pro-services/requests/[id]
 *
 * State transitions:
 *   - Provider sets: status ← quoted (+ quote_cents, quote_message) | declined
 *   - Requester sets: status ← accepted | cancelled | completed
 *
 * The API layer enforces transitions (e.g. can't mark completed before
 * accepted). RLS handles the "only involved parties can see this row" part.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Load the existing request + caller's profile to decide role
  const { data: existing } = await supabase
    .from("pro_services_requests")
    .select("*, pro_services_providers!inner(id, name, email)")
    .eq("id", params.id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const userEmail = (profile?.email ?? "").toLowerCase();
  const isRequester = existing.user_id === user.id;
  const providerEmail = (existing.pro_services_providers?.email ?? "").toLowerCase();
  const isProvider = providerEmail === userEmail;

  if (!isAdmin && !isRequester && !isProvider) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  const nextStatus = typeof body.status === "string" ? (body.status as ProRequestStatus) : null;

  if (nextStatus) {
    const allowedByProvider: ProRequestStatus[] = ["quoted", "declined"];
    const allowedByRequester: ProRequestStatus[] = ["accepted", "cancelled", "completed"];
    const allowed = isAdmin
      ? ["open", "quoted", "accepted", "declined", "completed", "cancelled"]
      : isProvider
        ? allowedByProvider
        : allowedByRequester;

    if (!allowed.includes(nextStatus)) {
      return NextResponse.json(
        { error: `Cannot set status='${nextStatus}' from current role` },
        { status: 400 },
      );
    }

    // Enforce reasonable transition graph
    const cur = existing.status as ProRequestStatus;
    const legalFrom: Record<ProRequestStatus, ProRequestStatus[]> = {
      open:      ["quoted", "declined", "cancelled"],
      quoted:    ["accepted", "declined", "cancelled"],
      accepted:  ["completed", "cancelled"],
      declined:  [],
      completed: [],
      cancelled: [],
    };
    if (!isAdmin && !legalFrom[cur].includes(nextStatus)) {
      return NextResponse.json(
        { error: `Cannot transition ${cur} → ${nextStatus}` },
        { status: 400 },
      );
    }

    patch.status = nextStatus;
    if (nextStatus === "accepted") patch.accepted_at = new Date().toISOString();
    if (nextStatus === "completed") patch.completed_at = new Date().toISOString();
  }

  // Quote fields — provider or admin only
  if ((isProvider || isAdmin) && typeof body.quote_cents === "number" && body.quote_cents >= 0) {
    patch.quote_cents = Math.floor(body.quote_cents);
  }
  if ((isProvider || isAdmin) && typeof body.quote_message === "string") {
    patch.quote_message = body.quote_message;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("pro_services_requests")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the other party on significant transitions (best-effort)
  if (nextStatus === "quoted") {
    const { data: requesterProfile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", existing.user_id)
      .single();
    if (requesterProfile?.email) {
      void sendEmail({
        to: requesterProfile.email,
        subject: `Quote received: ${existing.title}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0b0d12;color:#e0e0e0;border-radius:12px;">
            <h1 style="color:#c8a855;font-size:20px;">You have a new quote</h1>
            <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
              ${existing.pro_services_providers?.name} quoted
              <strong style="color:#fff;">$${((patch.quote_cents as number ?? 0) / 100).toLocaleString()}</strong>
              on "${existing.title}".
            </p>
            <div style="text-align:center;margin:20px 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack.work"}/dashboard/hire/requests"
                 style="display:inline-block;padding:10px 24px;background:#c8a855;color:#0b0d12;text-decoration:none;border-radius:6px;font-weight:600;">
                View quote
              </a>
            </div>
          </div>
        `,
      }).catch(() => {});
    }
  }

  if (nextStatus === "accepted" && existing.pro_services_providers?.email) {
    void sendEmail({
      to: existing.pro_services_providers.email,
      subject: `Quote accepted: ${existing.title}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0b0d12;color:#e0e0e0;border-radius:12px;">
          <h1 style="color:#10b981;font-size:20px;">Your quote was accepted</h1>
          <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">
            The requester accepted your quote on "${existing.title}". You can invoice them directly.
          </p>
          <div style="text-align:center;margin:20px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://shortstack.work"}/providers/dashboard"
               style="display:inline-block;padding:10px 24px;background:#c8a855;color:#0b0d12;text-decoration:none;border-radius:6px;font-weight:600;">
              Open dashboard
            </a>
          </div>
        </div>
      `,
    }).catch(() => {});
  }

  return NextResponse.json({ request: updated });
}
