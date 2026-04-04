// Metricool Integration — Auto-publish content to all platforms per client
// Uses Metricool's API for scheduling across Instagram, Facebook, TikTok, YouTube, LinkedIn, X

const METRICOOL_BASE = "https://app.metricool.com/api/v2";

async function metricoolFetch(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.METRICOOL_API_KEY;
  if (!apiKey) throw new Error("Metricool API key not configured");

  return fetch(`${METRICOOL_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

export interface MetricoolPost {
  text: string;
  platforms: string[]; // instagram, facebook, tiktok, youtube, linkedin, twitter
  mediaUrls?: string[];
  scheduledAt?: string; // ISO date
  title?: string; // For YouTube
  hashtags?: string[];
  firstComment?: string; // Instagram first comment with hashtags
}

// Schedule a post across multiple platforms via Metricool
export async function schedulePost(post: MetricoolPost): Promise<{
  success: boolean;
  postId?: string;
  error?: string;
}> {
  try {
    const body: Record<string, unknown> = {
      text: post.text,
      networks: post.platforms.map(p => ({
        network: mapPlatform(p),
        text: post.text,
        ...(post.title && p === "youtube" ? { title: post.title } : {}),
        ...(post.firstComment && p === "instagram" ? { firstComment: post.hashtags?.join(" ") || post.firstComment } : {}),
      })),
      ...(post.mediaUrls && post.mediaUrls.length > 0 ? { media: post.mediaUrls.map(url => ({ url })) } : {}),
      ...(post.scheduledAt ? { scheduledDate: post.scheduledAt } : { publishNow: true }),
    };

    const res = await metricoolFetch("/posts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.message || `Metricool error: ${res.status}` };
    }

    return { success: true, postId: data.id || data.postId };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Get scheduled posts
export async function getScheduledPosts(params?: {
  from?: string;
  to?: string;
  network?: string;
}): Promise<Array<Record<string, unknown>>> {
  try {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.network) query.set("network", params.network);

    const res = await metricoolFetch(`/posts?${query.toString()}`);
    const data = await res.json();
    return data.posts || data || [];
  } catch {
    return [];
  }
}

// Get analytics for a client's social accounts
export async function getAnalytics(params?: {
  network?: string;
  from?: string;
  to?: string;
}): Promise<Record<string, unknown>> {
  try {
    const query = new URLSearchParams();
    if (params?.network) query.set("network", params.network);
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);

    const res = await metricoolFetch(`/analytics?${query.toString()}`);
    return await res.json();
  } catch {
    return {};
  }
}

// Auto-publish from ShortStack publish queue to Metricool
export async function publishFromQueue(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  publishItem: {
    id: string;
    video_title: string;
    description: string | null;
    hashtags: string[] | null;
    platforms: string[];
    scheduled_at: string | null;
    publish_now: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const hashtagString = publishItem.hashtags?.map(h => h.startsWith("#") ? h : `#${h}`).join(" ") || "";
  const fullText = `${publishItem.description || publishItem.video_title}\n\n${hashtagString}`;

  const result = await schedulePost({
    text: fullText,
    platforms: publishItem.platforms.map(p => mapPlatformReverse(p)),
    title: publishItem.video_title,
    hashtags: publishItem.hashtags || [],
    scheduledAt: publishItem.publish_now ? undefined : publishItem.scheduled_at || undefined,
    firstComment: hashtagString,
  });

  // Update publish queue status
  await supabase.from("publish_queue").update({
    status: result.success ? "published" : "failed",
    published_at: result.success ? new Date().toISOString() : null,
    error_message: result.error || null,
    published_urls: result.postId ? { metricool: result.postId } : {},
  }).eq("id", publishItem.id);

  // Notify on Telegram
  if (result.success) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      const platformList = publishItem.platforms.join(", ");
      await sendTelegramMessage(chatId, `📤 *Content Published*\n\n"${publishItem.video_title}"\nPlatforms: ${platformList}\nVia Metricool`);
    }
  }

  return result;
}

// Map ShortStack platform names to Metricool network names
function mapPlatform(platform: string): string {
  const map: Record<string, string> = {
    instagram: "instagram",
    instagram_reels: "instagram",
    facebook: "facebook",
    facebook_reels: "facebook",
    tiktok: "tiktok",
    youtube: "youtube",
    youtube_shorts: "youtube",
    linkedin: "linkedin",
    linkedin_video: "linkedin",
    twitter: "twitter",
    x: "twitter",
  };
  return map[platform.toLowerCase()] || platform;
}

function mapPlatformReverse(platform: string): string {
  const map: Record<string, string> = {
    youtube: "youtube",
    youtube_shorts: "youtube",
    tiktok: "tiktok",
    instagram_reels: "instagram",
    facebook_reels: "facebook",
    linkedin_video: "linkedin",
  };
  return map[platform] || platform;
}
