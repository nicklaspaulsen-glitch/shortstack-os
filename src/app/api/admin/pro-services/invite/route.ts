import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/admin/pro-services/invite
 *
 * Admin-only. Sends an invitation email asking the freelancer to create
 * their own profile at /providers/profile. We don't create a row on
 * their behalf — they self-serve signup (POST /api/pro-services/providers)
 * so email-ownership is enforced by the server.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const origin =
    req.headers.get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://app.shortstack.com";
  const loginUrl = `${origin}/login?next=/providers/profile`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#C9A84C;margin:0 0 16px 0;">You're invited to join ShortStack Pro Services</h2>
      <p>Hi${name ? ` ${name}` : ""},</p>
      <p>
        ShortStack would like to invite you to our curated Pro Services Directory —
        a marketplace where our agency users can hire vetted human freelancers
        as an alternative (or complement) to our AI tools.
      </p>
      ${note ? `<blockquote style="border-left:3px solid #C9A84C;padding:8px 16px;margin:16px 0;color:#444;">${note}</blockquote>` : ""}
      <p>To get started:</p>
      <ol>
        <li>Create a ShortStack account with this email address (<b>${email}</b>)</li>
        <li>Visit your provider profile at the link below and fill out your bio, rates, and portfolio</li>
        <li>We'll review and vet your profile before it appears in the directory</li>
      </ol>
      <p style="margin:24px 0;">
        <a href="${loginUrl}" style="display:inline-block;padding:12px 20px;background:#C9A84C;color:#000;text-decoration:none;border-radius:8px;font-weight:600;">
          Create your provider profile →
        </a>
      </p>
      <p style="color:#666;font-size:12px;">
        Questions? Just reply to this email.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      to: email,
      subject: "You're invited to join ShortStack Pro Services",
      html,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send invitation" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, sent_to: email });
}
