import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "run_command",
    description:
      "Execute a shell command on the client's machine. Commands run inside the client's ShortStack workspace directory. Use this for installing packages, running scripts, git operations, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
        cwd: {
          type: "string",
          description:
            "Working directory relative to workspace (optional, defaults to workspace root)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description:
      "Read the contents of a file within the client's workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Create or overwrite a file in the client's workspace. Creates parent directories if needed.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace",
        },
        content: {
          type: "string",
          description: "File content to write",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description:
      "List files and folders in a directory within the client's workspace.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Directory path relative to workspace (optional, defaults to root)",
        },
      },
      required: [],
    },
  },
];

const SYSTEM_PROMPT = `You are a helpful AI assistant embedded in ShortStack OS — a desktop agent that works directly on the client's computer.

You can read files, write files, run shell commands, and list directories within the client's workspace folder.

Guidelines:
- Be concise and action-oriented
- When asked to create something, do it immediately — don't just explain how
- Use run_command for installing packages, running builds, git operations, etc.
- All file paths are relative to the workspace root
- If a task requires multiple steps, execute them in order
- If something fails, diagnose and fix it
- Keep responses short unless the user asks for explanations
- You're running on Windows — use appropriate commands (dir instead of ls, etc.)

You are branded as "ShortStack Agent" — powered by ShortStack OS.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    });

    // Extract text blocks and tool_use blocks
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    return NextResponse.json({
      stop_reason: response.stop_reason,
      text: textBlocks.map((b) => b.text).join("\n"),
      tool_calls: toolBlocks.map((b) => ({
        id: b.id,
        name: b.name,
        input: b.input,
      })),
      // Return full content array for message history reconstruction
      content: response.content,
    });
  } catch (err) {
    console.error("[client-agent]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
