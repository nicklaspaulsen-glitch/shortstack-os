/**
 * ShortStack OS — Discord Gateway Bot
 *
 * Maintains a persistent WebSocket connection to Discord's Gateway
 * so the bot shows as "Online" in the server member list.
 *
 * Run: node scripts/discord-bot.js
 * Requires: DISCORD_BOT_TOKEN env var
 */

const WebSocket = require("ws");

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("[Bot] DISCORD_BOT_TOKEN is required. Set it as an environment variable.");
  process.exit(1);
}

const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const API = "https://discord.com/api/v10";
const GUILD_ID = "1492845816514347121";

// Verification config
const VERIFY_CHANNEL = "1492852846327234560";    // #rules channel
const VERIFY_MESSAGE = "1493173938073632778";     // Verification message with checkmark
const MEMBER_ROLE = "1492851432930410616";        // Member role
const ANNOUNCEMENTS_CHANNEL = "1492846003580178442"; // #announcements

let ws;
let heartbeatInterval;
let lastSequence = null;
let sessionId = null;
let resumeUrl = null;
let botUserId = null;

// ── Discord REST API helper ────────────────────────────────
async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { Authorization: "Bot " + BOT_TOKEN, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  return r.ok ? r.json().catch(() => ({})) : null;
}

// ── Announce to #announcements ─────────────────────────────
async function announce(title, description, fields, color) {
  return apiCall("POST", "/channels/" + ANNOUNCEMENTS_CHANNEL + "/messages", {
    embeds: [{
      title,
      description,
      color: color || 0xC9A84C,
      fields: fields || [],
      footer: { text: "ShortStack Bot" },
      timestamp: new Date().toISOString(),
    }],
  });
}

function connect(url) {
  const gatewayUrl = url || GATEWAY_URL;
  console.log(`[Bot] Connecting to Discord Gateway...`);

  ws = new WebSocket(gatewayUrl);

  ws.on("open", () => {
    console.log("[Bot] WebSocket connected.");
  });

  ws.on("message", (raw) => {
    const payload = JSON.parse(raw);
    const { op, d, s, t } = payload;

    if (s) lastSequence = s;

    switch (op) {
      case 10: // HELLO
        startHeartbeat(d.heartbeat_interval);
        if (sessionId && lastSequence) {
          resume();
        } else {
          identify();
        }
        break;

      case 11: // HEARTBEAT ACK
        break;

      case 1: // HEARTBEAT REQUEST
        heartbeat();
        break;

      case 7: // RECONNECT
        console.log("[Bot] Server requested reconnect.");
        ws.close();
        break;

      case 9: // INVALID SESSION
        console.log("[Bot] Invalid session. Re-identifying...");
        sessionId = null;
        lastSequence = null;
        setTimeout(identify, 2000);
        break;
    }

    // Dispatch events
    if (t === "READY") {
      sessionId = d.session_id;
      resumeUrl = d.resume_gateway_url;
      botUserId = d.user.id;
      console.log(`[Bot] Logged in as ${d.user.username} (${d.user.id})`);
      console.log(`[Bot] Serving ${d.guilds.length} guild(s)`);
    }

    if (t === "RESUMED") {
      console.log("[Bot] Session resumed successfully.");
    }

    if (t === "GUILD_MEMBER_ADD") {
      const username = d.user?.username || "unknown";
      console.log(`[Bot] New member joined: ${username}`);
      // Announce new member
      announce(
        "\uD83D\uDC4B New Member!",
        `Welcome **${username}** to the ShortStack OS community! Head to **#introductions** and tell us about yourself.`,
        null,
        0x2ECC71
      ).catch(() => {});
    }

    // ── Verification: assign Member role on checkmark reaction ──
    if (t === "MESSAGE_REACTION_ADD") {
      if (
        d.channel_id === VERIFY_CHANNEL &&
        d.message_id === VERIFY_MESSAGE &&
        d.emoji?.name === "\u2705" &&
        d.user_id !== botUserId
      ) {
        console.log(`[Bot] Verifying user: ${d.user_id}`);
        apiCall("PUT", `/guilds/${GUILD_ID}/members/${d.user_id}/roles/${MEMBER_ROLE}`)
          .then((r) => {
            if (r !== null) {
              console.log(`[Bot] Assigned Member role to ${d.user_id}`);
            } else {
              console.log(`[Bot] Failed to assign role to ${d.user_id} (check bot role hierarchy)`);
            }
          })
          .catch((e) => console.error("[Bot] Role assign error:", e.message));
      }
    }

    // ── Auto-remove role if reaction removed ──
    if (t === "MESSAGE_REACTION_REMOVE") {
      if (
        d.channel_id === VERIFY_CHANNEL &&
        d.message_id === VERIFY_MESSAGE &&
        d.emoji?.name === "\u2705"
      ) {
        console.log(`[Bot] Removing verification for user: ${d.user_id}`);
        apiCall("DELETE", `/guilds/${GUILD_ID}/members/${d.user_id}/roles/${MEMBER_ROLE}`)
          .catch(() => {});
      }
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[Bot] Disconnected (code: ${code}). Reconnecting in 5s...`);
    clearInterval(heartbeatInterval);

    // Non-resumable close codes
    const noResume = [4004, 4010, 4011, 4012, 4013, 4014];
    if (noResume.includes(code)) {
      console.error("[Bot] Fatal close code. Cannot reconnect.");
      process.exit(1);
    }

    setTimeout(() => connect(resumeUrl), 5000);
  });

  ws.on("error", (err) => {
    console.error("[Bot] WebSocket error:", err.message);
  });
}

function identify() {
  console.log("[Bot] Sending IDENTIFY...");
  ws.send(
    JSON.stringify({
      op: 2,
      d: {
        token: BOT_TOKEN,
        intents: 33283 | 1024, // GUILDS (1) | GUILD_MEMBERS (2) | GUILD_MESSAGES (512) | MESSAGE_CONTENT (32768) | GUILD_MESSAGE_REACTIONS (1024)
        properties: {
          os: "linux",
          browser: "shortstack-os",
          device: "shortstack-os",
        },
        presence: {
          activities: [
            {
              name: "ShortStack OS",
              type: 3, // WATCHING
            },
          ],
          status: "online",
          afk: false,
        },
      },
    })
  );
}

function resume() {
  console.log("[Bot] Resuming session...");
  ws.send(
    JSON.stringify({
      op: 6,
      d: {
        token: BOT_TOKEN,
        session_id: sessionId,
        seq: lastSequence,
      },
    })
  );
}

function heartbeat() {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: lastSequence }));
  }
}

function startHeartbeat(interval) {
  clearInterval(heartbeatInterval);
  // Send first heartbeat after a random jitter
  setTimeout(heartbeat, Math.random() * interval);
  heartbeatInterval = setInterval(heartbeat, interval);
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n[Bot] Shutting down...");
  clearInterval(heartbeatInterval);
  if (ws) ws.close(1000, "Bot shutting down");
  process.exit(0);
});

process.on("SIGTERM", () => {
  clearInterval(heartbeatInterval);
  if (ws) ws.close(1000, "Bot shutting down");
  process.exit(0);
});

// Start
connect();
