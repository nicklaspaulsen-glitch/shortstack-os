/**
 * Discord Server Setup Script
 * Creates roles, categories, channels, topics, and welcome messages.
 */

const BOT = process.env.DISCORD_BOT_TOKEN;
const GUILD = "1492845816514347121";
const API = "https://discord.com/api/v10";
const h = { Authorization: "Bot " + BOT, "Content-Type": "application/json" };

async function api(method, path, body) {
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (method === "DELETE") return {};
  const d = await r.json();
  if (!r.ok) console.error("ERROR", path, JSON.stringify(d));
  return d;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  // 1. Update role colors
  console.log("--- Updating roles ---");
  const roles = {
    "1492849838105165935": { name: "Admin", color: 0xE74C3C },
    "1492850349470646404": { name: "Moderator", color: 0x3498DB },
    "1492850611853725696": { name: "Client", color: 0x95A5A6 },
    "1492851432930410616": { name: "Member", color: 0x2ECC71 },
    "1492847159056269345": { name: "ShortStack Bot", color: 0xC9A84C },
  };
  for (const [id, data] of Object.entries(roles)) {
    await api("PATCH", "/guilds/" + GUILD + "/roles/" + id, data);
    console.log("  Updated:", data.name);
    await sleep(500);
  }

  const founder = await api("POST", "/guilds/" + GUILD + "/roles", {
    name: "Founder", color: 0xC9A84C, hoist: true, mentionable: true,
  });
  console.log("  Created: Founder -", founder.id);
  await sleep(500);

  const vip = await api("POST", "/guilds/" + GUILD + "/roles", {
    name: "VIP Client", color: 0xF1C40F, hoist: true, mentionable: true,
  });
  console.log("  Created: VIP Client -", vip.id);
  await sleep(500);

  // 2. Create categories
  console.log("\n--- Creating categories ---");
  const infoCategory = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Info", type: 4, position: 0,
  });
  console.log("  Created: Info -", infoCategory.id);
  await sleep(500);

  const communityCategory = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Community", type: 4, position: 1,
  });
  console.log("  Created: Community -", communityCategory.id);
  await sleep(500);

  const supportCategory = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Support & Feedback", type: 4, position: 2,
  });
  console.log("  Created: Support & Feedback -", supportCategory.id);
  await sleep(500);

  const resourcesCategory = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Resources", type: 4, position: 3,
  });
  console.log("  Created: Resources -", resourcesCategory.id);
  await sleep(500);

  const teamCategory = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Team Only", type: 4, position: 4,
    permission_overwrites: [
      { id: GUILD, type: 0, deny: "1024" },
      { id: "1492849838105165935", type: 0, allow: "1024" },
      { id: "1492850349470646404", type: 0, allow: "1024" },
    ],
  });
  console.log("  Created: Team Only -", teamCategory.id);
  await sleep(500);

  // 3. Move existing channels + set topics
  console.log("\n--- Moving channels & setting topics ---");

  await api("PATCH", "/channels/1492852846327234560", {
    parent_id: infoCategory.id, position: 0,
    topic: "Server rules and community guidelines. Read before posting.",
  });
  console.log("  Moved: rules -> Info");
  await sleep(500);

  await api("PATCH", "/channels/1492846003580178442", {
    parent_id: infoCategory.id, position: 1,
    topic: "Official ShortStack OS updates, launches, and news.",
  });
  console.log("  Moved: announcements -> Info");
  await sleep(500);

  await api("PATCH", "/channels/1492845817449545790", {
    parent_id: communityCategory.id, position: 0,
    topic: "Chat about anything ShortStack \u2014 agency life, growth, ideas.",
  });
  console.log("  Moved: general -> Community");
  await sleep(500);

  await api("PATCH", "/channels/1492846321873195161", {
    parent_id: communityCategory.id, position: 2,
    topic: "Show off your agency wins, setups, dashboards, and client results.",
  });
  console.log("  Moved: showcase -> Community");
  await sleep(500);

  await api("PATCH", "/channels/1492846116004429884", {
    parent_id: supportCategory.id, position: 0,
    topic: "Need help? Post your question and the team will assist.",
  });
  console.log("  Moved: support -> Support & Feedback");
  await sleep(500);

  await api("PATCH", "/channels/1492846232203432141", {
    parent_id: supportCategory.id, position: 1,
    topic: "Share ideas for new features and vote on community suggestions.",
  });
  console.log("  Moved: feature-requests -> Support & Feedback");
  await sleep(500);

  await api("PATCH", "/channels/1492846414974156890", {
    parent_id: resourcesCategory.id, position: 0,
    topic: "Share and discover agency automation tips, workflows, and hacks.",
  });
  console.log("  Moved: tips-and-tricks -> Resources");
  await sleep(500);

  await api("PATCH", "/channels/1492852846327234563", {
    parent_id: teamCategory.id, position: 0,
    topic: "Internal team discussions. Not visible to members.",
  });
  console.log("  Moved: moderator-only -> Team Only");
  await sleep(500);

  // 4. Create new channels
  console.log("\n--- Creating new channels ---");

  const changelog = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "changelog", type: 0, parent_id: infoCategory.id, position: 2,
    topic: "Track every ShortStack OS update, fix, and feature release.",
  });
  console.log("  Created: changelog -", changelog.id);
  await sleep(500);

  const intros = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "introductions", type: 0, parent_id: communityCategory.id, position: 1,
    topic: "New here? Introduce yourself and your agency. We want to know you!",
  });
  console.log("  Created: introductions -", intros.id);
  await sleep(500);

  const wins = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "wins", type: 0, parent_id: communityCategory.id, position: 3,
    topic: "Celebrate your wins \u2014 new clients, milestones, revenue goals hit.",
  });
  console.log("  Created: wins -", wins.id);
  await sleep(500);

  const bugs = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "bug-reports", type: 0, parent_id: supportCategory.id, position: 2,
    topic: "Found a bug? Report it here with steps to reproduce.",
  });
  console.log("  Created: bug-reports -", bugs.id);
  await sleep(500);

  const resources = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "resources", type: 0, parent_id: resourcesCategory.id, position: 1,
    topic: "Helpful links, templates, tools, and guides for agency operators.",
  });
  console.log("  Created: resources -", resources.id);
  await sleep(500);

  const faq = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "faq", type: 0, parent_id: resourcesCategory.id, position: 2,
    topic: "Frequently asked questions about ShortStack OS.",
  });
  console.log("  Created: faq -", faq.id);
  await sleep(500);

  const botcmds = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "bot-commands", type: 0, parent_id: teamCategory.id, position: 1,
    topic: "Use /slash commands to interact with ShortStack Bot.",
    permission_overwrites: [
      { id: GUILD, type: 0, deny: "1024" },
      { id: "1492849838105165935", type: 0, allow: "1024" },
      { id: "1492850349470646404", type: 0, allow: "1024" },
    ],
  });
  console.log("  Created: bot-commands -", botcmds.id);
  await sleep(500);

  const cowork = await api("POST", "/guilds/" + GUILD + "/channels", {
    name: "Coworking", type: 2, parent_id: "1492845817449545789", position: 1,
  });
  console.log("  Created: Coworking (voice) -", cowork.id);
  await sleep(500);

  // 5. Clean up old empty category
  console.log("\n--- Cleaning up ---");
  await api("DELETE", "/channels/1492845817449545788");
  console.log("  Deleted: old Text Channels category");
  await sleep(500);

  // 6. Post welcome announcement
  console.log("\n--- Posting messages ---");
  await api("POST", "/channels/1492846003580178442/messages", {
    embeds: [{
      title: "Welcome to ShortStack OS",
      description: "The agency operating system that runs your business on autopilot.\n\nThis is the official ShortStack community \u2014 where agency owners, operators, and the ShortStack team connect.",
      color: 0xC9A84C,
      fields: [
        {
          name: "What you'll find here",
          value: "**#general** \u2014 Chat with the community\n**#introductions** \u2014 Tell us about you\n**#showcase** \u2014 Show off your wins\n**#support** \u2014 Get help from the team\n**#feature-requests** \u2014 Shape the product\n**#tips-and-tricks** \u2014 Learn from each other",
        },
        {
          name: "Bot Commands",
          value: "Use `/help` to see all available ShortStack Bot commands.\nTry `/status`, `/leads`, `/revenue`, and more.",
        },
        {
          name: "Stay Updated",
          value: "Follow **#announcements** and **#changelog** for the latest updates.",
        },
      ],
      footer: { text: "ShortStack OS \u2014 Built for agencies that move fast." },
      timestamp: new Date().toISOString(),
    }],
  });
  console.log("  Posted welcome announcement");
  await sleep(500);

  await api("POST", "/channels/" + intros.id + "/messages", {
    embeds: [{
      title: "Introduce Yourself!",
      description: "Welcome to the ShortStack community. Tell us a bit about yourself:\n\n**1.** What's your name?\n**2.** What does your agency do?\n**3.** How many clients do you manage?\n**4.** What's your biggest challenge right now?\n**5.** What made you try ShortStack OS?",
      color: 0xC9A84C,
      footer: { text: "We read every intro. Don't be shy!" },
    }],
  });
  console.log("  Posted intro prompt");
  await sleep(500);

  await api("POST", "/channels/" + faq.id + "/messages", {
    embeds: [{
      title: "Frequently Asked Questions",
      description: "Common questions about ShortStack OS:",
      color: 0xC9A84C,
      fields: [
        { name: "What is ShortStack OS?", value: "An all-in-one agency operating system \u2014 CRM, automations, AI agents, client portal, content management, billing, and more." },
        { name: "How do I get started?", value: "Download the desktop app from shortstack.work, activate your license, and follow the onboarding flow." },
        { name: "Can I use it for my clients?", value: "Yes! Each client gets their own portal with AI-powered assistance, content calendar, billing, and reporting." },
        { name: "What AI features are included?", value: "Lead scraping, content generation, marketing plans, client bot customization, automated outreach, and a desktop AI agent." },
        { name: "Where do I report bugs?", value: "Post in #bug-reports with steps to reproduce and screenshots if possible." },
      ],
      footer: { text: "Don't see your question? Ask in #support!" },
    }],
  });
  console.log("  Posted FAQ");

  // Post in changelog
  await sleep(500);
  await api("POST", "/channels/" + changelog.id + "/messages", {
    embeds: [{
      title: "v1.2.0 \u2014 ShortStack OS Update",
      description: "Latest changes to ShortStack OS:",
      color: 0xC9A84C,
      fields: [
        { name: "New: AI Desktop Agent", value: "Clients now have an AI-powered desktop agent that works directly on their machine \u2014 powered by ShortStack." },
        { name: "New: Discord Bot Online", value: "ShortStack Bot is now live with 10 slash commands: /status, /leads, /clients, /report, /pipeline, /revenue, /uptime, /leaderboard, /announce, /help" },
        { name: "New: Zernio Integration", value: "Unified social media API for posting and DMs across 14 platforms." },
        { name: "Improved: Community Server", value: "Full server restructure with organized categories, roles, and channel topics." },
      ],
      footer: { text: "April 13, 2026" },
      timestamp: new Date().toISOString(),
    }],
  });
  console.log("  Posted changelog entry");

  // Post resources
  await sleep(500);
  await api("POST", "/channels/" + resources.id + "/messages", {
    embeds: [{
      title: "ShortStack Resources",
      description: "Helpful links to get the most out of ShortStack OS:",
      color: 0xC9A84C,
      fields: [
        { name: "Website", value: "https://shortstack.work" },
        { name: "Dashboard", value: "https://shortstack-os.vercel.app" },
        { name: "Desktop App", value: "Download from shortstack.work for Windows" },
        { name: "Feature Requests", value: "Post in #feature-requests to shape the product" },
        { name: "Bug Reports", value: "Post in #bug-reports with reproduction steps" },
      ],
      footer: { text: "Bookmark this channel for quick access." },
    }],
  });
  console.log("  Posted resources");

  console.log("\n=== ALL DONE ===");
}

run().catch(console.error);
