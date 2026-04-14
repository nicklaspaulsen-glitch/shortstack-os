// Unified Social Media Publisher — Zernio-first, Ayrshare fallback
// Automatically routes through whichever service is available

import * as zernio from "./zernio";
import * as ayrshare from "./ayrshare";

type Provider = "zernio" | "ayrshare";

// Check which providers are configured and healthy
async function getAvailableProvider(): Promise<Provider | null> {
  const hasZernio = !!process.env.ZERNIO_API_KEY;
  const hasAyrshare = !!process.env.AYRSHARE_API_KEY;

  // Try Zernio first (cheaper)
  if (hasZernio) {
    try {
      const profiles = await zernio.getProfiles();
      // If we get any response (even empty), Zernio is up
      if (Array.isArray(profiles)) return "zernio";
    } catch {
      // Zernio is down, try Ayrshare
    }
  }

  // Fallback to Ayrshare
  if (hasAyrshare) {
    try {
      const health = await ayrshare.checkHealth();
      if (health.healthy) return "ayrshare";
    } catch {
      // Ayrshare also down
    }
  }

  return null;
}

// Cache provider health for 5 minutes to avoid checking on every call
let cachedProvider: { provider: Provider | null; checkedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function resolveProvider(): Promise<Provider | null> {
  if (cachedProvider && Date.now() - cachedProvider.checkedAt < CACHE_TTL) {
    return cachedProvider.provider;
  }
  const provider = await getAvailableProvider();
  cachedProvider = { provider, checkedAt: Date.now() };
  return provider;
}

// Force re-check (e.g., after an error)
export function invalidateProviderCache() {
  cachedProvider = null;
}

// ══════════════════════════════════
// Unified Publish
// ══════════════════════════════════

export async function publish(params: {
  text: string;
  platforms: string[];
  mediaUrls?: string[];
  scheduledAt?: string;
  profileId?: string; // Zernio profile ID or Ayrshare profile key
  title?: string;
  hashtags?: string[];
}): Promise<{ success: boolean; postId?: string; provider?: string; error?: string }> {
  const provider = await resolveProvider();

  if (!provider) {
    return { success: false, error: "No social media provider available (both Zernio and Ayrshare are down or unconfigured)" };
  }

  if (provider === "zernio") {
    const result = await zernio.schedulePost({
      text: params.text,
      platforms: params.platforms,
      mediaUrls: params.mediaUrls,
      scheduledAt: params.scheduledAt,
      profileIds: params.profileId ? [params.profileId] : undefined,
      title: params.title,
      hashtags: params.hashtags,
    });

    if (result.success) {
      return { ...result, provider: "zernio" };
    }

    // Zernio failed — try Ayrshare fallback
    if (process.env.AYRSHARE_API_KEY) {
      invalidateProviderCache();
      const fallback = await ayrshare.publishPost({
        post: params.text,
        platforms: params.platforms,
        mediaUrls: params.mediaUrls,
        scheduledDate: params.scheduledAt,
        profileKey: params.profileId,
        title: params.title,
        hashtags: params.hashtags,
      });
      return { ...fallback, provider: "ayrshare" };
    }

    return { ...result, provider: "zernio" };
  }

  // Ayrshare primary
  const result = await ayrshare.publishPost({
    post: params.text,
    platforms: params.platforms,
    mediaUrls: params.mediaUrls,
    scheduledDate: params.scheduledAt,
    profileKey: params.profileId,
    title: params.title,
    hashtags: params.hashtags,
  });
  return { ...result, provider: "ayrshare" };
}

// ══════════════════════════════════
// Unified DM
// ══════════════════════════════════

export async function sendDM(params: {
  platform: "instagram" | "facebook" | "twitter";
  recipientId: string;
  message: string;
  profileId?: string;
}): Promise<{ success: boolean; provider?: string; error?: string }> {
  // Only Ayrshare supports DMs via API
  if (process.env.AYRSHARE_API_KEY) {
    const result = await ayrshare.sendDirectMessage({
      platform: params.platform,
      recipientId: params.recipientId,
      message: params.message,
      profileKey: params.profileId,
    });
    return { ...result, provider: "ayrshare" };
  }

  // Zernio doesn't have a documented DM API — log as queued
  return {
    success: false,
    error: "DM sending requires Ayrshare (AYRSHARE_API_KEY). Zernio does not support DMs.",
  };
}

// ══════════════════════════════════
// Unified Analytics
// ══════════════════════════════════

export async function getAnalytics(params?: {
  platforms?: string[];
  profileId?: string;
}): Promise<{ data: Record<string, unknown>; provider?: string }> {
  const provider = await resolveProvider();

  if (provider === "ayrshare") {
    const data = await ayrshare.getAnalytics({
      platforms: params?.platforms,
      profileKey: params?.profileId,
    });
    return { data, provider: "ayrshare" };
  }

  if (provider === "zernio") {
    const data = await zernio.getAccountAnalytics({
      platform: params?.platforms?.[0],
    });
    return { data, provider: "zernio" };
  }

  return { data: {}, provider: undefined };
}

// ══════════════════════════════════
// Status
// ══════════════════════════════════

export async function getStatus(): Promise<{
  activeProvider: Provider | null;
  zernio: { configured: boolean; healthy: boolean };
  ayrshare: { configured: boolean; healthy: boolean };
}> {
  const hasZernio = !!process.env.ZERNIO_API_KEY;
  const hasAyrshare = !!process.env.AYRSHARE_API_KEY;

  let zernioHealthy = false;
  let ayrshareHealthy = false;

  if (hasZernio) {
    try {
      const profiles = await zernio.getProfiles();
      zernioHealthy = Array.isArray(profiles);
    } catch {}
  }

  if (hasAyrshare) {
    try {
      const health = await ayrshare.checkHealth();
      ayrshareHealthy = health.healthy;
    } catch {}
  }

  const active = zernioHealthy ? "zernio" : ayrshareHealthy ? "ayrshare" : null;

  return {
    activeProvider: active,
    zernio: { configured: hasZernio, healthy: zernioHealthy },
    ayrshare: { configured: hasAyrshare, healthy: ayrshareHealthy },
  };
}
