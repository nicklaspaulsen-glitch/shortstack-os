/**
 * POST /api/extension-bridge/heartbeat
 *
 * The Chrome extension pings this every ~25s so the server knows the
 * bridge is live. The response includes the hello ack (session_id, user_id)
 * that the original wire protocol would have delivered on WebSocket open.
 *
 * Body: { extension_version?: string }
 *
 * Response: { type: "ack", session_id, user_id }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { markEverConnected, recordHeartbeat } from "@/lib/extension-bridge/store";

export async function POST(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: { extension_version?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — heartbeat still counts.
  }

  recordHeartbeat(user.id, body.extension_version);
  markEverConnected(user.id);

  return NextResponse.json({
    type: "ack",
    session_id: `${user.id}:${Date.now().toString(36)}`,
    user_id: user.id,
  });
}
