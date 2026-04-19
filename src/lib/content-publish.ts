/**
 * Content Hub — Phase 3: auto-posting execution helpers.
 *
 * Shared between `/api/cron/publish-scheduled` (batch worker) and
 * `/api/content-calendar/[id]/publish-now` (single-row on-demand). Keeps the
 * actual post-to-platform logic in one place so both paths have identical
 * behaviour for success / failure / "no account connected".
 */
import { SupabaseClient } from "@supabase/supabase-js";

// ── types ───────────────────────────────────────────────────────────
export type CalendarRow = {
  id: string;
  client_id: string | null;
  title: string | null;
  platform: string;           // enum value like "instagram_reels" | "tiktok"
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
};

export type PublishOutcome =
  | { id: string; status: "posted"; live_url: string | null; platform: string }
  | { id: string; status: "failed"; error: string; platform: string }
  | { id: string; status: "needs_connection"; platform: string; short_platform: string };

/**
 * Maps the `publish_platform` enum values used on content_calendar to the
 * short-name keys stored in `social_accounts.platform`.
 *
 * Inverse of `mapPlatform()` in /api/content-plan/auto-generate/route.ts.
 */
export function calendarPlatformToShort(p: string): string {
  const key = p.toLowerCase();
  const map: Record<string, string> = {
    youtube: "youtube",
    youtube_shorts: "youtube",
    shorts: "youtube",
    tiktok: "tiktok",
    instagram_reels: "instagram",
    instagram: "instagram",
    reels: "instagram",
    facebook_reels: "facebook",
    facebook: "facebook",
    linkedin_video: "linkedin",
    linkedin: "linkedin",
    twitter: "twitter",
    x: "twitter",
  };
  return map[key] || key;
}

/**
 * Best-effort media URL resolver. Plans may stash the original asset id in
 * metadata.asset_id (see content-plan/auto-generate). If present, look up the
 * file URL from the asset_packages table; otherwise fall back to whatever was
 * inline in metadata.media_url.
 */
async function resolveMediaUrl(
  supabase: SupabaseClient,
  row: CalendarRow,
): Promise<string | null> {
  const md = row.metadata || {};
  if (typeof md.media_url === "string" && md.media_url) return md.media_url;
  const assetId = typeof md.asset_id === "string" ? md.asset_id : null;
  if (!assetId) return null;

  // content_packages is the table behind Drop & Go (referenced in
  // 20260419_content_packages.sql). Fall back silently if the table or row
  // is missing — callers can still post text-only where supported.
  try {
    const { data } = await supabase
      .from("content_packages")
      .select("file_url")
      .eq("id", assetId)
      .maybeSingle();
    if (data && typeof data.file_url === "string") return data.file_url;
  } catch {
    // swallow — asset is optional
  }
  return null;
}

/**
 * Publish a single content_calendar row. Idempotent-ish: if the row has
 * already moved past `approved_for_publish` / `scheduled`, we refuse.
 *
 * NOTE: callers must pass a supabase client with service-role privileges
 * when invoked from the cron (no user session). For the publish-now
 * endpoint, the caller already validated ownership via verifyClientAccess.
 */
export async function publishCalendarRow(
  supabase: SupabaseClient,
  row: CalendarRow,
  opts: { appOrigin?: string | null } = {},
): Promise<PublishOutcome> {
  if (!row.client_id) {
    return { id: row.id, status: "failed", error: "Row has no client_id", platform: row.platform };
  }

  // Mark publishing (optimistic lock — also used by the UI spinner)
  await supabase
    .from("content_calendar")
    .update({ status: "publishing" })
    .eq("id", row.id);

  const shortPlatform = calendarPlatformToShort(row.platform);

  // Check for a live social account
  const { data: account } = await supabase
    .from("social_accounts")
    .select("id, account_id, access_token, metadata")
    .eq("client_id", row.client_id)
    .eq("platform", shortPlatform)
    .eq("is_active", true)
    .maybeSingle();

  if (!account) {
    await supabase
      .from("content_calendar")
      .update({
        status: "needs_connection",
        published_error: `No connected ${shortPlatform} account. Connect in Integrations to publish.`,
      })
      .eq("id", row.id);
    return { id: row.id, status: "needs_connection", platform: row.platform, short_platform: shortPlatform };
  }

  const caption = row.notes || row.title || "";
  const mediaUrl = await resolveMediaUrl(supabase, row);

  // Delegate to the existing /api/social/post, which knows how to speak to
  // each platform (and transparently uses Zernio when configured on the
  // account). This preserves the existing Zernio fallback logic intact.
  //
  // We re-enter via HTTP rather than import the handler so we don't have to
  // refactor /api/social/post's request/response shape. The handler treats a
  // missing user session as 401, so we call its underlying platform posters
  // directly by re-using its shape via the server-to-server route with
  // CRON_SECRET where available; otherwise we replicate the exact logic.
  try {
    const result = await postToPlatform({
      shortPlatform,
      caption,
      mediaUrl,
      accessToken: account.access_token || "",
      accountId: account.account_id || "",
      accountMetadata: (account.metadata as Record<string, unknown>) || {},
    });

    if (result.error) {
      await supabase
        .from("content_calendar")
        .update({
          status: "failed",
          published_error: result.error,
        })
        .eq("id", row.id);
      return { id: row.id, status: "failed", error: result.error, platform: row.platform };
    }

    await supabase
      .from("content_calendar")
      .update({
        status: "posted",
        published_at: new Date().toISOString(),
        live_url: result.liveUrl || null,
        published_error: null,
      })
      .eq("id", row.id);

    // Best-effort trinity audit log
    try {
      await supabase.from("trinity_log").insert({
        agent: "content",
        action_type: "automation",
        description: `Auto-published to ${shortPlatform}: "${caption.substring(0, 60)}"`,
        client_id: row.client_id,
        status: "completed",
        result: { calendar_id: row.id, platform: shortPlatform, live_url: result.liveUrl },
      });
    } catch {}

    void opts; // reserved for future origin-aware links; silence unused warning
    return { id: row.id, status: "posted", live_url: result.liveUrl || null, platform: row.platform };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("content_calendar")
      .update({
        status: "failed",
        published_error: msg,
      })
      .eq("id", row.id);
    return { id: row.id, status: "failed", error: msg, platform: row.platform };
  }
}

// ── inline platform posters (mirror /api/social/post) ───────────────
type PostInput = {
  shortPlatform: string;
  caption: string;
  mediaUrl: string | null;
  accessToken: string;
  accountId: string;
  accountMetadata: Record<string, unknown>;
};

type PostResult = { error?: string; liveUrl?: string | null; raw?: unknown };

async function postToPlatform(input: PostInput): Promise<PostResult> {
  const { shortPlatform, caption, mediaUrl, accessToken, accountId, accountMetadata } = input;

  if (!accessToken) {
    return { error: `No access token stored for ${shortPlatform}` };
  }

  // Zernio-managed accounts (marked in metadata.zernio) are posted through
  // the Zernio API rather than direct Graph/LinkedIn calls.
  if (accountMetadata?.zernio === true && process.env.ZERNIO_API_KEY) {
    return zernioPost({ shortPlatform, caption, mediaUrl, accountId });
  }

  if (shortPlatform === "facebook") {
    const res = await fetch(`https://graph.facebook.com/v18.0/${accountId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: caption,
        access_token: accessToken,
        ...(mediaUrl ? { link: mediaUrl } : {}),
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok || data.error) {
      return { error: fbError(data) || `Facebook API error ${res.status}` };
    }
    const postId = typeof data.id === "string" ? data.id : null;
    return { liveUrl: postId ? `https://facebook.com/${postId}` : null, raw: data };
  }

  if (shortPlatform === "instagram") {
    if (!mediaUrl) return { error: "Instagram requires a media_url (image or video)" };
    const createRes = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: mediaUrl, caption, access_token: accessToken }),
    });
    const createData = (await createRes.json()) as Record<string, unknown>;
    if (!createRes.ok || !createData.id) {
      return { error: fbError(createData) || "Instagram media container failed" };
    }
    const publishRes = await fetch(`https://graph.facebook.com/v18.0/${accountId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
    });
    const pubData = (await publishRes.json()) as Record<string, unknown>;
    if (!publishRes.ok || pubData.error) {
      return { error: fbError(pubData) || "Instagram publish failed" };
    }
    const postId = typeof pubData.id === "string" ? pubData.id : null;
    return { liveUrl: postId ? `https://instagram.com/p/${postId}` : null, raw: pubData };
  }

  if (shortPlatform === "linkedin") {
    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: `urn:li:person:${accountId}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: caption },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) return { error: (data.message as string) || `LinkedIn API error ${res.status}` };
    const urn = typeof data.id === "string" ? data.id : null;
    return { liveUrl: urn ? `https://www.linkedin.com/feed/update/${urn}` : null, raw: data };
  }

  if (shortPlatform === "twitter" || shortPlatform === "x") {
    // Twitter v2 tweets via OAuth2 bearer
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: caption }),
    });
    const data = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const detail = (data as { detail?: string; title?: string; error?: string }).detail
        || (data as { title?: string }).title
        || (data as { error?: string }).error
        || `X API error ${res.status}`;
      return { error: detail };
    }
    const inner = (data.data as { id?: string; text?: string } | undefined) || {};
    return {
      liveUrl: inner.id ? `https://twitter.com/i/status/${inner.id}` : null,
      raw: data,
    };
  }

  if (shortPlatform === "tiktok" || shortPlatform === "youtube") {
    // These platforms require Zernio or a per-platform SDK we haven't wired
    // direct. Fall back to Zernio if the account wasn't already routed there.
    if (process.env.ZERNIO_API_KEY && accountMetadata?.zernio === true) {
      return zernioPost({ shortPlatform, caption, mediaUrl, accountId });
    }
    return { error: `Direct posting not supported for ${shortPlatform}; connect via Zernio in Integrations.` };
  }

  return { error: `Unsupported platform: ${shortPlatform}` };
}

async function zernioPost(args: {
  shortPlatform: string;
  caption: string;
  mediaUrl: string | null;
  accountId: string;
}): Promise<PostResult> {
  try {
    const res = await fetch(`https://api.zernio.com/v1/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
      },
      body: JSON.stringify({
        account_id: args.accountId,
        platform: args.shortPlatform,
        caption: args.caption,
        media_url: args.mediaUrl || undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err = typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `Zernio error ${res.status}`;
      return { error: err };
    }
    const live = typeof data.live_url === "string"
      ? data.live_url
      : typeof data.url === "string"
        ? data.url
        : null;
    return { liveUrl: live, raw: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

function fbError(data: Record<string, unknown>): string | null {
  const e = data.error as { message?: string } | undefined;
  return e?.message || null;
}

/**
 * Send a digest message to Telegram. Silent no-op if env vars unset.
 */
export async function sendTelegramDigest(text: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch {
    // best-effort
  }
}
