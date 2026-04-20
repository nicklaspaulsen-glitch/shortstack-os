import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/waitlist/join
 *
 * Body: { feature: string, email?: string }
 *
 * Records a user's interest in an in-development feature. Accepts both
 * authenticated (Supabase cookie session) and anonymous joins. If the
 * caller is authed and omits email, we use their auth email on file.
 *
 * Response: { ok: true, position: number }
 *   position = count of existing rows for this feature at the time we
 *   wrote (0-indexed). Purely for vanity copy on the client.
 */
export async function POST(request: NextRequest) {
  let body: { feature?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const feature = typeof body?.feature === "string" ? body.feature.trim() : "";
  const rawEmail = typeof body?.email === "string" ? body.email.trim() : "";

  if (!feature) {
    return NextResponse.json({ error: "feature is required" }, { status: 400 });
  }
  if (feature.length > 120) {
    return NextResponse.json({ error: "feature too long" }, { status: 400 });
  }

  // Cheap sanity check on the email — we don't mandate RFC compliance,
  // just reject obvious garbage so we don't dump noise into the table.
  let email: string | null = rawEmail || null;
  if (email && (email.length > 320 || !email.includes("@"))) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const supabase = createServerSupabase();

  // Best-effort user lookup — if no session we still accept the join
  // with whatever email the client provided (or null).
  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      if (!email && user.email) {
        email = user.email;
      }
    }
  } catch {
    // Anonymous — continue without user_id
  }

  // Count existing rows so we can return a "position" for the UI.
  // This is non-critical; if the count fails we still try to insert.
  let position = 0;
  try {
    const { count } = await supabase
      .from("feature_waitlist")
      .select("*", { count: "exact", head: true })
      .eq("feature", feature);
    if (typeof count === "number") position = count;
  } catch (err) {
    console.warn("[waitlist/join] count failed:", err);
  }

  const { error: insertError } = await supabase
    .from("feature_waitlist")
    .insert({
      user_id: userId,
      feature,
      email,
    });

  if (insertError) {
    // Fall back to a console log so we don't lose the signal if the
    // table is missing in a given env.
    console.warn("[waitlist/join] insert failed, logging only:", {
      feature,
      email,
      userId,
      error: insertError.message,
    });
    // Still return ok — the user shouldn't be punished for a server-side
    // misconfiguration. Dropping a log line above is enough to debug.
    return NextResponse.json({ ok: true, position, logged: true });
  }

  return NextResponse.json({ ok: true, position });
}
