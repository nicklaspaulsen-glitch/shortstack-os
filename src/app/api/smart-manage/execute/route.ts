import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import {
  filterPayload,
  resolveSmartManageAction,
} from "@/lib/smart-manage/actions";

// Smart Manage executor.
//
// POST { client_id, action_type, payload }
//   → validates action_type against the whitelist, filters payload down to
//     the declared schema, forwards to the handler route, logs outcome.
//
// This route exists so the overlay never has to know which real handler
// to call — and so Claude can never cause us to call arbitrary URLs.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const clientId: string | undefined = body?.client_id;
  const actionType: string | undefined = body?.action_type;
  const rawPayload: Record<string, unknown> = body?.payload || {};

  if (!clientId || !actionType) {
    return NextResponse.json({ error: "client_id and action_type are required" }, { status: 400 });
  }

  const def = resolveSmartManageAction(actionType);
  if (!def) {
    return NextResponse.json({ error: `Unknown action type: ${actionType}` }, { status: 400 });
  }

  const service = createServiceClient();

  // Confirm caller owns the client before executing anything on it.
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client.profile_id && client.profile_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = {
    ...filterPayload(def, rawPayload),
    client_id: clientId,
  };

  let outcome: "success" | "failed" | "todo" = "success";
  let message = "";

  if (def.todo) {
    outcome = "todo";
    message = `Handler for ${def.type} is not yet implemented (TODO).`;
  } else {
    try {
      // Forward to the real handler route, inside our own app.
      const origin =
        request.headers.get("origin") ||
        `${request.nextUrl.protocol}//${request.nextUrl.host}`;
      const cookie = request.headers.get("cookie") || "";
      const handlerRes = await fetch(`${origin}${def.handler_route}`, {
        method: def.http_method,
        headers: {
          "Content-Type": "application/json",
          cookie, // carry the caller's session
        },
        body: JSON.stringify(payload),
      });
      if (!handlerRes.ok) {
        outcome = "failed";
        const text = await handlerRes.text().catch(() => "");
        message = `Handler ${def.handler_route} returned ${handlerRes.status}: ${text.slice(0, 200)}`;
      } else {
        const data = await handlerRes.json().catch(() => ({}));
        message = data?.message || `Action '${def.type}' completed.`;
      }
    } catch (err) {
      outcome = "failed";
      message = err instanceof Error ? err.message : String(err);
    }
  }

  // Append the execution to the most recent suggestion row for this client.
  try {
    const { data: latest } = await service
      .from("smart_manage_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id) {
      await service.from("smart_manage_log").update({
        executed_action_type: def.type,
        executed_payload: payload,
        executed_at: new Date().toISOString(),
        outcome: `${outcome}: ${message}`.slice(0, 500),
      }).eq("id", latest.id);
    } else {
      // No suggestion row yet — write one so the audit trail captures the
      // execution even if the user called us directly.
      await service.from("smart_manage_log").insert({
        user_id: user.id,
        client_id: clientId,
        suggested_actions: [],
        executed_action_type: def.type,
        executed_payload: payload,
        executed_at: new Date().toISOString(),
        outcome: `${outcome}: ${message}`.slice(0, 500),
      });
    }
  } catch (err) {
    console.error("[smart-manage/execute] log update failed:", err);
  }

  const status = outcome === "success" ? 200 : outcome === "todo" ? 501 : 500;
  return NextResponse.json({ outcome, message, action_type: def.type }, { status });
}
