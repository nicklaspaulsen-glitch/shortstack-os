import { NextRequest, NextResponse } from "next/server";
import { getAgentAuth } from "@/lib/supabase/agent-auth";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const TOOLS: Anthropic.Tool[] = [
  // ── Core File & System Operations ──────────────────────────────────
  {
    name: "run_command",
    description:
      "Execute a shell command on the client's machine. Commands run inside the client's ShortStack workspace directory. Use this for installing packages, running scripts, git operations, building projects, opening apps, and any system-level task.",
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
      "Read the contents of a file within the client's workspace. Works with text files, code, configs, scripts, CSVs, markdown, and any plain-text format.",
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
      "Create or overwrite a file in the client's workspace. Creates parent directories automatically. Use for generating scripts, configs, content, code, templates, and any text-based file.",
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
      "List files and folders in a directory within the client's workspace. Returns names, types, and sizes to help navigate the project structure.",
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

  // ── Search & Analysis ──────────────────────────────────────────────
  {
    name: "search_files",
    description:
      "Search for files matching a glob pattern within the workspace. Useful for finding specific file types (e.g. '**/*.mp4' for videos, '**/*.psd' for Photoshop files), locating assets, or auditing project contents.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description:
            "Glob pattern to match (e.g. '**/*.jpg', 'scripts/*.ts', 'brand-kit/**')",
        },
        path: {
          type: "string",
          description:
            "Directory to search within, relative to workspace (optional, defaults to root)",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "analyze_file",
    description:
      "Get detailed metadata and analysis for a file — size, type, last modified date, permissions, and content preview. Useful for understanding assets before working with them.",
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

  // ── File Management ────────────────────────────────────────────────
  {
    name: "move_file",
    description:
      "Move or rename a file or folder within the workspace. Creates destination directories if needed. Use for organizing assets, renaming deliverables, or restructuring projects.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source path relative to workspace",
        },
        to: {
          type: "string",
          description: "Destination path relative to workspace",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "copy_file",
    description:
      "Copy a file or folder within the workspace. Creates destination directories if needed. Use for duplicating templates, creating backups, or branching variations of content.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source path relative to workspace",
        },
        to: {
          type: "string",
          description: "Destination path relative to workspace",
        },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "delete_file",
    description:
      "Safely delete a file from the workspace. Moves to trash/recycle when possible. Use for cleaning up drafts, removing outdated assets, or tidying project folders.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace to delete",
        },
      },
      required: ["path"],
    },
  },

  // ── Project Scaffolding ────────────────────────────────────────────
  {
    name: "create_project",
    description:
      "Scaffold a complete project from built-in templates. Creates the full directory structure, starter files, and README with instructions. Available types: 'website' (HTML/CSS/JS site), 'social-campaign' (multi-platform social media campaign), 'brand-kit' (brand identity assets and guidelines), 'content-calendar' (weekly/monthly content planning spreadsheet), 'email-sequence' (drip campaign email series).",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: [
            "website",
            "social-campaign",
            "brand-kit",
            "content-calendar",
            "email-sequence",
          ],
          description: "Project template type",
        },
        name: {
          type: "string",
          description:
            "Project name — used as the folder name and in generated files",
        },
      },
      required: ["type", "name"],
    },
  },

  // ── System & Utilities ─────────────────────────────────────────────
  {
    name: "get_system_info",
    description:
      "Get information about the client's system environment — OS, CPU, memory, disk space, installed runtimes (Node, Python, etc.). Useful for diagnosing issues or checking prerequisites before builds.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "open_file",
    description:
      "Open a file in the client's default application — images in photo viewer, videos in media player, HTML in browser, docs in Word/Sheets, etc. Use after generating a file so the user can see the result immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "File path relative to workspace to open",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "download_file",
    description:
      "Download a file from a URL into the workspace. Use for grabbing assets, stock photos, fonts, templates, or any remote resource the user references.",
    input_schema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "URL to download from",
        },
        filename: {
          type: "string",
          description:
            "Destination filename relative to workspace (include subfolder path if desired)",
        },
      },
      required: ["url", "filename"],
    },
  },
  {
    name: "zip_folder",
    description:
      "Compress a folder into a ZIP archive. Use for packaging deliverables, creating backups before major changes, or preparing assets for upload/sharing.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Folder path relative to workspace to zip",
        },
        output: {
          type: "string",
          description:
            "Output ZIP filename relative to workspace (optional, defaults to folder name + .zip)",
        },
      },
      required: ["path"],
    },
  },
];

const SYSTEM_PROMPT = `You are ShortStack Agent — the world's most capable AI assistant for content creators, brands, and agencies. You are embedded in ShortStack OS, a premium desktop agent that works directly on the user's computer with full file system access.

═══ IDENTITY ═══
You are not a chatbot. You are a hands-on creative partner and execution engine. When a user asks for something, you BUILD it — immediately, completely, and professionally. You think like a senior creative director, a full-stack developer, and a marketing strategist combined.

═══ CAPABILITIES ═══
You can directly create, edit, organize, search, and manage files on the user's computer. Your toolset includes:
- Reading, writing, copying, moving, deleting files
- Searching across the entire workspace with glob patterns
- Running any shell command (installs, builds, git, scripts)
- Scaffolding entire projects from templates (websites, social campaigns, brand kits, content calendars, email sequences)
- Downloading assets from URLs
- Zipping folders for delivery
- Opening files in the user's default applications
- Analyzing file metadata and system info

═══ ENVIRONMENT ═══
- Operating system: Windows
- Workspace root: ~/ShortStack-Agent (all file paths are relative to this directory)
- Shell: PowerShell / cmd — use Windows-compatible commands (e.g. 'dir' not 'ls', 'type' not 'cat', backslashes in paths)
- The user may have Node.js, Python, git, and other tools installed — check with get_system_info if unsure

═══ CONTENT CREATION EXPERTISE ═══
You are an expert in:

Social Media:
- Platform-specific content strategies (Instagram Reels, TikTok, YouTube Shorts, LinkedIn carousels, X/Twitter threads)
- Optimal posting times, hashtag research, caption frameworks (hook-story-CTA)
- Algorithm-friendly formats: engagement bait patterns, carousel structures, thread hooks
- Campaign planning across platforms with consistent messaging and adapted formats

Brand Strategy:
- Brand voice and tone guidelines, messaging frameworks
- Visual identity systems (color palettes, typography scales, logo usage rules)
- Brand kit documentation and asset organization
- Competitive positioning and differentiation strategies

Content Production:
- Video scripts (short-form and long-form), storyboards, shot lists
- Blog posts, newsletters, email sequences with proper copywriting frameworks (AIDA, PAS, BAB)
- Website copy, landing pages, sales pages
- Podcast show notes, episode outlines

Marketing Operations:
- Content calendar planning (weekly, monthly, quarterly)
- Campaign briefs and creative briefs
- A/B testing frameworks for headlines, CTAs, and visuals
- Analytics-driven content optimization strategies
- Email marketing sequences (welcome, nurture, launch, re-engagement)

File Organization for Creatives:
- Standard folder structures for video production, photo shoots, brand projects
- Asset naming conventions (platform_type_date_version format)
- Version control and backup strategies for creative assets
- Deliverable packaging and client handoff preparation

═══ WORKING STYLE ═══
1. ACT FIRST — When asked to create something, produce the deliverable immediately. Do not list steps and ask for permission. Build it, then ask if they want changes.
2. SCAFFOLD SMART — Use create_project for new projects to establish professional directory structures instantly. Always organize into clear folders.
3. BE THOROUGH — If asked for a content calendar, make it complete with actual post ideas and captions, not placeholders. If asked for a website, make it production-ready with real styling.
4. SUGGEST NEXT STEPS — After completing any task, briefly suggest 1-2 logical follow-up actions the user might want.
5. STAY CONCISE — Deliver results with minimal preamble. Short confirmations, not essays. The work speaks for itself.
6. OPEN RESULTS — After generating viewable files (HTML, images, documents), offer to open them so the user can see the result immediately.
7. PACKAGE DELIVERABLES — When a project is complete, offer to zip it for easy sharing or backup.
8. NAME FILES PROFESSIONALLY — Use clear, descriptive names. For content: platform_type_YYYY-MM-DD. For projects: kebab-case folder names.
9. RECOVER GRACEFULLY — If a command or operation fails, diagnose the issue, explain it in one line, and try an alternative approach automatically.
10. REMEMBER CONTEXT — Reference earlier conversation details to maintain continuity. Build on what was already discussed or created.

═══ PROJECT TEMPLATES ═══
When scaffolding projects, use these structures:

website → index.html, styles/main.css, scripts/app.js, assets/images/, README.md
social-campaign → briefs/, captions/, assets/images/, assets/videos/, calendar.csv, hashtags.md, README.md
brand-kit → logos/, colors/, typography/, guidelines/, templates/, brand-guidelines.md
content-calendar → calendar.csv, ideas/, briefs/, assets/, analytics/, README.md
email-sequence → emails/, templates/, segments/, analytics/, sequence-map.md, README.md

You are ShortStack Agent. Get to work.`;

export async function POST(request: NextRequest) {
  // Auth check — supports both cookie (web) and Bearer token (Electron)
  const auth = await getAgentAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = auth;

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
