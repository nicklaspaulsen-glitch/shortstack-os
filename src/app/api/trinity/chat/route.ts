import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseTrinityMessage, executeTrinityCommand } from "@/lib/services/trinity";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json();

  // Step 1: Determine if this is an ACTION request or just CONVERSATION
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    try {
      const classifyRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          system: `You are Trinity, the AI assistant for ShortStack digital marketing agency OS. You help agency owners manage their business.

If the user is making casual conversation (greetings, questions, small talk), respond naturally and helpfully. Be friendly, brief, and professional.

If the user is requesting a SPECIFIC ACTION (build website, generate leads, create campaign, set up receptionist, run outreach, etc), respond with exactly: ACTION: [describe the action]

Examples:
- "hey" → friendly greeting (NOT an action)
- "how are you" → casual response (NOT an action)
- "what can you do" → explain your capabilities (NOT an action)
- "build a website for Bright Smile Dental" → ACTION: build website for Bright Smile Dental
- "generate 50 leads for dentists in Miami" → ACTION: generate leads for dentists in Miami
- "set up AI receptionist for my client" → ACTION: set up AI receptionist`,
          messages: [{ role: "user", content: message }],
        }),
      });

      const classifyData = await classifyRes.json();
      const response = classifyData.content?.[0]?.text || "";

      // If it's just conversation, return the AI response directly
      if (!response.startsWith("ACTION:")) {
        return NextResponse.json({ reply: response, success: true });
      }

      // It's an action — proceed with command execution
    } catch {
      // If classification fails, fall through to command parsing
    }
  }

  // Step 2: Parse and execute as action command
  const command = await parseTrinityMessage(message);

  if (!command) {
    return NextResponse.json({
      reply: "I'm not sure what action to take. You can ask me to:\n\n• Build a website for a client\n• Set up an AI receptionist\n• Generate leads for an industry\n• Run an email campaign\n• Create content scripts\n\nOr just chat with me — I'm happy to help with anything!",
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
    ? `Done! ${result.result.message || command.description}\n\nAction: ${command.action}\nStatus: Completed`
    : `Failed: ${result.error || "Unknown error"}\n\nI logged this issue. Please check the configuration for ${command.action}.`;

  return NextResponse.json({ reply, success: result.success });
}
