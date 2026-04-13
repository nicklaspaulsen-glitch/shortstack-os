import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import nacl from "tweetnacl";

// --- Discord Interaction types ---
const INTERACTION_PING = 1;
const INTERACTION_APPLICATION_COMMAND = 2;
const RESPONSE_PONG = 1;
const RESPONSE_CHANNEL_MESSAGE = 4;

const GOLD = 0xc9a84c;

// --- Signature verification ---
function verifyDiscordSignature(
  body: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(publicKey, "hex");
    const msg = Buffer.from(timestamp + body);
    return nacl.sign.detached.verify(msg, sig, key);
  } catch {
    return false;
  }
}

// --- Embed helper ---
function embed(
  title: string,
  description: string,
  fields?: { name: string; value: string; inline?: boolean }[]
) {
  return {
    type: RESPONSE_CHANNEL_MESSAGE,
    data: {
      embeds: [
        {
          title,
          description,
          color: GOLD,
          fields: fields || [],
          footer: { text: "ShortStack OS" },
          timestamp: new Date().toISOString(),
        },
      ],
    },
  };
}

// --- Command handlers ---

async function handleStatus() {
  const supabase = createServiceClient();

  const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [agentActivity, leadsToday, activeClients] = await Promise.all([
    supabase
      .from("trinity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", twentyFourAgo),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  return embed("System Status", "Live snapshot of ShortStack OS activity.", [
    {
      name: "Agent Actions (24h)",
      value: `${agentActivity.count ?? 0}`,
      inline: true,
    },
    {
      name: "Leads Today",
      value: `${leadsToday.count ?? 0}`,
      inline: true,
    },
    {
      name: "Active Clients",
      value: `${activeClients.count ?? 0}`,
      inline: true,
    },
  ]);
}

async function handleLeads() {
  const supabase = createServiceClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("name, category, city")
    .order("created_at", { ascending: false })
    .limit(5);

  if (!leads || leads.length === 0) {
    return embed("Recent Leads", "No leads found yet. Start scraping to populate this list.");
  }

  const fields = leads.map((l, i) => ({
    name: `${i + 1}. ${l.name || "Unnamed"}`,
    value: `${l.category || "N/A"} | ${l.city || "N/A"}`,
    inline: false,
  }));

  return embed("Recent Leads", `Last ${leads.length} scraped leads:`, fields);
}

async function handleClients() {
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("business_name, mrr, health_score")
    .eq("is_active", true)
    .order("mrr", { ascending: false })
    .limit(10);

  if (!clients || clients.length === 0) {
    return embed("Active Clients", "No active clients found.");
  }

  const fields = clients.map((c) => ({
    name: c.business_name || "Unnamed",
    value: `MRR: $${c.mrr ?? 0} | Health: ${c.health_score ?? "N/A"}`,
    inline: true,
  }));

  return embed("Active Clients", `${clients.length} active client(s):`, fields);
}

async function handleReport() {
  const supabase = createServiceClient();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [mrrResult, leadsWeek, outreachWeek] = await Promise.all([
    supabase.from("clients").select("mrr").eq("is_active", true),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase
      .from("outreach_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekAgo),
  ]);

  const totalMRR =
    mrrResult.data?.reduce((sum, c) => sum + (c.mrr || 0), 0) ?? 0;

  return embed("Weekly Report", "Performance summary for the past 7 days.", [
    {
      name: "Total MRR",
      value: `$${totalMRR.toLocaleString()}`,
      inline: true,
    },
    {
      name: "Leads This Week",
      value: `${leadsWeek.count ?? 0}`,
      inline: true,
    },
    {
      name: "Outreach Sent",
      value: `${outreachWeek.count ?? 0}`,
      inline: true,
    },
  ]);
}

async function handlePipeline() {
  const supabase = createServiceClient();

  const statuses = ["new", "contacted", "qualified", "converted", "lost"];

  const counts = await Promise.all(
    statuses.map((status) =>
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
    )
  );

  const fields = statuses.map((status, i) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: `${counts[i].count ?? 0}`,
    inline: true,
  }));

  const total = counts.reduce((sum, c) => sum + (c.count ?? 0), 0);

  return embed(
    "Lead Pipeline",
    `${total} total leads across all stages.`,
    fields
  );
}

async function handleRevenue() {
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("business_name, mrr")
    .eq("is_active", true)
    .order("mrr", { ascending: false });

  if (!clients || clients.length === 0) {
    return embed("Revenue Dashboard", "No active clients found.");
  }

  const totalMRR = clients.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const avgMRR = clients.length > 0 ? totalMRR / clients.length : 0;
  const topEarner = clients[0];

  return embed("Revenue Dashboard", "Current revenue metrics at a glance.", [
    {
      name: "Total MRR",
      value: `$${totalMRR.toLocaleString()}`,
      inline: true,
    },
    {
      name: "Avg MRR / Client",
      value: `$${avgMRR.toFixed(2)}`,
      inline: true,
    },
    {
      name: "Active Clients",
      value: `${clients.length}`,
      inline: true,
    },
    {
      name: "Top Earner",
      value: `${topEarner.business_name || "Unnamed"} — $${topEarner.mrr ?? 0}/mo`,
      inline: false,
    },
  ]);
}

function handleUptime() {
  return embed("System Health", "All Systems Operational", [
    {
      name: "Status",
      value: "Online",
      inline: true,
    },
    {
      name: "Node Version",
      value: process.version,
      inline: true,
    },
    {
      name: "Checked At",
      value: new Date().toLocaleString("en-US", { timeZone: "UTC" }) + " UTC",
      inline: true,
    },
  ]);
}

async function handleLeaderboard() {
  const supabase = createServiceClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("business_name, mrr")
    .eq("is_active", true)
    .order("mrr", { ascending: false })
    .limit(5);

  if (!clients || clients.length === 0) {
    return embed("Leaderboard", "No active clients to rank.");
  }

  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  const lines = clients.map(
    (c, i) =>
      `${medals[i]} **${c.business_name || "Unnamed"}** — $${c.mrr ?? 0}/mo`
  );

  return embed("Client Leaderboard", "Top 5 clients by MRR:\n\n" + lines.join("\n"));
}

function handleAnnounce(interaction: { data?: { options?: { name: string; value: string }[] } }) {
  const options = interaction.data?.options || [];
  const messageOpt = options.find((o) => o.name === "message");
  const message = messageOpt?.value || "No message provided.";

  return embed("Announcement", message, [
    {
      name: "Posted By",
      value: "ShortStack OS",
      inline: true,
    },
  ]);
}

function handleHelp() {
  return embed(
    "ShortStack Bot Commands",
    "Available slash commands for managing your agency:",
    [
      {
        name: "/status",
        value: "View agent activity, leads today, and active client count.",
        inline: false,
      },
      {
        name: "/leads",
        value: "Show the last 5 scraped leads with name, category, and city.",
        inline: false,
      },
      {
        name: "/clients",
        value: "List active clients with MRR and health scores.",
        inline: false,
      },
      {
        name: "/report",
        value: "Weekly summary: total MRR, leads, and outreach sent.",
        inline: false,
      },
      {
        name: "/pipeline",
        value: "Lead pipeline breakdown by status.",
        inline: false,
      },
      {
        name: "/revenue",
        value: "Revenue dashboard with total MRR, avg MRR, and top earner.",
        inline: false,
      },
      {
        name: "/uptime",
        value: "Check system health and API status.",
        inline: false,
      },
      {
        name: "/leaderboard",
        value: "Top 5 clients ranked by MRR.",
        inline: false,
      },
      {
        name: "/announce",
        value: "Post a formatted announcement to the channel.",
        inline: false,
      },
      {
        name: "/help",
        value: "Show this list of available commands.",
        inline: false,
      },
    ]
  );
}

// --- Main handler ---

export async function POST(request: NextRequest) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    return NextResponse.json(
      { error: "DISCORD_PUBLIC_KEY not configured" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  const body = await request.text();

  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  if (!verifyDiscordSignature(body, signature, timestamp, publicKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body);

  // Type 1 — PING
  if (interaction.type === INTERACTION_PING) {
    return NextResponse.json({ type: RESPONSE_PONG });
  }

  // Type 2 — Slash command
  if (interaction.type === INTERACTION_APPLICATION_COMMAND) {
    const commandName = interaction.data?.name;

    try {
      let response;
      switch (commandName) {
        case "status":
          response = await handleStatus();
          break;
        case "leads":
          response = await handleLeads();
          break;
        case "clients":
          response = await handleClients();
          break;
        case "report":
          response = await handleReport();
          break;
        case "pipeline":
          response = await handlePipeline();
          break;
        case "revenue":
          response = await handleRevenue();
          break;
        case "uptime":
          response = handleUptime();
          break;
        case "leaderboard":
          response = await handleLeaderboard();
          break;
        case "announce":
          response = handleAnnounce(interaction);
          break;
        case "help":
          response = handleHelp();
          break;
        default:
          response = embed(
            "Unknown Command",
            `Command \`/${commandName}\` is not recognized. Use \`/help\` to see available commands.`
          );
      }
      return NextResponse.json(response);
    } catch (err) {
      return NextResponse.json(
        embed("Error", `Something went wrong: ${String(err)}`)
      );
    }
  }

  return NextResponse.json({ error: "Unhandled interaction type" }, { status: 400 });
}
