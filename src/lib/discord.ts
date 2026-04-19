/**
 * Discord announcement utility
 * Posts important events to the Trinity Discord server (agency ops channel).
 */

import { BRAND } from "@/lib/brand-config";

const DISCORD_API = "https://discord.com/api/v10";
const ANNOUNCEMENTS_CHANNEL = "1492846003580178442";

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

export async function postDiscordAnnouncement(
  title: string,
  description: string,
  fields?: DiscordField[],
  color?: number
) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `${DISCORD_API}/channels/${ANNOUNCEMENTS_CHANNEL}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title,
              description,
              color: color || 0xc9a84c,
              fields: fields || [],
              footer: { text: `${BRAND.product_name} Bot` },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Pre-built announcement types
export async function announceNewClient(clientName: string, industry?: string) {
  return postDiscordAnnouncement(
    "\uD83C\uDF89 New Client Onboarded!",
    `**${clientName}** just joined ${BRAND.product_name}!${industry ? `\nIndustry: ${industry}` : ""}`,
    undefined,
    0x2ecc71
  );
}

export async function announceNewFeature(
  feature: string,
  description: string
) {
  return postDiscordAnnouncement(
    "\uD83D\uDE80 New Feature Launched",
    `**${feature}**\n${description}`,
    undefined,
    0x3498db
  );
}

export async function announceNewLead(count: number, source?: string) {
  return postDiscordAnnouncement(
    "\uD83D\uDCCA New Leads Scraped",
    `**${count}** new leads just came in${source ? ` from ${source}` : ""}.`,
    undefined,
    0xf1c40f
  );
}

export async function announceMilestone(milestone: string) {
  return postDiscordAnnouncement(
    "\uD83C\uDFC6 Milestone Reached!",
    milestone,
    undefined,
    0xc9a84c
  );
}

export async function announceSystemAlert(
  title: string,
  details: string
) {
  return postDiscordAnnouncement(
    `\u26A0\uFE0F ${title}`,
    details,
    undefined,
    0xe74c3c
  );
}
