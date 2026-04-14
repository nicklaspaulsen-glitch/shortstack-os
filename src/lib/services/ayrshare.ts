// Ayrshare Social Media API — Backup/alternative to Zernio
// Supports: Instagram, TikTok, Twitter/X, YouTube, Facebook, LinkedIn + 7 more
// DMs: Instagram, Facebook, Twitter/X
// Docs: https://docs.ayrshare.com

const AYRSHARE_BASE = "https://app.ayrshare.com/api";

function getHeaders(profileKey?: string): Record<string, string> {
  const apiKey = process.env.AYRSHARE_API_KEY;
  if (!apiKey) throw new Error("AYRSHARE_API_KEY not configured");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  // Profile key for multi-client (Business plan)
  if (profileKey) headers["Profile-Key"] = profileKey;
  return headers;
}

// ══════════════════════════════════
// Profile Management (Multi-client)
// ══════════════════════════════════

export async function createProfile(params: {
  title: string;
  hideTopNav?: boolean;
}): Promise<{ profileKey?: string; error?: string }> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/profiles/profile`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        title: params.title,
        hideTopNav: params.hideTopNav ?? true,
      }),
    });
    const data = await res.json();
    if (data.profileKey) return { profileKey: data.profileKey };
    return { error: data.message || data.error || `Error ${res.status}` };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function getProfiles(): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/profiles`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    return data.profiles || data || [];
  } catch {
    return [];
  }
}

export async function generateConnectURL(params: {
  profileKey: string;
  platforms: string[];
  redirectURL?: string;
}): Promise<{ url?: string; error?: string }> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/profiles/generateJWT`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        domain: process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work",
        privateKey: process.env.AYRSHARE_PRIVATE_KEY || "",
        profileKey: params.profileKey,
      }),
    });
    const data = await res.json();
    if (data.token) {
      return { url: `https://app.ayrshare.com/social-accounts?token=${data.token}` };
    }
    return { error: data.message || "Failed to generate connect URL" };
  } catch (err) {
    return { error: String(err) };
  }
}

// ══════════════════════════════════
// Publishing
// ══════════════════════════════════

export async function publishPost(params: {
  post: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduledDate?: string;
  profileKey?: string;
  title?: string;
  hashtags?: string[];
}): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    // Map platform names to Ayrshare format
    const platformMap: Record<string, string> = {
      instagram: "instagram",
      tiktok: "tiktok",
      twitter: "twitter",
      facebook: "facebook",
      linkedin: "linkedin",
      youtube: "youtube",
      pinterest: "pinterest",
      reddit: "reddit",
      telegram: "telegram",
      threads: "threads",
      bluesky: "bluesky",
    };

    const platforms = params.platforms
      .map(p => platformMap[p.toLowerCase()] || p.toLowerCase())
      .filter(Boolean);

    const body: Record<string, unknown> = {
      post: params.post,
      platforms,
    };

    if (params.mediaUrls?.length) body.mediaUrls = params.mediaUrls;
    if (params.scheduledDate) body.scheduleDate = params.scheduledDate;
    if (params.title) body.title = params.title;

    const res = await fetch(`${AYRSHARE_BASE}/post`, {
      method: "POST",
      headers: getHeaders(params.profileKey),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.status === "success" || data.id) {
      return { success: true, postId: data.id || data.postIds?.[0] };
    }
    return { success: false, error: data.message || data.error || `Error ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ══════════════════════════════════
// Direct Messages (Instagram, Facebook, Twitter)
// ══════════════════════════════════

export async function sendDirectMessage(params: {
  platform: "instagram" | "facebook" | "twitter";
  recipientId: string;
  message: string;
  profileKey?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/message`, {
      method: "POST",
      headers: getHeaders(params.profileKey),
      body: JSON.stringify({
        platform: params.platform,
        recipientId: params.recipientId,
        message: params.message,
      }),
    });

    const data = await res.json();
    if (data.status === "success" || data.id) {
      return { success: true, messageId: data.id };
    }
    return { success: false, error: data.message || data.error || `Error ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ══════════════════════════════════
// Analytics
// ══════════════════════════════════

export async function getAnalytics(params?: {
  platforms?: string[];
  profileKey?: string;
}): Promise<Record<string, unknown>> {
  try {
    const body: Record<string, unknown> = {};
    if (params?.platforms) body.platforms = params.platforms;

    const res = await fetch(`${AYRSHARE_BASE}/analytics/social`, {
      method: "POST",
      headers: getHeaders(params?.profileKey),
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch {
    return {};
  }
}

export async function getPostAnalytics(postId: string, params?: {
  platforms?: string[];
  profileKey?: string;
}): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/analytics/post`, {
      method: "POST",
      headers: getHeaders(params?.profileKey),
      body: JSON.stringify({ id: postId, platforms: params?.platforms }),
    });
    return await res.json();
  } catch {
    return {};
  }
}

// ══════════════════════════════════
// Health Check
// ══════════════════════════════════

export async function checkHealth(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const res = await fetch(`${AYRSHARE_BASE}/user`, {
      headers: getHeaders(),
    });
    return { healthy: res.ok };
  } catch (err) {
    return { healthy: false, error: String(err) };
  }
}
