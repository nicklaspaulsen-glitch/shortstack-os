/**
 * GET /api/extension-bridge/pending
 *
 * Long-polled by the Chrome extension's background service worker. Waits
 * up to ~25s for commands to become available for this user, then returns
 * them. The extension immediately re-polls after each response — this is
 * the transport primitive that replaces the raw WebSocket.
 *
 * Auth: Bearer access token (the extension's auth pattern).
 *
 * Response: { cmds: BridgeCommand[] }
 *
 * Notes:
 *   - We also record a heartbeat on each successful poll, so the dashboard
 *     pill reflects liveness even if the extension fails to hit /heartbeat
 *     on schedule.
 *   - maxDuration is not set here because Vercel's serverless default (15s
 *     on hobby, 30s on pro) is enough. If the poll times out with no cmds
 *     the client simply re-polls.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import {
  drainPending,
  markEverConnected,
  recordHeartbeat,
} from "@/lib/extension-bridge/store";

const POLL_TIMEOUT_MS = 20_000;

export async function GET(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  recordHeartbeat(user.id);
  markEverConnected(user.id);

  const cmds = await drainPending(user.id, POLL_TIMEOUT_MS);
  return NextResponse.json({ cmds });
}
