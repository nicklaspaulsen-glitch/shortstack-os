// Zernio Integration — Free social media auto-publishing for clients
// Supports: Instagram, TikTok, Twitter/X, YouTube, Facebook, LinkedIn

const ZERNIO_BASE = "https://api.zernio.com/v1";

async function zernioFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error("Zernio API key not configured");

  return fetch(`${ZERNIO_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

// Get all connected social profiles
export async function getProfiles(): Promise<Array<{
  id: string;
  platform: string;
  username: string;
  status: string;
  profileName: string;
}>> {
  try {
    const res = await zernioFetch("/profiles");
    const data = await res.json();
    return data.profiles || data || [];
  } catch {
    return [];
  }
}

// Schedule a post to multiple platforms
export async function schedulePost(params: {
  text: string;
  platforms: string[]; // instagram, tiktok, twitter, youtube, facebook, linkedin
  mediaUrls?: string[];
  scheduledAt?: string;
  profileIds?: string[];
  title?: string;
  hashtags?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      text: params.text,
      platforms: params.platforms,
      ...(params.profileIds ? { profileIds: params.profileIds } : {}),
      ...(params.mediaUrls ? { media: params.mediaUrls } : {}),
      ...(params.scheduledAt ? { scheduledAt: params.scheduledAt } : { publishNow: true }),
      ...(params.title ? { title: params.title } : {}),
    };

    const res = await zernioFetch("/posts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return res.ok
      ? { success: true, postId: data.id || data.postId }
      : { success: false, error: data.message || data.error || `Error ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Get post analytics
export async function getPostAnalytics(postId: string): Promise<Record<string, unknown>> {
  try {
    const res = await zernioFetch(`/posts/${postId}/analytics`);
    return await res.json();
  } catch {
    return {};
  }
}

// Get account analytics
export async function getAccountAnalytics(params?: {
  platform?: string;
  from?: string;
  to?: string;
}): Promise<Record<string, unknown>> {
  try {
    const query = new URLSearchParams();
    if (params?.platform) query.set("platform", params.platform);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const res = await zernioFetch(`/analytics?${query}`);
    return await res.json();
  } catch {
    return {};
  }
}

// Auto-publish from ShortStack publish queue
export async function publishFromQueue(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  item: {
    id: string;
    video_title: string;
    description: string | null;
    hashtags: string[] | null;
    platforms: string[];
    scheduled_at: string | null;
    publish_now: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const hashtagString = item.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ") || "";
  const fullText = `${item.description || item.video_title}\n\n${hashtagString}`;

  // Map ShortStack platform names to Zernio
  const platformMap: Record<string, string> = {
    youtube: "youtube",
    youtube_shorts: "youtube",
    tiktok: "tiktok",
    instagram_reels: "instagram",
    facebook_reels: "facebook",
    linkedin_video: "linkedin",
  };

  const zernioPlats = item.platforms.map(p => platformMap[p] || p).filter(Boolean);

  const result = await schedulePost({
    text: fullText,
    platforms: zernioPlats,
    title: item.video_title,
    hashtags: item.hashtags || [],
    scheduledAt: item.publish_now ? undefined : item.scheduled_at || undefined,
  });

  // Update queue status
  await supabase.from("publish_queue").update({
    status: result.success ? "published" : "failed",
    published_at: result.success ? new Date().toISOString() : null,
    error_message: result.error || null,
    published_urls: result.postId ? { zernio: result.postId } : {},
  }).eq("id", item.id);

  // Telegram notification
  if (result.success) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `📤 *Published via Zernio*\n"${item.video_title}"\nPlatforms: ${zernioPlats.join(", ")}`);
    }
  }

  return result;
}
