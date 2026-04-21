/**
 * POST /api/extension-bridge/ack
 *
 * The Chrome extension POSTs command results here. Body shape mirrors the
 * original WebSocket frame:
 *
 *   { type: "result", id, ok, data?, error? }
 *   { type: "event",  kind, data? }
 *
 * The server stashes results for 60s (picked up by /poll/:cmd_id) and
 * events for later retrieval.
 *
 * Auth: Bearer access token.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import {
  recordResult,
  recordEvent,
  recordHeartbeat,
  markEverConnected,
} from "@/lib/extension-bridge/store";

type AckBody =
  | { type: "result"; id: string; ok: boolean; data?: unknown; error?: string }
  | { type: "event"; kind: string; data?: unknown };

export async function POST(req: NextRequest) {
  const auth = await requireExtensionUser(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  let body: AckBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  recordHeartbeat(user.id);
  markEverConnected(user.id);

  if (body.type === "result") {
    if (!body.id || typeof body.ok !== "boolean") {
      return NextResponse.json(
        { error: "result requires id and ok" },
        { status: 400 },
      );
    }
    recordResult(user.id, {
      id: body.id,
      ok: body.ok,
      data: body.data,
      error: body.error,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.type === "event") {
    if (!body.kind) {
      return NextResponse.json({ error: "event requires kind" }, { status: 400 });
    }
    recordEvent(user.id, { kind: body.kind, data: body.data });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown ack type" }, { status: 400 });
}
