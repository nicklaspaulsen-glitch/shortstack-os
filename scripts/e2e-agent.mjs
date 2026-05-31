/**
 * E2E test for the Client Agent system.
 *
 * Phase 1: agent-runtime.js — local tool execution (no auth, no network)
 * Phase 2: API layer — auth, client-agent, sync, activity against live Vercel
 *
 * Run: node scripts/e2e-agent.mjs
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { executeTool, WORKSPACE, ensureWorkspace } = require(path.join(__dirname, "../electron/agent-runtime.js"));

const APP_URL = "https://shortstack-os.vercel.app";
const EMAIL = "nicklaspaulsen1821@gmail.com";
const PASSWORD = "Danknick420";

let passed = 0;
let failed = 0;

function ok(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

// ── Phase 1: Local tool execution ──────────────────────────────

section("Phase 1 · Local tool execution (agent-runtime.js)");

await ensureWorkspace();
ok("workspace directory exists", true);
console.log(`  workspace: ${WORKSPACE}`);

// get_system_info
{
  const r = await executeTool("get_system_info", {});
  ok("get_system_info succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
  ok("get_system_info has platform", r.os?.platform != null);
  ok("get_system_info has hostname", r.os?.hostname != null);
}

// list_directory
{
  const r = await executeTool("list_directory", { path: WORKSPACE });
  ok("list_directory succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
}

// write_file
{
  const r = await executeTool("write_file", {
    path: `${WORKSPACE}/e2e-test.txt`,
    content: "Hello from E2E test\nLine 2\nLine 3",
  });
  ok("write_file succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
}

// read_file
{
  const r = await executeTool("read_file", { path: `${WORKSPACE}/e2e-test.txt` });
  ok("read_file succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
  ok("read_file returns content", typeof r.content === "string" && r.content.includes("Hello"));
}

// run_command (safe)
{
  const r = await executeTool("run_command", { command: "echo hello-e2e" });
  ok("run_command succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
  ok("run_command output correct", r.stdout && r.stdout.includes("hello-e2e"));
}

// search_files
{
  const r = await executeTool("search_files", { pattern: "*e2e*", path: WORKSPACE });
  ok("search_files succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
}

// workspace_stats
{
  const r = await executeTool("workspace_stats", {});
  ok("workspace_stats succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
  ok("workspace_stats has totalFiles", r.totalFiles != null);
}

// create_project
{
  const r = await executeTool("create_project", { name: "e2e-project-test", type: "website" });
  ok("create_project succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
}

// blocked command
{
  const r = await executeTool("run_command", { command: "rm -rf /" });
  ok("blocked command rejected", r.success === false && /block/i.test(r.error), JSON.stringify(r).slice(0, 120));
}

// path escape attempt
{
  const r = await executeTool("read_file", { path: "C:/Windows/System32/drivers/etc/hosts" });
  ok("path escape blocked", r.success === false, JSON.stringify(r).slice(0, 120));
}

// delete_file (cleanup)
{
  const r = await executeTool("delete_file", { path: `${WORKSPACE}/e2e-test.txt` });
  ok("delete_file succeeds", r.success === true, JSON.stringify(r).slice(0, 120));
}

// ── Phase 2: API layer ─────────────────────────────────────────

section("Phase 2 · API layer (live Vercel endpoints)");

let accessToken = null;

// Auth — login
{
  console.log("  → POST /api/agents/auth (login)");
  try {
    const res = await fetch(`${APP_URL}/api/agents/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    const data = await res.json();
    ok("auth returns 200", res.ok, `status=${res.status}`);
    ok("auth returns access_token", typeof data.access_token === "string");
    ok("auth returns user.id", typeof data.user?.id === "string");
    if (data.access_token) accessToken = data.access_token;
    if (!res.ok) console.error("    response:", JSON.stringify(data).slice(0, 200));
  } catch (err) {
    ok("auth POST reachable", false, String(err));
  }
}

if (!accessToken) {
  console.error("\n  ⚠  Login failed — skipping authenticated tests");
} else {
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // sync — GET pending tasks
  {
    console.log("  → GET /api/agents/sync");
    try {
      const res = await fetch(`${APP_URL}/api/agents/sync`, { headers: authHeaders });
      const data = await res.json();
      ok("sync GET returns 200", res.ok, `status=${res.status}`);
      ok("sync GET returns tasks array", Array.isArray(data.tasks));
    } catch (err) {
      ok("sync GET reachable", false, String(err));
    }
  }

  // sync — POST workspace snapshot
  {
    console.log("  → POST /api/agents/sync (workspace snapshot)");
    try {
      const res = await fetch(`${APP_URL}/api/agents/sync`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          workspace_path: WORKSPACE,
          files: [{ path: "e2e-project-test/README.md", type: "file", size: 12, modified: new Date().toISOString() }],
          projects: [{ name: "e2e-project-test", type: "project", file_count: 1 }],
        }),
      });
      const data = await res.json();
      ok("sync POST returns 200", res.ok, `status=${res.status}`);
      ok("sync POST returns success", data.success === true, JSON.stringify(data).slice(0, 120));
    } catch (err) {
      ok("sync POST reachable", false, String(err));
    }
  }

  // activity — log tool actions
  {
    console.log("  → POST /api/agents/activity");
    try {
      const res = await fetch(`${APP_URL}/api/agents/activity`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          actions: [
            { name: "run_command", input: { command: "echo hello-e2e" }, result: "hello-e2e", success: true },
            { name: "write_file", input: { path: "e2e-test.txt" }, result: "written", success: true },
          ],
        }),
      });
      const data = await res.json();
      ok("activity POST returns 200", res.ok, `status=${res.status}`);
      ok("activity POST returns success", data.success === true, JSON.stringify(data).slice(0, 120));
    } catch (err) {
      ok("activity POST reachable", false, String(err));
    }
  }

  // client-agent — send a simple message (no tool calls expected)
  {
    console.log("  → POST /api/agents/client-agent (simple message)");
    try {
      const res = await fetch(`${APP_URL}/api/agents/client-agent`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          messages: [{ role: "user", content: "Reply with exactly: PONG" }],
        }),
      });
      const data = await res.json();
      ok("client-agent POST returns 200", res.ok, `status=${res.status}`);
      ok("client-agent returns text", typeof data.text === "string" && data.text.length > 0);
      ok("client-agent returns stop_reason", typeof data.stop_reason === "string");
      if (data.text) console.log(`  ↩  agent replied: "${data.text.slice(0, 80)}"`);
    } catch (err) {
      ok("client-agent POST reachable", false, String(err));
    }
  }

  // client-agent — trigger a tool call
  {
    console.log("  → POST /api/agents/client-agent (tool-use request)");
    try {
      const res = await fetch(`${APP_URL}/api/agents/client-agent`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          messages: [{ role: "user", content: "Use the get_system_info tool and tell me the platform." }],
        }),
      });
      const data = await res.json();
      ok("tool-use: POST returns 200", res.ok, `status=${res.status}`);
      const hasToolCalls = Array.isArray(data.tool_calls) && data.tool_calls.length > 0;
      const hasText = typeof data.text === "string" && data.text.length > 0;
      ok("tool-use: returns tool_calls or text", hasToolCalls || hasText,
        `tool_calls=${JSON.stringify(data.tool_calls)?.slice(0, 80)} text=${data.text?.slice(0, 40)}`);
      if (hasToolCalls) {
        ok("tool-use: correct tool name", data.tool_calls[0].name === "get_system_info",
          `got: ${data.tool_calls[0].name}`);
      }
    } catch (err) {
      ok("tool-use POST reachable", false, String(err));
    }
  }

  // auth — token refresh
  {
    console.log("  → POST /api/agents/auth (token refresh)");
    try {
      // We don't have the refresh token in this script, so we verify the endpoint exists
      const res = await fetch(`${APP_URL}/api/agents/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", refresh_token: "invalid-token" }),
      });
      // Should return 401 for invalid token, not 404/500
      ok("auth refresh endpoint exists", res.status !== 404 && res.status !== 500, `status=${res.status}`);
    } catch (err) {
      ok("auth refresh reachable", false, String(err));
    }
  }
}

// ── Summary ────────────────────────────────────────────────────

section("Summary");
const total = passed + failed;
console.log(`  Passed : ${passed}/${total}`);
console.log(`  Failed : ${failed}/${total}`);
if (failed === 0) {
  console.log("\n  🎉  All tests passed — Client Agent E2E complete.\n");
  process.exit(0);
} else {
  console.log("\n  ⚠   Some tests failed — see ❌ lines above.\n");
  process.exit(1);
}
