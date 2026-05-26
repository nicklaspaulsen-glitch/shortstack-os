import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { sendDM as zernioDM } from "@/lib/services/zernio";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leadgen/onboard
 *
 * After a lead's payment is confirmed, the AI collects social media login
 * credentials via DM, creates a managed Zernio profile, stores only the
 * resulting zernio_profile_id (NEVER the password), then fires
 * /api/leadgen/generate-content to begin content work.
 *
 * SECURITY:
 *   - Plain-text password is used once to call Zernio, then discarded.
 *   - Password is redacted from message_history before DB write.
 *   - Only zernio_profile_id persists in the DB.
 *
 * Auth: session bearer OR x-webhook-key + owner_id
 *
 * Body:
 *   lead_id           string   — lead_pipeline.id
 *   inbound_message?  string   — reply from lead (omit to send opening message)
 *   mark_complete?    boolean  — force-mark complete (manual override)
 *   owner_id?         string   — required for webhook auth
 */

const ONBOARDING_SYSTEM = `You are a friendly agency onboarding assistant collecting social media account
access from a new paying client via Instagram DM. Be brief (3 sentences max), warm, and clear.

You need to collect:
1. The platform they want you to manage first (Instagram assumed; ask if they want TikTok too)
2. Their account EMAIL (the login email for the platform)
3. Their account PASSWORD — explicitly reassure them it is only used to connect their account
   securely and is never stored after the connection is made

Rules:
- Ask ONE piece of information at a time.
- Always reassure on security when asking for the password.
- Once you have email + password for a platform, output a JSON block at the end of your message:
  <collected>{"platform":"instagram","email":"...","password":"...","tiktok":false}</collected>
  If TikTok was requested, include a second block for tiktok.
- After outputting <collected>, say: "Perfect — connecting your account now! I'll be back shortly."
- If the client says "not now" or refuses, output: SKIP`;

const OPENING_MESSAGE = `Hey! Payment confirmed — welcome aboard! 🎉

To get started managing your account, I need to connect it. This is quick:

1. What's the **email** you use to log in to Instagram?
2. What's your **password**?

Your credentials are used only to securely connect your account and are never stored after setup. You can change your password afterwards if you prefer.`;

type MessageEntry = { role: string; content: string; ts: string };

type CollectedBlock = {
  platform: string;
  email: string;
  password: string;
  tiktok?: boolean;
};

export async function POST(request: NextRequest) {
  const webhookKey = request.headers.get("x-webhook-key");
  const expectedKey = process.env.WEBHOOK_SECRET;

  let ownerId: string | null = null;
  let body: Record<string, unknown>;

  if (webhookKey && expectedKey && secureCompare(webhookKey, expectedKey)) {
    body = await request.json();
    ownerId = (body.owner_id as string) ?? null;
    if (!ownerId)
      return NextResponse.json({ error: "owner_id required for webhook auth" }, { status: 400 });
  } else {
    const authSupabase = createServerSupabase();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    ownerId = user.id;
    body = await request.json();
  }

  const { lead_id, inbound_message, mark_complete } = body as {
    lead_id: string;
    inbound_message?: string;
    mark_complete?: boolean;
    owner_id?: string;
  };

  if (!lead_id) return NextResponse.json({ error: "lead_id required" }, { status: 400 });

  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from("lead_pipeline")
    .select("id, handle, platform, stage, message_history, onboarding_data, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Manual complete override
  if (mark_complete) {
    await supabase
      .from("lead_pipeline")
      .update({ stage: "scripting", onboarding_complete: true })
      .eq("id", lead_id);
    return NextResponse.json({ ok: true, stage: "scripting", complete: true });
  }

  // No inbound → send opening message
  if (!inbound_message) {
    const history = (row.message_history as MessageEntry[]) || [];
    const newHistory: MessageEntry[] = [
      ...history,
      { role: "assistant", content: OPENING_MESSAGE, ts: new Date().toISOString() },
    ];
    await supabase
      .from("lead_pipeline")
      .update({ stage: "onboarding", message_history: newHistory })
      .eq("id", lead_id);
    await sendDM(row.platform, row.handle, OPENING_MESSAGE);
    return NextResponse.json({ ok: true, stage: "onboarding", message: OPENING_MESSAGE });
  }

  // Process inbound reply
  const history = (row.message_history as MessageEntry[]) || [];
  const updatedHistory: MessageEntry[] = [
    ...history,
    { role: "user", content: inbound_message, ts: new Date().toISOString() },
  ];

  const conversationText = updatedHistory
    .map((m) => `${m.role === "user" ? "Lead" : "Assistant"}: ${m.content}`)
    .join("\n");

  const result = await callLLMTraced({
    taskType: "agentic_reasoning",
    systemPrompt: ONBOARDING_SYSTEM,
    userPrompt: `Conversation:\n${conversationText}\n\nCurrent data: ${JSON.stringify(
      row.onboarding_data,
    )}`,
    maxTokens: 400,
    forceModel: "claude-haiku-4-5",
    surface: "leadgen_onboard",
    subject: { kind: "lead", id: lead_id, agencyOwnerId: ownerId },
    humanize: true,
    channel: "dm",
  });

  const aiReply: string = result.text;

  // Check for SKIP token
  if (aiReply.toUpperCase().includes("SKIP")) {
    const cleanSkip =
      aiReply.replace(/SKIP/gi, "").trim() ||
      "No problem! We can connect your account whenever you're ready. Just message me.";
    await supabase
      .from("lead_pipeline")
      .update({ message_history: updatedHistory, last_reply_at: new Date().toISOString() })
      .eq("id", lead_id);
    await sendDM(row.platform, row.handle, cleanSkip);
    return NextResponse.json({ ok: true, stage: row.stage, skipped: true });
  }

  // Extract <collected> credential blocks using matchAll (no exec needed)
  const collectedBlocks: CollectedBlock[] = [];
  const matches = Array.from(aiReply.matchAll(/<collected>([\s\S]*?)<\/collected>/g));
  for (const m of matches) {
    try {
      const parsed = JSON.parse(m[1]) as CollectedBlock;
      if (parsed.email && parsed.password) collectedBlocks.push(parsed);
    } catch {
      /* ignore parse errors */
    }
  }

  // Strip <collected> blocks from what the lead sees and what we store in history
  const cleanReply = aiReply.replace(/<collected>[\s\S]*?<\/collected>/g, "").trim();

  let onboardingData = (row.onboarding_data as Record<string, unknown>) || {};
  let complete = false;
  let zernioProfileId: string | null = null;

  if (collectedBlocks.length > 0) {
    const primary = collectedBlocks[0];

    // Create Zernio managed profile — password used here and nowhere else
    const profileResult = await createZernioProfile({
      platform: primary.platform,
      email: primary.email,
      password: primary.password,
      ownerRef: ownerId,
    });

    if (profileResult.ok) {
      zernioProfileId = profileResult.profile_id;
      onboardingData = {
        ...onboardingData,
        platforms_connected: [primary.platform],
        tiktok: collectedBlocks.some((b) => b.tiktok) || Boolean(primary.tiktok),
        zernio_profile_id: zernioProfileId,
        account_email: primary.email, // email only — password NOT stored
      };
      complete = true;
    } else {
      console.error("[leadgen/onboard] Zernio profile creation failed:", profileResult.error);
      // Redact passwords from history even on failure, then ask lead to retry
      const safeHistory = redactHistoryPasswords(
        [...updatedHistory, { role: "assistant", content: cleanReply, ts: new Date().toISOString() }],
        collectedBlocks,
      );
      await supabase
        .from("lead_pipeline")
        .update({ message_history: safeHistory, last_reply_at: new Date().toISOString() })
        .eq("id", lead_id);
      const retryMsg =
        "Hmm, I had trouble connecting your account. Could you double-check your email and password and try again?";
      await sendDM(row.platform, row.handle, retryMsg);
      return NextResponse.json({ ok: false, stage: "onboarding", retry: true });
    }
  }

  // Redact passwords before persisting conversation history
  const safeHistory = redactHistoryPasswords(
    [...updatedHistory, { role: "assistant", content: cleanReply, ts: new Date().toISOString() }],
    collectedBlocks,
  );

  const updatePayload: Record<string, unknown> = {
    message_history: safeHistory,
    onboarding_data: onboardingData,
    last_reply_at: new Date().toISOString(),
  };

  if (complete) {
    updatePayload.stage = "scripting";
    updatePayload.onboarding_complete = true;
    if (zernioProfileId) updatePayload.zernio_profile_id = zernioProfileId;
  }

  await supabase.from("lead_pipeline").update(updatePayload).eq("id", lead_id);

  if (cleanReply) await sendDM(row.platform, row.handle, cleanReply);

  // After successful credential collection → fire content generation
  if (complete) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
    fetch(`${appUrl}/api/leadgen/generate-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-key": process.env.WEBHOOK_SECRET || "",
      },
      body: JSON.stringify({ lead_id }),
    }).catch((err) =>
      console.warn("[leadgen/onboard] generate-content trigger failed:", err),
    );
  }

  return NextResponse.json({
    ok: true,
    stage: complete ? "scripting" : "onboarding",
    complete,
    reply: cleanReply,
    onboarding_data: onboardingData,
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function sendDM(platform: string, handle: string, message: string): Promise<void> {
  const result = await zernioDM({ platform, handle, message });
  if (!result.ok) console.error("[leadgen/onboard] Zernio DM send failed:", result.error);
}

type ZernioProfileResult =
  | { ok: true; profile_id: string }
  | { ok: false; error: string };

async function createZernioProfile(opts: {
  platform: string;
  email: string;
  password: string;
  ownerRef: string;
}): Promise<ZernioProfileResult> {
  const zernioKey = process.env.ZERNIO_API_KEY;
  if (!zernioKey) return { ok: false, error: "ZERNIO_API_KEY not configured" };

  try {
    const res = await fetch("https://api.zernio.com/v1/profiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": zernioKey,
      },
      body: JSON.stringify({
        platform: opts.platform,
        email: opts.email,
        password: opts.password,
        owner_ref: opts.ownerRef,
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Zernio HTTP ${res.status}: ${txt}` };
    }

    const json = (await res.json()) as { id?: string; profile_id?: string };
    const profileId = json.id || json.profile_id;
    if (!profileId) return { ok: false, error: "No profile_id in Zernio response" };

    return { ok: true, profile_id: profileId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown error" };
  }
}

/** Redact known plain-text passwords from all messages in a history array */
function redactHistoryPasswords(
  history: MessageEntry[],
  blocks: CollectedBlock[],
): MessageEntry[] {
  const passwords = blocks.map((b) => b.password).filter(Boolean);
  if (passwords.length === 0) return history;

  return history.map((entry) => ({
    ...entry,
    content: passwords.reduce((txt, pw) => {
      // Use split/join to avoid needing a RegExp with the password as pattern
      return txt.split(pw).join("[REDACTED]");
    }, entry.content),
  }));
}
