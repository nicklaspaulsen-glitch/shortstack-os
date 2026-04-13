/**
 * Discord Server Tweaks
 * - Rename channels with emoji
 * - Update categories
 * - Post rules with verification instructions
 * - Set up membership screening
 * - Configure channel permissions for verification gate
 */

const BOT = process.env.DISCORD_BOT_TOKEN;
const GUILD = "1492845816514347121";
const API = "https://discord.com/api/v10";
const h = { Authorization: "Bot " + BOT, "Content-Type": "application/json" };

async function api(method, path, body) {
  const opts = { method, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (method === "DELETE" && r.ok) return {};
  const d = await r.json().catch(() => ({}));
  if (!r.ok) console.error("  ERROR", r.status, path, JSON.stringify(d).slice(0, 200));
  return d;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  // Get all channels first
  const channels = await api("GET", "/guilds/" + GUILD + "/channels");
  const find = (name) => channels.find(c => c.name === name);

  // ═══════════════════════════════════════════════════
  // 1. RENAME CHANNELS WITH EMOJI
  // ═══════════════════════════════════════════════════
  console.log("=== Renaming channels with emoji ===");

  const renames = [
    // Categories
    { id: find("Info")?.id, name: "\u2728\u2502Info" },
    { id: find("Community")?.id, name: "\uD83C\uDF1F\u2502Community" },
    { id: find("Support & Feedback")?.id, name: "\uD83D\uDEE0\uFE0F\u2502Support" },
    { id: find("Resources")?.id, name: "\uD83D\uDCDA\u2502Resources" },
    { id: find("Team Only")?.id, name: "\uD83D\uDD12\u2502Team Only" },
    { id: find("Voice Channels")?.id, name: "\uD83C\uDFA4\u2502Voice" },

    // Info channels
    { id: find("rules")?.id, name: "\uD83D\uDCDC\u2502rules" },
    { id: find("announcements")?.id, name: "\uD83D\uDCE2\u2502announcements" },
    { id: find("changelog")?.id, name: "\uD83D\uDCC3\u2502changelog" },

    // Community channels
    { id: find("general")?.id, name: "\uD83D\uDCAC\u2502general" },
    { id: find("introductions")?.id, name: "\uD83D\uDC4B\u2502introductions" },
    { id: find("showcase")?.id, name: "\uD83C\uDFC6\u2502showcase" },
    { id: find("wins")?.id, name: "\uD83C\uDF89\u2502wins" },

    // Support channels
    { id: find("support")?.id, name: "\uD83C\uDD98\u2502support" },
    { id: find("feature-requests")?.id, name: "\uD83D\uDCA1\u2502feature-requests" },
    { id: find("bug-reports")?.id, name: "\uD83D\uDC1B\u2502bug-reports" },

    // Resources
    { id: find("tips-and-tricks")?.id, name: "\uD83D\uDD25\u2502tips-and-tricks" },
    { id: find("resources")?.id, name: "\uD83D\uDD17\u2502resources" },
    { id: find("faq")?.id, name: "\u2753\u2502faq" },

    // Team only
    { id: find("moderator-only")?.id, name: "\uD83D\uDEE1\uFE0F\u2502mod-chat" },
    { id: find("bot-commands")?.id, name: "\uD83E\uDD16\u2502bot-commands" },
  ];

  for (const r of renames) {
    if (!r.id) { console.log("  Skip (not found):", r.name); continue; }
    await api("PATCH", "/channels/" + r.id, { name: r.name });
    console.log("  Renamed:", r.name);
    await sleep(600);
  }

  // Rename voice channels
  const generalVoice = channels.find(c => c.name === "General" && c.type === 2);
  if (generalVoice) {
    await api("PATCH", "/channels/" + generalVoice.id, { name: "\uD83D\uDD0A General" });
    console.log("  Renamed: General voice");
    await sleep(600);
  }
  const coworking = channels.find(c => c.name === "Coworking" && c.type === 2);
  if (coworking) {
    await api("PATCH", "/channels/" + coworking.id, { name: "\uD83C\uDFB5 Coworking" });
    console.log("  Renamed: Coworking voice");
    await sleep(600);
  }

  // ═══════════════════════════════════════════════════
  // 2. SET UP VERIFICATION GATE
  // ═══════════════════════════════════════════════════
  console.log("\n=== Setting up verification gate ===");

  // Get the Member role ID
  const MEMBER_ROLE = "1492851432930410616";
  const EVERYONE = GUILD; // @everyone role has same ID as guild

  // Set @everyone to have NO access to most channels
  // Only allow access to rules channel
  // Member role unlocks everything else

  // First: deny @everyone from seeing all categories except Info
  const infoCat = find("Info");
  const commCat = find("Community");
  const suppCat = find("Support & Feedback");
  const resCat = find("Resources");

  // Lock Community, Support, Resources behind Member role
  const lockCategories = [commCat, suppCat, resCat].filter(Boolean);
  for (const cat of lockCategories) {
    await api("PATCH", "/channels/" + cat.id, {
      permission_overwrites: [
        { id: EVERYONE, type: 0, deny: "1024" },        // @everyone can't view
        { id: MEMBER_ROLE, type: 0, allow: "1024" },     // Member can view
        { id: "1492849838105165935", type: 0, allow: "1024" }, // Admin
        { id: "1492850349470646404", type: 0, allow: "1024" }, // Moderator
      ]
    });
    console.log("  Locked category:", cat.name);
    await sleep(600);
  }

  // Lock voice channels behind Member role
  const voiceCat = find("Voice Channels") || channels.find(c => c.type === 4 && c.name.includes("Voice"));
  if (voiceCat) {
    await api("PATCH", "/channels/" + voiceCat.id, {
      permission_overwrites: [
        { id: EVERYONE, type: 0, deny: "1024" },
        { id: MEMBER_ROLE, type: 0, allow: "1024" },
        { id: "1492849838105165935", type: 0, allow: "1024" },
        { id: "1492850349470646404", type: 0, allow: "1024" },
      ]
    });
    console.log("  Locked: Voice category");
    await sleep(600);
  }

  // Make sure rules channel is visible to everyone
  const rulesChannel = find("rules");
  if (rulesChannel) {
    await api("PATCH", "/channels/" + rulesChannel.id, {
      permission_overwrites: [
        { id: EVERYONE, type: 0, allow: "1024", deny: "2048" }, // can view, can't send
        { id: "1492849838105165935", type: 0, allow: "3072" },  // Admin: view + send
      ]
    });
    console.log("  Rules channel: visible to all, read-only");
    await sleep(600);
  }

  // ═══════════════════════════════════════════════════
  // 3. SET UP MEMBERSHIP SCREENING
  // ═══════════════════════════════════════════════════
  console.log("\n=== Setting up membership screening ===");

  await api("PATCH", "/guilds/" + GUILD + "/member-verification", {
    enabled: true,
    description: "Welcome to ShortStack OS! Please read and accept the rules to get full access to the server.",
    form_fields: [
      {
        field_type: "TERMS",
        label: "I have read and agree to follow the ShortStack OS server rules. I understand that breaking these rules may result in a warning, mute, or ban.",
        required: true,
      }
    ]
  });
  console.log("  Membership screening enabled");
  await sleep(600);

  // ═══════════════════════════════════════════════════
  // 4. POST RULES IN RULES CHANNEL
  // ═══════════════════════════════════════════════════
  console.log("\n=== Posting rules ===");

  if (rulesChannel) {
    // Delete old messages in rules channel (get last 10)
    const oldMsgs = await api("GET", "/channels/" + rulesChannel.id + "/messages?limit=10");
    if (Array.isArray(oldMsgs)) {
      for (const msg of oldMsgs) {
        await api("DELETE", "/channels/" + rulesChannel.id + "/messages/" + msg.id);
        await sleep(400);
      }
      console.log("  Cleared old rules messages");
    }
    await sleep(600);

    // Post the rules header
    await api("POST", "/channels/" + rulesChannel.id + "/messages", {
      embeds: [{
        title: "\uD83D\uDCDC  ShortStack OS \u2014 Server Rules",
        description: "Welcome to the official ShortStack OS community! To keep this a great place for everyone, please follow these rules. **Accept the rules below to unlock all channels.**",
        color: 0xC9A84C,
      }]
    });
    console.log("  Posted rules header");
    await sleep(600);

    // Post the actual rules
    await api("POST", "/channels/" + rulesChannel.id + "/messages", {
      embeds: [{
        color: 0xC9A84C,
        fields: [
          {
            name: "\uD83E\uDD1D  Rule 1 \u2014 Be Respectful",
            value: "Treat everyone with respect. No harassment, hate speech, discrimination, or personal attacks. We're all here to grow.",
            inline: false,
          },
          {
            name: "\uD83D\uDEAB  Rule 2 \u2014 No Spam",
            value: "Don't spam messages, links, images, or self-promotions. One message gets the point across.",
            inline: false,
          },
          {
            name: "\uD83D\uDCBC  Rule 3 \u2014 No Unsolicited DMs",
            value: "Don't DM members to sell or pitch services unless they've asked. Respect people's inboxes.",
            inline: false,
          },
          {
            name: "\uD83D\uDCC1  Rule 4 \u2014 Use the Right Channels",
            value: "Post in the relevant channel. Support questions go in #support, wins in #wins, bugs in #bug-reports, etc.",
            inline: false,
          },
          {
            name: "\uD83D\uDD12  Rule 5 \u2014 No NSFW Content",
            value: "Keep everything SFW. No explicit, violent, or disturbing content of any kind.",
            inline: false,
          },
          {
            name: "\uD83E\uDDD1\u200D\uD83D\uDCBB  Rule 6 \u2014 No Sharing Credentials",
            value: "Never share API keys, passwords, tokens, or license keys in any channel. Use DMs or secure methods.",
            inline: false,
          },
          {
            name: "\uD83C\uDF1F  Rule 7 \u2014 Help Each Other",
            value: "If you can help someone, do it. This community grows when we lift each other up.",
            inline: false,
          },
        ],
      }]
    });
    console.log("  Posted rules list");
    await sleep(600);

    // Post the verification message
    const verifyMsg = await api("POST", "/channels/" + rulesChannel.id + "/messages", {
      embeds: [{
        title: "\u2705  Accept the Rules",
        description: "React with \u2705 below to confirm you've read the rules and unlock all channels.\n\n**Once verified, you'll get the Member role and full server access.**\n\nWelcome to ShortStack OS! \uD83D\uDE80",
        color: 0x2ECC71,
        footer: { text: "If you have questions, ask in #support after verifying." },
      }]
    });
    console.log("  Posted verification message - ID:", verifyMsg.id);
    await sleep(600);

    // Add the checkmark reaction
    if (verifyMsg.id) {
      await fetch(API + "/channels/" + rulesChannel.id + "/messages/" + verifyMsg.id + "/reactions/%E2%9C%85/@me", {
        method: "PUT",
        headers: h,
      });
      console.log("  Added \u2705 reaction to verification message");

      // Save message ID for the bot to use
      console.log("\n  >>> VERIFICATION MESSAGE ID:", verifyMsg.id, "<<<");
      console.log("  >>> RULES CHANNEL ID:", rulesChannel.id, "<<<");
    }
  }

  // ═══════════════════════════════════════════════════
  // 5. UPDATE SERVER DESCRIPTION
  // ═══════════════════════════════════════════════════
  console.log("\n=== Updating server settings ===");

  await api("PATCH", "/guilds/" + GUILD, {
    description: "The official community for ShortStack OS \u2014 the agency operating system. Connect, learn, and grow with fellow agency operators.",
  });
  console.log("  Updated server description");

  console.log("\n=== ALL TWEAKS DONE ===");
}

run().catch(console.error);
