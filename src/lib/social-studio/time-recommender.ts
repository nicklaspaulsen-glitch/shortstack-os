import { SocialPlatform } from "./types";
import { PLATFORM_BEST_HOURS, PLATFORM_WEAK_DAYS } from "./constants";

/**
 * Pick the next "good" send window for each requested platform within the
 * upcoming 7 days. Used by /api/social/auto-upload to seed the user's
 * "Schedule All" UI before they tweak times.
 *
 * Strategy: walk forward day by day, and for each day pick the first
 * upcoming best-hour slot for the platform. Skip platform-weak days.
 *
 * Returns ISO strings + a friendly label like "Tomorrow 8:00 AM".
 */
export interface TimeSuggestion {
  platform: SocialPlatform;
  iso: string;
  label: string;
  rationale: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:00 ${period}`;
}

function relativeDayLabel(target: Date, now: Date): string {
  const diffDays = Math.round(
    (target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime())
      / (24 * 60 * 60 * 1000)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `${DAYS[target.getDay()]} ${target.getMonth() + 1}/${target.getDate()}`;
}

export function pickRecommendedTimes(
  platforms: SocialPlatform[],
  now: Date = new Date(),
): TimeSuggestion[] {
  const out: TimeSuggestion[] = [];

  for (const platform of platforms) {
    const bestHours = PLATFORM_BEST_HOURS[platform];
    const weakDays = PLATFORM_WEAK_DAYS[platform] ?? [];

    // Look up to 7 days out for the first valid slot.
    let chosen: Date | null = null;
    for (let dayOffset = 0; dayOffset < 7 && !chosen; dayOffset++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + dayOffset);
      const dow = candidate.getDay();
      if (weakDays.includes(dow)) continue;

      for (const hour of bestHours) {
        const slot = new Date(candidate);
        slot.setHours(hour, 0, 0, 0);
        // Must be at least 30 min in the future.
        if (slot.getTime() - now.getTime() > 30 * 60 * 1000) {
          chosen = slot;
          break;
        }
      }
    }

    // Fallback — schedule 24h from now if nothing matched (shouldn't happen
    // unless the platform's bestHours array is empty).
    if (!chosen) {
      chosen = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }

    const dayLabel = relativeDayLabel(chosen, now);
    out.push({
      platform,
      iso: chosen.toISOString(),
      label: `${dayLabel} ${formatHour(chosen.getHours())}`,
      rationale: `Peak engagement window for ${platform} on ${DAYS[chosen.getDay()]}s based on platform-wide patterns.`,
    });
  }

  return out;
}
