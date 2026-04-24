import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/feedback
 * Body: {
 *   type: "bug" | "feature" | "praise" | "question",
 *   message: string,
 *   page_url?: string,
 *   screenshot_data_url?: string,
 *   user_agent?: string,
 * }
 *
 * Accepts authenticated and anonymous submissions. If the user is signed in,
 * their user_id (and optional org_id from profile) is attached automatically.
 * Row-level security on the table enforces the insert policy.
 */

type FeedbackBody = {
  type?: string;
  message?: string;
  page_url?: string;
  screenshot_data_url?: string;
  user_agent?: string;
};

const VALID_TYPES = new Set(["bug", "feature", "praise", "question"]);
const MAX_MESSAGE_LEN = 4000;
// Screenshots can be large — keep a safety ceiling (~2 MB base64).
const MAX_SCREENSHOT_LEN = 2_800_000;

export async function POST(req: Request) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = (body.type || "").toString().trim();
  const message = (body.message || "").toString().trim();

  if (!VALID_TYPES.has(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be one of: bug, feature, praise, question" },
      { status: 400 }
    );
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_LEN} chars)` },
      { status: 400 }
    );
  }

  const screenshot = body.screenshot_data_url;
  if (screenshot && screenshot.length > MAX_SCREENSHOT_LEN) {
    return NextResponse.json(
      { error: "Screenshot too large" },
      { status: 413 }
    );
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Try to pull org_id from the authed user's profile, if present.
  let orgId: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .maybeSingle();
    orgId = (profile as { org_id?: string | null } | null)?.org_id ?? null;
  }

  const { error: insertError } = await supabase.from("feedback").insert({
    user_id: user?.id ?? null,
    org_id: orgId,
    type,
    message,
    page_url: body.page_url ?? null,
    screenshot_data_url: screenshot ?? null,
    user_agent: body.user_agent ?? req.headers.get("user-agent") ?? null,
    status: "new",
  });

  if (insertError) {
    // RLS rejections etc — surface as 500 since input validation already passed.
    // eslint-disable-next-line no-console
    console.error("feedback insert failed", insertError);
    return NextResponse.json(
      { error: "Could not save feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
