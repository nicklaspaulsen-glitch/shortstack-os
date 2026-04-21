/**
 * GET /api/extension-bridge/status
 *
 * Web-app-facing endpoint. Returns whether the user's extension is
 * currently connected (heartbeat within HEARTBEAT_TTL_MS) and whether
 * it has ever connected (for feature-detecting the dashboard pill).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import {
  getConnectionStatus,
  hasEverConnected,
} from "@/lib/extension-bridge/store";

export async function GET(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const status = getConnectionStatus(user.id);
  return NextResponse.json({
    connected: status.connected,
    lastHeartbeatAt: status.lastHeartbeatAt,
    extensionVersion: status.extensionVersion,
    everConnected: hasEverConnected(user.id),
  });
}
