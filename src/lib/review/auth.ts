// Creative Review Tool — server auth helpers
//
// Two access modes per route:
//   1) Authenticated agency member (owner or team_member). Uses the normal
//      server client from cookies.
//   2) Anonymous client via magic-link token. We verify X-Review-Token
//      (or a token in the URL) against review_sessions.magic_link_token
//      and scope every query to that session using the service-role client.
//
// Never expose the magic token-matching path to a non-scoped query.

import type { NextRequest } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReviewSession } from "./types";

export interface SessionAccess {
  // When the caller is an authenticated agency member
  mode: "agency" | "magic";
  supabase: SupabaseClient;
  userId: string | null;
  session: ReviewSession;
}

/**
 * Resolve and authorize access to a review session, either via authenticated
 * agency user or via magic-link token. Returns null if not authorized.
 *
 * Callers should pass the sessionId pulled from the URL. For magic-link
 * flows, sessionId may be null and the token is used to look up the session.
 */
export async function resolveReviewSession(
  req: NextRequest,
  sessionId: string | null,
): Promise<SessionAccess | null> {
  const token = req.headers.get("x-review-token");

  // Auth path: try authenticated user first
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (!sessionId) return null;
    const { data } = await supabase
      .from("review_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    if (!data) return null;
    if (data.created_by !== user.id) return null;
    return {
      mode: "agency",
      supabase,
      userId: user.id,
      session: data as ReviewSession,
    };
  }

  // Magic-link path: verify token matches and optionally matches sessionId
  if (token) {
    const svc = createServiceClient();
    const query = svc
      .from("review_sessions")
      .select("*")
      .eq("magic_link_token", token);
    const { data } = sessionId
      ? await query.eq("id", sessionId).single()
      : await query.single();
    if (!data) return null;
    return {
      mode: "magic",
      supabase: svc,
      userId: null,
      session: data as ReviewSession,
    };
  }

  return null;
}

/**
 * Resolve a session by magic-link token only (used by /api/review/public/[token]
 * which does not have a session id in the URL).
 */
export async function resolveSessionByToken(
  token: string,
): Promise<{ supabase: SupabaseClient; session: ReviewSession } | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("review_sessions")
    .select("*")
    .eq("magic_link_token", token)
    .single();
  if (!data) return null;
  return { supabase: svc, session: data as ReviewSession };
}

/**
 * Enqueue a notification row by writing into the email_queue table if it
 * exists. Soft-fails if the table is absent — the review tool must work even
 * in environments where the email queue hasn't been provisioned yet.
 *
 * Callers pass the agency owner user_id (created_by on the session).
 */
export async function enqueueReviewNotification(
  svc: SupabaseClient,
  params: {
    to_user_id: string | null;
    subject: string;
    body: string;
    session_id: string;
    kind: "new_comment" | "approved" | "revisions_requested";
  },
): Promise<void> {
  try {
    await svc.from("email_queue").insert({
      to_user_id: params.to_user_id,
      subject: params.subject,
      body: params.body,
      metadata: { session_id: params.session_id, kind: params.kind },
      status: "queued",
    });
  } catch {
    // table may not exist in this env — silent.
  }
}
