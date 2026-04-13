import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

const COMMANDS = [
  {
    name: "status",
    description: "View agent activity, leads today, and active client count",
    type: 1,
  },
  {
    name: "leads",
    description: "Show the last 5 scraped leads with name, category, and city",
    type: 1,
  },
  {
    name: "clients",
    description: "List active clients with MRR and health scores",
    type: 1,
  },
  {
    name: "report",
    description: "Weekly summary of MRR, leads, and outreach activity",
    type: 1,
  },
  {
    name: "help",
    description: "Show all available ShortStack bot commands",
    type: 1,
  },
  {
    name: "pipeline",
    description:
      "View lead pipeline breakdown by status (new, contacted, qualified, converted)",
    type: 1,
  },
  {
    name: "revenue",
    description:
      "Revenue dashboard with total MRR, average MRR per client, and top earner",
    type: 1,
  },
  {
    name: "uptime",
    description: "Check system health and API status",
    type: 1,
  },
  {
    name: "leaderboard",
    description: "Top 5 clients ranked by MRR",
    type: 1,
  },
  {
    name: "announce",
    description: "Post an announcement to the channel",
    type: 1,
    options: [
      {
        name: "message",
        description: "The announcement message to post",
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

export async function POST() {
  // Auth check — only authenticated admin users should register Discord commands
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APP_ID;

  if (!botToken || !appId) {
    return NextResponse.json(
      { error: "Missing DISCORD_BOT_TOKEN or DISCORD_APP_ID env vars." },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/applications/${appId}/commands`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(COMMANDS),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: "Discord API error", details: data },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      registered: Array.isArray(data) ? data.length : 0,
      commands: Array.isArray(data)
        ? data.map((c: { name: string; id: string }) => ({
            name: c.name,
            id: c.id,
          }))
        : data,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
