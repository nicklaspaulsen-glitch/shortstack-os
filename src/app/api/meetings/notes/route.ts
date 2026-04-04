import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Meeting Notes Generator — Paste call transcript, get structured notes + action items
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript, client_id, meeting_type } = await request.json();

  let clientName = "";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: "You are an executive assistant. Create structured meeting notes from transcripts. Return valid JSON only.",
      messages: [{ role: "user", content: `Generate meeting notes from this ${meeting_type || "call"} transcript${clientName ? ` with ${clientName}` : ""}:

${transcript}

Return JSON with:
- meeting_summary: 2-3 sentence overview
- date: today's date
- attendees: array of names mentioned
- key_discussion_points: array of { topic, details, decision_made }
- action_items: array of { task, assigned_to, deadline_suggestion, priority }
- client_sentiment: "positive" | "neutral" | "concerned"
- follow_up_needed: boolean
- follow_up_email_draft: { subject, body } (ready to send)
- internal_notes: things to note for the team (not to share with client)` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const notes = JSON.parse(cleaned);

    // Auto-create tasks from action items
    if (notes.action_items && client_id) {
      for (const item of notes.action_items) {
        await supabase.from("client_tasks").insert({
          client_id,
          title: item.task,
          description: `From meeting notes: ${item.details || ""}`,
          is_completed: false,
          due_date: item.deadline_suggestion || null,
        });
      }
    }

    return NextResponse.json({ success: true, notes, tasks_created: notes.action_items?.length || 0 });
  } catch {
    return NextResponse.json({ success: true, notes: { raw: text } });
  }
}
