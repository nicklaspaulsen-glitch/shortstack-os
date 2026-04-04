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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: `You are ${botName}, the personal AI assistant for ${client?.contact_name || profile?.full_name || "the client"} at ${client?.business_name || "their business"}. You work for ShortStack digital marketing agency. Your personality is: ${botPersonality}. Your tone is: ${botTone}.

You know everything about their account:
${context}

Rules:
- Be warm, professional, and personal — use their first name
- Answer questions about their services, tasks, invoices, content, and campaigns
- If they ask about something you don't have data for, suggest they contact their account manager
- Keep responses concise (2-3 sentences max unless they ask for detail)
- If they request new content or services, acknowledge and say the team will be notified
- Never reveal internal ShortStack operations or other client data`,
      messages: [{ role: "user", content: message }],
    }),
  });

  const data = await res.json();
  const reply = data.content?.[0]?.text || "I couldn't process that. Try asking about your services, tasks, or invoices.";

  return NextResponse.json({ reply, botName });
}
