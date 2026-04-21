/**
 * POST /api/extension-bridge/commands
 *
 * The web app calls this to send a command to the authenticated user's
 * Chrome extension. Body: { target, action, params }.
 *
 * Auth: Bearer access token OR cookie session — same as other /api/extension
 * routes. We do not allow cross-user command targeting; a command is always
 * enqueued for the authenticated caller's userId.
 *
 * Response: { cmd_id } — the web app then polls GET /poll/:cmd_id for the
 * extension's reply.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { checkRateLimit } from "@/lib/extension/rate-limit";
import { enqueueCommand, getConnectionStatus } from "@/lib/extension-bridge/store";

const CMD_LIMIT_PER_MIN = 120;
const CMD_WINDOW_MS = 60_000;

const ALLOWED_TARGETS = new Set(["tab", "bg"]);

export async function POST(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const rl = checkRateLimit(`ext-bridge-cmd:${user.id}`, CMD_LIMIT_PER_MIN, CMD_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: { target?: string; action?: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const target = body.target || "tab";
  const action = body.action;
  const params = body.params || {};

  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }
  if (!ALLOWED_TARGETS.has(target)) {
    return NextResponse.json(
      { error: `target must be one of: ${Array.from(ALLOWED_TARGETS).join(", ")}` },
      { status: 400 },
    );
  }

  const cmd_id = `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  enqueueCommand(user.id, {
    id: cmd_id,
    target: target as "tab" | "bg",
    action,
    params,
  });

  const status = getConnectionStatus(user.id);
  return NextResponse.json({ cmd_id, extension_connected: status.connected });
}
