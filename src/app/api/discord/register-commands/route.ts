import { NextResponse } from "next/server";

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
];

export async function POST() {
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
