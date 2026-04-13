import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Client-facing Trinity AI — Personalized chatbot that knows their business
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json();

  // Get client profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  // Get client data
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  // Get client's tasks, invoices, content
  let context = "";
  if (client) {
    const [{ data: tasks }, { data: invoices }, { data: content }, { data: campaigns }] = await Promise.all([
      supabase.from("client_tasks").select("title, is_completed, due_date").eq("client_id", client.id).limit(10),
      supabase.from("invoices").select("amount, status, due_date, description").eq("client_id", client.id).limit(5),
      supabase.from("content_scripts").select("title, status, created_at").eq("client_id", client.id).limit(5),
      supabase.from("campaigns").select("name, status, spend, conversions, roas").eq("client_id", client.id).limit(5),
    ]);

    context = `
Client: ${client.business_name}
Contact: ${client.contact_name}
Email: ${client.email}
Package: ${client.package_tier || "Growth"}
MRR: $${client.mrr}
Services: ${(client.services || []).join(", ")}
Industry: ${client.industry || "business"}
Health Score: ${client.health_score}%

Tasks: ${tasks?.map(t => `${t.title} (${t.is_completed ? "done" : "pending"}${t.due_date ? `, due ${t.due_date}` : ""})`).join("; ") || "none"}

Invoices: ${invoices?.map(i => `$${i.amount} - ${i.status}${i.due_date ? `, due ${i.due_date}` : ""}`).join("; ") || "none"}

Content: ${content?.map(c => `"${c.title}" - ${c.status}`).join("; ") || "none in production"}

Campaigns: ${campaigns?.map(c => `${c.name} - ${c.status}, $${c.spend} spend, ${c.conversions} conversions, ${c.roas}x ROAS`).join("; ") || "none active"}`;
  }

  // Get custom bot config
  let botName = "Trinity";
  let botPersonality = "professional and friendly";
  let botTone = "warm, helpful, concise";
  if (client) {
    const { data: botConfig } = await supabase
      .from("social_accounts")
      .select("metadata")
      .eq("client_id", client.id)
      .eq("platform", "ai_bot_config")
      .single();
    if (botConfig?.metadata) {
      const cfg = botConfig.metadata as Record<string, string>;
      botName = cfg.name || "Trinity";
      botPersonality = cfg.personality || botPersonality;
      botTone = cfg.tone || botTone;
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ reply: "I'm currently offline. Please contact your account manager.", botName });

  const systemMsg = `You are ${botName}, the personal AI assistant for ${client?.contact_name || profile?.full_name || "the client"} at ${client?.business_name || "their business"}. You work for ShortStack digital marketing agency. Your personality is: ${botPersonality}. Your tone is: ${botTone}.

You know everything about their account:
${context}

Rules:
- Be warm, professional, and personal — use their first name
- Answer questions about their services, tasks, invoices, content, and campaigns
- If they ask about something you don't have data for, suggest they contact their account manager
- Keep responses concise (2-3 sentences max unless they ask for detail)
- If they request new content or services, acknowledge and say the team will be notified
- Never reveal internal ShortStack operations or other client data`;

  // Check if client wants streaming
  const wantsStream = request.headers.get("accept")?.includes("text/event-stream");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      stream: !!wantsStream,
      system: systemMsg,
      messages: [{ role: "user", content: message }],
    }),
  });

  // Streaming response
  if (wantsStream && res.body) {
    const stream = new ReadableStream({
      async start(controller) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            // Parse SSE events, extract text deltas
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6);
                if (jsonStr === "[DONE]") continue;
                try {
                  const event = JSON.parse(jsonStr);
                  if (event.type === "content_block_delta" && event.delta?.text) {
                    fullText += event.delta.text;
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
                  }
                } catch {}
              }
            }
          }
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, fullText, botName })}\n\n`));
        } catch {}
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
  }

  // Non-streaming fallback
  const data = await res.json();
  const reply = data.content?.[0]?.text || "I couldn't process that. Try asking about your services, tasks, or invoices.";

  // Detect client requests and trigger agents automatically
  const lowerMsg = message.toLowerCase();
  const clientId = client?.id;
  let actionTaken = "";

  if (clientId) {
    if (lowerMsg.includes("website") || lowerMsg.includes("landing page") || lowerMsg.includes("web page")) {
      // Create a website request ticket
      await supabase.from("trinity_log").insert({
        agent: "website",
        action_type: "custom",
        description: `Client request: Website — "${message.substring(0, 100)}"`,
        client_id: clientId,
        status: "pending",
        result: { type: "client_request", category: "website", message },
      });
      actionTaken = "website_request";
    }

    if (lowerMsg.includes("content") || lowerMsg.includes("post") || lowerMsg.includes("video") || lowerMsg.includes("reel") || lowerMsg.includes("script")) {
      await supabase.from("trinity_log").insert({
        agent: "content",
        action_type: "content",
        description: `Client request: Content — "${message.substring(0, 100)}"`,
        client_id: clientId,
        status: "pending",
        result: { type: "client_request", category: "content", message },
      });
      actionTaken = "content_request";
    }

    if (lowerMsg.includes("ad") || lowerMsg.includes("campaign") || lowerMsg.includes("facebook ad") || lowerMsg.includes("google ad")) {
      await supabase.from("trinity_log").insert({
        agent: "ads",
        action_type: "ads",
        description: `Client request: Ads — "${message.substring(0, 100)}"`,
        client_id: clientId,
        status: "pending",
        result: { type: "client_request", category: "ads", message },
      });
      actionTaken = "ads_request";
    }

    if (lowerMsg.includes("invoice") || lowerMsg.includes("payment") || lowerMsg.includes("bill")) {
      actionTaken = "billing_inquiry";
    }

    if (lowerMsg.includes("edit") || lowerMsg.includes("revision") || lowerMsg.includes("change")) {
      await supabase.from("trinity_log").insert({
        agent: "production",
        action_type: "custom",
        description: `Client revision request — "${message.substring(0, 100)}"`,
        client_id: clientId,
        status: "pending",
        result: { type: "client_request", category: "revision", message },
      });
      actionTaken = "revision_request";
    }

    // Notify admin on Telegram for any request
    if (actionTaken) {
      const chatIdAdmin = process.env.TELEGRAM_CHAT_ID;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (chatIdAdmin && botToken) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatIdAdmin,
            text: `Client Request from ${client?.business_name}:\n\n"${message.substring(0, 200)}"\n\nCategory: ${actionTaken}\nAgent assigned automatically.`,
          }),
        });
      }
    }
  }

  return NextResponse.json({ reply, botName, actionTaken });
}
