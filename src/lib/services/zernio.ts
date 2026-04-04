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

// Create a profile group for a specific client
export async function createClientProfile(clientName: string): Promise<{
  success: boolean;
  profileId?: string;
  error?: string;
}> {
  try {
    const res = await zernioFetch("/profiles", {
      method: "POST",
      body: JSON.stringify({
        name: clientName,
        description: `Social media accounts for ${clientName} — managed by ShortStack`,
      }),
    });
    const data = await res.json();
    return res.ok
      ? { success: true, profileId: data.id || data.profileId }
      : { success: false, error: data.message || `Error ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Connect a social account to a client's profile
export async function connectAccountToProfile(params: {
  profileId: string;
  platform: string;
  accountId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await zernioFetch(`/profiles/${params.profileId}/connections`, {
      method: "POST",
      body: JSON.stringify({
        platform: params.platform,
        ...(params.accountId ? { accountId: params.accountId } : {}),
      }),
    });
    return { success: res.ok, error: res.ok ? undefined : `Error ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Setup a new client in Zernio: create profile + store mapping
export async function setupClientInZernio(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  clientId: string,
  clientName: string
): Promise<{ success: boolean; profileId?: string; error?: string }> {
  // Create profile in Zernio
  const result = await createClientProfile(clientName);

  if (result.success && result.profileId) {
    // Store the Zernio profile ID in the client's social_accounts
    await supabase.from("social_accounts").insert({
      client_id: clientId,
      platform: "zernio",
      account_name: clientName,
      account_id: result.profileId,
      is_active: true,
      metadata: { type: "zernio_profile", created_by: "shortstack_os" },
    });
  }

  return result;
}

// Get client's Zernio profile ID
export async function getClientZernioProfile(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  clientId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("social_accounts")
    .select("account_id")
    .eq("client_id", clientId)
    .eq("platform", "zernio")
    .single();
  return data?.account_id || null;
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

// Auto-publish from ShortStack publish queue — uses client-specific Zernio profile
export async function publishFromQueue(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  item: {
    id: string;
    client_id: string;
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

  // Get client-specific Zernio profile if exists
  let profileIds: string[] | undefined;
  if (item.client_id) {
    const clientProfileId = await getClientZernioProfile(supabase, item.client_id);
    if (clientProfileId) {
      profileIds = [clientProfileId];
    } else {
      // Auto-create profile for this client
      const { data: client } = await supabase.from("clients").select("business_name").eq("id", item.client_id).single();
      if (client) {
        const setup = await setupClientInZernio(supabase, item.client_id, client.business_name);
        if (setup.profileId) profileIds = [setup.profileId];
      }
    }
  }

  const result = await schedulePost({
    text: fullText,
    platforms: zernioPlats,
    profileIds,
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
