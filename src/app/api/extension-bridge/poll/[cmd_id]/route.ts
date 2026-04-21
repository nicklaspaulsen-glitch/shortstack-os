/**
 * GET /api/extension-bridge/poll/[cmd_id]
 *
 * The web app polls this after POSTing a command to /commands. Returns
 * the extension's reply if it has arrived within the RESULT_TTL window,
 * otherwise { status: "pending" }.
 *
 * Auth: same as /commands — authenticated user. We scope results by
 * userId so one user can never read another user's extension responses.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { getResult } from "@/lib/extension-bridge/store";

export async function GET(
  req: NextRequest,
  { params }: { params: { cmd_id: string } },
) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const cmd_id = params.cmd_id;
  if (!cmd_id) {
    return NextResponse.json({ error: "cmd_id required" }, { status: 400 });
  }

  const result = getResult(user.id, cmd_id);
  if (!result) {
    return NextResponse.json({ status: "pending", cmd_id });
  }
  return NextResponse.json({ status: "done", cmd_id, ...result });
}
