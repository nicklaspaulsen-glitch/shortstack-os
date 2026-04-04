import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseTrinityMessage, executeTrinityCommand } from "@/lib/services/trinity";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json();

  // Parse command with AI
  const command = await parseTrinityMessage(message);

  if (!command) {
    return NextResponse.json({
      reply: "I understand you want help, but I couldn't parse that into a specific action. Try:\n\n• \"Build a website for [client name]\"\n• \"Set up AI receptionist for [client]\"\n• \"Create a Discord server called [name]\"\n• \"Run email campaign for [client]\"\n• \"Generate leads for [industry] in [city]\"",
    });
  }

  // Log it
  const { data: logEntry } = await supabase.from("trinity_log").insert({
    action_type: command.action,
    description: command.description,
    command: message,
    status: "in_progress",
  }).select("id").single();

  // Execute
  const result = await executeTrinityCommand(command);

  // Update log
  if (logEntry) {
    await supabase.from("trinity_log").update({
      status: result.success ? "completed" : "failed",
      result: result.result,
      error_message: result.error || null,
      completed_at: new Date().toISOString(),
    }).eq("id", logEntry.id);
  }

  const reply = result.success
    ? `Done! ${result.result.message || command.description}\n\nAction: ${command.action}\nStatus: Completed ✓`
    : `Failed: ${result.error || "Unknown error"}\n\nI logged this issue. Please check the configuration for ${command.action}.`;

  return NextResponse.json({ reply, success: result.success });
}
