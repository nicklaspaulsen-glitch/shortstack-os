import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { isValidCategory } from "@/lib/pro-services";

/**
 * GET /api/pro-services/requests
 *
 * Returns requests visible to the caller (RLS handles visibility: requester,
 * provider by email match, or admin). Supports filter by role/status.
 *
 *   ?as=requester   — (default) requests where user_id = me
 *   ?as=provider    — requests where provider.email = my email
 *   ?status=open    — filter by status
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const as = searchParams.get("as") ?? "requester";
  const statusFilter = searchParams.get("status");

  let query = supabase
    .from("pro_services_requests")
    .select(
      "*, pro_services_providers!inner(id, name, avatar_url, categories)",
    )
    .order("created_at", { ascending: false });

  if (as === "provider") {
    // Fetch provider rows matching the signed-in email first
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();
    const { data: providerRows } = await supabase
      .from("pro_services_providers")
      .select("id")
      .eq("email", (profile?.email ?? "").toLowerCase());
    const providerIds = (providerRows ?? []).map((p) => p.id);
    if (providerIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }
    query = query.in("provider_id", providerIds);
  } else {
    query = query.eq("user_id", user.id);
  }

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

/**
 * POST /api/pro-services/requests
 *
 * Create a quote request from the signed-in user to a provider. Notifies
 * provider via email (Telegram falls back if SMTP not configured — handled
 * inside sendEmail).
 *
 * Body: { provider_id, category, title, description, budget_cents?,
 *         deadline?, attachments? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const provider_id = typeof body.provider_id === "string" ? body.provider_id : "";
  const category = typeof body.category === "string" ? body.category : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const budget_cents = typeof body.budget_cents === "number" && body.budget_cents >= 0
    ? Math.floor(body.budget_cents) : null;
  const deadline = typeof body.deadline === "string" && body.deadline ? body.deadline : null;
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!provider_id) return NextResponse.json({ error: "provider_id required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!description) return NextResponse.json({ error: "description required" }, { status: 400 });
  if (!isValidCategory(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  // Fetch provider (must be vetted — non-vetted rows are only visible to
  // providers/admins via RLS, but we double-check here to avoid leaking)
  const { data: provider, error: provErr } = await supabase
    .from("pro_services_providers")
    .select("id, email, name, vetted")
    .eq("id", provider_id)
    .single();
  if (provErr || !provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }
  if (!provider.vetted) {
    return NextResponse.json({ error: "Provider not available" }, { status: 403 });
  }

  const { data: newRequest, error } = await supabase
    .from("pro_services_requests")
    .insert({
      user_id: user.id,
      provider_id,
      category,
      title,
      description,
      budget_cents,
      deadline,
      attachments,
      status: "open",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fire-and-forget notify the provider. We don't block the request on
  // delivery because sendEmail already falls back to Telegram.
  void notifyProvider({
    providerEmail: provider.email,
    providerName: provider.name,
    requesterEmail: user.email ?? "unknown",
    title,
    description,
    category,
    budget_cents,
    deadline,
    requestId: newRequest.id,
  }).catch((e) => console.warn("[pro-services] notify failed:", e));

  return NextResponse.json({ request: newRequest });
}

async function notifyProvider(args: {
  providerEmail: string;
  providerName: string;
  requesterEmail: string;
  title: string;
  description: string;
  category: string;
  budget_cents: number | null;
  deadline: string | null;
  requestId: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://shortstack.work";
  const budgetLine = args.budget_cents
    ? `<p style="color:#a0a0a0;"><strong style="color:#fff;">Budget:</strong> $${(args.budget_cents / 100).toLocaleString()}</p>`
    : "";
  const deadlineLine = args.deadline
    ? `<p style="color:#a0a0a0;"><strong style="color:#fff;">Deadline:</strong> ${args.deadline}</p>`
    : "";

  await sendEmail({
    to: args.providerEmail,
    subject: `New ShortStack quote request: ${args.title}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0b0d12;color:#e0e0e0;border-radius:12px;">
        <h1 style="color:#c8a855;font-size:20px;margin-bottom:4px;">New quote request</h1>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">Hi ${args.providerName},</p>
        <p style="color:#a0a0a0;font-size:14px;line-height:1.6;">A ShortStack user has requested a quote from you.</p>

        <div style="background:#111318;border:1px solid #1e2028;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#fff;font-size:15px;font-weight:600;margin:0 0 8px;">${escapeHtml(args.title)}</p>
          <p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">${args.category}</p>
          <p style="color:#d0d0d0;font-size:13px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(args.description)}</p>
          ${budgetLine}
          ${deadlineLine}
          <p style="color:#666;font-size:12px;margin-top:12px;">Requester: ${escapeHtml(args.requesterEmail)}</p>
        </div>

        <div style="text-align:center;margin:20px 0;">
          <a href="${appUrl}/providers/dashboard"
             style="display:inline-block;padding:10px 24px;background:#c8a855;color:#0b0d12;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">
            Review & send quote
          </a>
        </div>

        <p style="color:#666;font-size:11px;margin-top:24px;text-align:center;">
          Request #${args.requestId.slice(0, 8)} — ShortStack Pro Services
        </p>
      </div>
    `,
  });

  // Also ping the platform Telegram (if configured) so Nicklas sees the
  // activity during v1. This uses the existing env var pattern that
  // email.ts relies on.
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text:
          `🧑‍💼 Pro Services: new quote request\n` +
          `• Provider: ${args.providerName} <${args.providerEmail}>\n` +
          `• Requester: ${args.requesterEmail}\n` +
          `• Title: ${args.title}\n` +
          `• Category: ${args.category}\n` +
          (args.budget_cents ? `• Budget: $${(args.budget_cents / 100).toLocaleString()}\n` : "") +
          `\nID: ${args.requestId}`,
      }),
    }).catch(() => {});
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// createServiceClient is imported above for future use (webhook ingress).
void createServiceClient;
