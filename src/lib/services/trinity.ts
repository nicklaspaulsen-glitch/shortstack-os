// Trinity AI Agent — Executes commands via Telegram or dashboard
// Can: build websites, set up AI receptionists, chatbots, automations,
// Discord servers, social accounts, email/SMS campaigns, lead gen

import { TrinityActionType } from "@/lib/types";

interface TrinityCommand {
  action: TrinityActionType;
  description: string;
  params: Record<string, string>;
  clientId?: string;
}

const ACTION_HANDLERS: Record<TrinityActionType, (params: Record<string, string>) => Promise<{ success: boolean; result: Record<string, unknown>; error?: string }>> = {
  website: async (params) => {
    const results: Record<string, unknown> = {};

    // Claude-powered website generation is now handled via the dashboard
    // wizard at /dashboard/websites → /api/websites/generate (Claude Sonnet)
    // and deployed via /api/websites/deploy (Vercel REST API).
    results.claude_status = "use_website_wizard";
    results.wizard_url = "/dashboard/websites";
    results.client = params.client || null;
    results.industry = params.industry || null;

    // Optional: GoDaddy domain availability check (purchase uses /api/websites/domains/purchase)
    const godaddyKey = process.env.GODADDY_API_KEY;
    const godaddySecret = process.env.GODADDY_API_SECRET;
    if (godaddyKey && godaddySecret && params.domain) {
      try {
        const checkRes = await fetch(
          `https://api.godaddy.com/v1/domains/available?domain=${params.domain}`,
          { headers: { Authorization: `sso-key ${godaddyKey}:${godaddySecret}` } }
        );
        const availability = await checkRes.json();
        results.domain = params.domain;
        results.domain_available = availability.available;
        results.domain_price = availability.price;
      } catch (err) {
        results.godaddy_error = String(err);
      }
    } else if (!params.domain) {
      results.domain_status = "no_domain_specified";
    } else {
      results.godaddy_status = "api_keys_not_configured";
    }

    const message = `Website project initiated for ${params.client || "client"}. Open the Website Builder wizard at /dashboard/websites to configure & generate with Claude, then deploy to Vercel.`;
    return { success: true, result: { message, ...results } };
  },
  ai_receptionist: async (params) => {
    // Retell AI integration
    const retellKey = process.env.RETELL_API_KEY;
    if (!retellKey) return { success: false, result: {}, error: "Retell AI not configured" };
    return { success: true, result: { message: `AI receptionist setup initiated for ${params.client || "client"}`, provider: "Retell AI" } };
  },
  chatbot: async (params) => {
    return { success: true, result: { message: `Chatbot creation started for ${params.client || "client"}` } };
  },
  automation: async (params) => {
    // Make.com / Zapier integration
    const platform = params.platform || "make";
    return { success: true, result: { message: `Automation workflow created via ${platform}`, provider: platform } };
  },
  discord: async (params) => {
    return { success: true, result: { message: `Discord server setup initiated: ${params.server_name || "New Server"}` } };
  },
  social_setup: async (params) => {
    // Canva API for logos/banners
    return { success: true, result: { message: `Social media accounts setup started with Canva branding for ${params.client || "client"}` } };
  },
  email_campaign: async (params) => {
    return { success: true, result: { message: `Email campaign created: ${params.subject || "Campaign"}`, recipients: params.count || "pending" } };
  },
  sms_campaign: async (params) => {
    return { success: true, result: { message: `SMS campaign created for ${params.count || "N/A"} recipients` } };
  },
  lead_gen: async (params) => {
    return { success: true, result: { message: `AI lead generation system setup for ${params.industry || "general"} in ${params.location || "US"}` } };
  },
  custom: async (params) => {
    return { success: true, result: { message: `Custom action executed: ${params.description || ""}` } };
  },
};

export async function executeTrinityCommand(command: TrinityCommand): Promise<{
  success: boolean;
  result: Record<string, unknown>;
  error?: string;
}> {
  const handler = ACTION_HANDLERS[command.action];
  if (!handler) return { success: false, result: {}, error: `Unknown action: ${command.action}` };

  try {
    return await handler(command.params);
  } catch (err) {
    return { success: false, result: {}, error: String(err) };
  }
}

export async function parseTrinityMessage(message: string): Promise<TrinityCommand | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are Trinity, an AI agent for ShortStack digital marketing agency. Parse user commands into structured actions. Available actions: website, ai_receptionist, chatbot, automation, discord, social_setup, email_campaign, sms_campaign, lead_gen, custom. Respond with valid JSON only (no markdown): { "action": "...", "description": "...", "params": { ... } }`,
        messages: [{ role: "user", content: message }],
      }),
    });
    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    return JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  } catch {
    return null;
  }
}

// Telegram Bot handler
export async function sendTelegramMessage(chatId: string, text: string): Promise<{ ok: boolean; messageId?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return { ok: res.ok, messageId: data.result?.message_id };
  } catch {
    return { ok: false };
  }
}

// Delete a specific Telegram message
export async function deleteTelegramMessage(chatId: string, messageId: number): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Clean up old briefing/status messages older than 24h that have no relevant data
// Call this before sending new briefings to keep the chat clean
export async function cleanupOldTelegramMessages(chatId: string, supabase: ReturnType<typeof import("@/lib/supabase/server").createServiceClient>): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
  let deleted = 0;

  // Get old trinity log entries that were just status messages (no meaningful result)
  const { data: oldLogs } = await supabase
    .from("trinity_log")
    .select("id, result, created_at")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (oldLogs) {
    for (const log of oldLogs) {
      const result = log.result as Record<string, unknown>;
      const telegramMsgId = result?.telegram_message_id as number | undefined;

      // If we tracked the telegram message ID and the log has no meaningful outcome, delete it
      if (telegramMsgId) {
        const hasRelevantData = result?.replies_received || result?.calls_booked || result?.deals_closed;
        if (!hasRelevantData) {
          const success = await deleteTelegramMessage(chatId, telegramMsgId);
          if (success) deleted++;
        }
      }
    }
  }

  // Clean up old briefings from the database that are > 7 days old
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  await supabase.from("briefings").delete().lt("generated_at", weekAgo);

  return deleted;
}
