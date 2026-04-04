// Social Outreach Service — Sends personalized DMs across platforms
// 20 DMs/day per platform = 80 total

import { OutreachPlatform } from "@/lib/types";

interface OutreachMessage {
  platform: OutreachPlatform;
  recipientHandle: string;
  businessName: string;
  message: string;
  leadId?: string;
}

interface OutreachResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

const DAILY_LIMITS: Record<OutreachPlatform, number> = {
  instagram: 20,
  linkedin: 20,
  facebook: 20,
  tiktok: 20,
};

// AI message generation using OpenAI
export async function generatePersonalizedMessage(
  platform: OutreachPlatform,
  businessName: string,
  industry: string,
  ownerName?: string | null
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getTemplateMessage(platform, businessName, industry, ownerName);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a friendly outreach specialist for ShortStack, a digital marketing agency. Write a short, personalized DM for ${platform}. Be conversational, not salesy. Max 150 words. Don't use emojis excessively. Focus on how you noticed their business and want to help them grow online. Include a soft CTA like asking if they're open to a quick chat.`,
          },
          {
            role: "user",
            content: `Write a ${platform} DM to ${ownerName || "the owner"} of "${businessName}" (${industry}). Make it feel natural and personal.`,
          },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });

    const data = await res.json();
    return data.choices?.[0]?.message?.content || getTemplateMessage(platform, businessName, industry, ownerName);
  } catch {
    return getTemplateMessage(platform, businessName, industry, ownerName);
  }
}

function getTemplateMessage(
  platform: OutreachPlatform,
  businessName: string,
  industry: string,
  ownerName?: string | null
): string {
  const name = ownerName || "there";
  const templates: Record<OutreachPlatform, string> = {
    instagram: `Hey ${name}! I came across ${businessName} and love what you're doing in the ${industry} space. We help businesses like yours get more clients through social media and ads. Would you be open to a quick chat about how we could help ${businessName} grow? No pressure at all!`,
    linkedin: `Hi ${name}, I noticed ${businessName} and I'm impressed by your work in ${industry}. At ShortStack, we specialize in helping ${industry} businesses attract more clients through digital marketing. I'd love to connect and share a few ideas that could help. Open to a brief conversation?`,
    facebook: `Hi ${name}! Found ${businessName} and really like what you've built. We work with ${industry} businesses to help them get more visibility and clients online. Would you be interested in hearing how we could help ${businessName} reach more people?`,
    tiktok: `Hey ${name}! Saw ${businessName} and think there's huge potential for your ${industry} business on social media. We help businesses like yours create content that actually brings in clients. Want to chat about it?`,
  };
  return templates[platform];
}

export async function generateFollowUpMessage(
  platform: OutreachPlatform,
  businessName: string,
  followupNumber: number,
  originalMessage: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (followupNumber === 1) {
      return `Hey! Just following up on my message about helping ${businessName} with digital marketing. I know you're busy — happy to send over a quick case study if that's easier. No worries either way!`;
    }
    return `Hi again! Last follow up — I genuinely think we could help ${businessName} get more clients online. If you're ever interested, feel free to reach out. Wishing you all the best!`;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Write follow-up #${followupNumber} for a ${platform} DM. ${followupNumber === 1 ? "It's day 3, be friendly and provide value." : "It's day 7, last follow-up, be respectful and leave the door open."} Max 100 words. Reference the original message naturally.`,
          },
          {
            role: "user",
            content: `Original message to ${businessName}: "${originalMessage}". Write follow-up #${followupNumber}.`,
          },
        ],
        max_tokens: 150,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || `Following up on my message about helping ${businessName}!`;
  } catch {
    return `Following up on my message about helping ${businessName}!`;
  }
}

// Platform-specific send functions
export async function sendInstagramDM(recipientId: string, message: string): Promise<OutreachResult> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "Instagram token not configured" };

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });
    const data = await res.json();
    return data.message_id
      ? { success: true, messageId: data.message_id }
      : { success: false, error: data.error?.message || "Failed to send" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendLinkedInMessage(recipientUrn: string, message: string): Promise<OutreachResult> {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "LinkedIn token not configured" };

  try {
    const res = await fetch("https://api.linkedin.com/v2/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipients: [recipientUrn],
        subject: "Quick question",
        body: message,
      }),
    });
    return res.ok
      ? { success: true }
      : { success: false, error: `LinkedIn API error: ${res.status}` };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendFacebookMessage(recipientId: string, message: string): Promise<OutreachResult> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "Facebook token not configured" };

  try {
    const res = await fetch(`https://graph.facebook.com/v18.0/me/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    });
    const data = await res.json();
    return data.message_id
      ? { success: true, messageId: data.message_id }
      : { success: false, error: data.error?.message || "Failed to send" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendTikTokMessage(recipientId: string, message: string): Promise<OutreachResult> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) return { success: false, error: "TikTok token not configured" };

  // TikTok Business API for messaging
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/dm/message/send/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient_id: recipientId,
        message_type: "text",
        text: message,
      }),
    });
    const data = await res.json();
    return data.data?.message_id
      ? { success: true, messageId: data.data.message_id }
      : { success: false, error: data.error?.message || "Failed to send" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export { DAILY_LIMITS };
export type { OutreachMessage, OutreachResult };
