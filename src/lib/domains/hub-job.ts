/**
 * Shared helpers for Domain-as-Hub sub-task handlers.
 *
 * Each sub-task route (`/api/domains/hub-setup/{email,phone,website,portal,chat}`)
 * follows the same shape:
 *   1. Auth + load job row (caller must own it).
 *   2. Flip its status column to `in_progress`.
 *   3. Do the real work.
 *   4. Flip to `done` + write `*_result` jsonb, or `failed` + push an error.
 *
 * Centralizing the status transitions here keeps the sub-task files short
 * and guarantees the progress page's colored-dot contract stays consistent.
 */

import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export type JobServiceKey = "email" | "phone" | "website" | "portal" | "chat";

export interface DomainSetupJob {
  id: string;
  profile_id: string;
  domain: string;
  enable_email: boolean;
  enable_phone: boolean;
  enable_website: boolean;
  enable_portal: boolean;
  enable_chat: boolean;
  email_status: string;
  phone_status: string;
  website_status: string;
  portal_status: string;
  chat_status: string;
  email_result: unknown;
  phone_result: unknown;
  website_result: unknown;
  portal_result: unknown;
  chat_result: unknown;
  errors: Array<{ service: string; error: string; at: string }>;
  completed_at: string | null;
  created_at: string;
}

/** Fetch the job and verify the caller (auth cookie) owns it. Returns null on 401/403. */
export async function loadJobAsCaller(
  jobId: string,
): Promise<{ job: DomainSetupJob; ownerId: string } | { error: string; status: number }> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return { error: "Forbidden", status: 403 };

  const svc = createServiceClient();
  const { data: job } = await svc
    .from("domain_setup_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("profile_id", ownerId)
    .maybeSingle();

  if (!job) return { error: "Job not found", status: 404 };
  return { job: job as DomainSetupJob, ownerId };
}

export async function setServiceStatus(
  jobId: string,
  service: JobServiceKey,
  status: "pending" | "in_progress" | "done" | "failed" | "skipped",
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("domain_setup_jobs")
    .update({ [`${service}_status`]: status })
    .eq("id", jobId);
}

export async function setServiceDone(
  jobId: string,
  service: JobServiceKey,
  result: unknown,
): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("domain_setup_jobs")
    .update({
      [`${service}_status`]: "done",
      [`${service}_result`]: result,
    })
    .eq("id", jobId);
  await maybeMarkCompleted(jobId);
}

export async function setServiceFailed(
  jobId: string,
  service: JobServiceKey,
  error: string,
  partialResult?: unknown,
): Promise<void> {
  const svc = createServiceClient();

  // Read existing errors so we can append (RLS jsonb arrays need a full
  // rewrite). Truncate the error message to keep the row small.
  const { data: existing } = await svc
    .from("domain_setup_jobs")
    .select("errors")
    .eq("id", jobId)
    .single();

  const prev = Array.isArray(existing?.errors) ? existing.errors : [];
  const next = [
    ...prev,
    { service, error: String(error).slice(0, 500), at: new Date().toISOString() },
  ];

  const update: Record<string, unknown> = {
    [`${service}_status`]: "failed",
    errors: next,
  };
  if (partialResult !== undefined) update[`${service}_result`] = partialResult;

  await svc.from("domain_setup_jobs").update(update).eq("id", jobId);
  await maybeMarkCompleted(jobId);
}

/**
 * If every sub-task is in a terminal state (done/failed/skipped), stamp
 * completed_at. Caller doesn't need to do this — every setDone/setFailed
 * calls us automatically.
 */
async function maybeMarkCompleted(jobId: string): Promise<void> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("domain_setup_jobs")
    .select("email_status, phone_status, website_status, portal_status, chat_status, completed_at")
    .eq("id", jobId)
    .single();
  if (!data || data.completed_at) return;

  const statuses = [
    data.email_status,
    data.phone_status,
    data.website_status,
    data.portal_status,
    data.chat_status,
  ];
  const terminal = new Set(["done", "failed", "skipped"]);
  if (statuses.every(s => terminal.has(s))) {
    await svc
      .from("domain_setup_jobs")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", jobId);
  }
}

export function rootDomainOf(domain: string): string {
  const parts = domain.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : domain;
}
