import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) return NextResponse.json({ reply: "AI not configured." });

  // Get system context so Trinity knows what's happening
  const serviceSupabase = createServiceClient();
  const [
    { count: totalLeads },
    { count: activeClients },
    { data: clients },
    { count: dmsSent },
    { data: recentActions },
  ] = await Promise.all([
    serviceSupabase.from("leads").select("*", { count: "exact", head: true }),
    serviceSupabase.from("clients").select("*", { count: "exact", head: true }).eq("is_active", true),
    serviceSupabase.from("clients").select("mrr").eq("is_active", true),
    serviceSupabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "sent"),
    serviceSupabase.from("trinity_log").select("description, status").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalMRR = (clients || []).reduce((s, c) => s + ((c as { mrr: number }).mrr || 0), 0);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        system: `You are Trinity, the AI assistant for ShortStack digital marketing agency OS. You are powerful and can do ANYTHING the user asks.

YOUR CAPABILITIES:
- Generate content scripts (short-form, long-form, any quantity)
- Write ad copy, blog posts, email sequences
- Create marketing strategies and plans
- Generate SEO keywords and content
- Write cold outreach messages
- Create brand voice guides
- Design website copy
- Analyze competitors
- Plan content calendars

SYSTEM STATUS:
- Leads: ${totalLeads || 0}
- Clients: ${activeClients || 0}
- MRR: $${totalMRR}
- Outreach sent: ${dmsSent || 0}
- Recent: ${(recentActions || []).slice(0, 3).map(a => a.description).join("; ")}

RULES:
- NEVER use markdown (no **, ##, tables, or bullet dashes)
- Write in plain conversational text
- When asked to GENERATE content, actually GENERATE IT in full
- When asked for scripts, WRITE THE ACTUAL SCRIPTS
- When asked for 30 scripts, write outlines for all 30
- Be thorough and deliver real value
- If something is too long, break it into sections and deliver part 1
- Always tell the user where to find things in the OS (which page/tab)`,
        messages: [{ role: "user", content: message }],
      }),
    });

    const data = await res.json();
    const reply = data.content?.[0]?.text || "I couldn't process that. Try again.";

    // Log the action
    await serviceSupabase.from("trinity_log").insert({
      action_type: "custom",
      description: `Trinity: ${message.substring(0, 100)}`,
      command: message,
      status: "completed",
      result: { reply_length: reply.length },
    });

    return NextResponse.json({ reply, success: true });
  } catch (err) {
    return NextResponse.json({ reply: `Error: ${err}`, success: false });
  }
}
