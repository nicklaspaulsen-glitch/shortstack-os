/**
 * Public funnel step page — server-rendered.
 *
 * Resolves /f/[slug]/[step] to a funnel + step pair using the read-only
 * service client (so anonymous traffic doesn't need a Supabase session).
 * Renders the step's `page_doc` JSON as a minimal landing-page surface
 * with optional CTA → next step.
 *
 * Security: only published funnels resolve. Status check enforced both
 * by the RLS policy `funnels_public_read` and by an explicit predicate
 * here (defense-in-depth).
 */

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import StepClientShell from "./step-client";

export const dynamic = "force-dynamic";

interface PageDoc {
  headline?: string;
  subheadline?: string;
  cta_label?: string;
  cta_target?: string;
  body_html?: string;
  background?: string;
  [key: string]: unknown;
}

interface FunnelRow {
  id: string;
  name: string;
  status: string;
  slug: string | null;
}

interface StepRow {
  id: string;
  funnel_id: string;
  title: string;
  step_type: string;
  slug: string | null;
  page_doc: PageDoc | null;
  next_step_id: string | null;
  sort_order: number;
}

interface PageProps {
  params: { slug: string; step: string };
}

export default async function PublicFunnelStepPage({ params }: PageProps) {
  const supabase = createServiceClient();

  const { data: funnel } = await supabase
    .from("funnels")
    .select("id, name, status, slug")
    .eq("slug", params.slug)
    .eq("status", "published")
    .maybeSingle();

  if (!funnel) return notFound();

  const f = funnel as FunnelRow;

  const { data: step } = await supabase
    .from("funnel_steps")
    .select("id, funnel_id, title, step_type, slug, page_doc, next_step_id, sort_order")
    .eq("funnel_id", f.id)
    .eq("slug", params.step)
    .maybeSingle();

  if (!step) return notFound();

  const s = step as StepRow;

  // Resolve next step slug for CTA target
  let nextStepSlug: string | null = null;
  if (s.next_step_id) {
    const { data: nextStep } = await supabase
      .from("funnel_steps")
      .select("slug")
      .eq("id", s.next_step_id)
      .maybeSingle();
    nextStepSlug = (nextStep as { slug: string | null } | null)?.slug ?? null;
  } else {
    const { data: candidates } = await supabase
      .from("funnel_steps")
      .select("slug, sort_order")
      .eq("funnel_id", f.id)
      .gt("sort_order", s.sort_order)
      .order("sort_order", { ascending: true })
      .limit(1);
    nextStepSlug = (candidates as { slug: string | null }[] | null)?.[0]?.slug ?? null;
  }

  const reqHeaders = headers();
  const visitorIdHint = reqHeaders.get("x-vercel-id") ?? reqHeaders.get("x-forwarded-for") ?? null;

  return (
    <StepClientShell
      funnelId={f.id}
      funnelSlug={f.slug ?? params.slug}
      funnelName={f.name}
      stepId={s.id}
      stepSlug={s.slug ?? params.step}
      stepTitle={s.title}
      stepType={s.step_type}
      pageDoc={s.page_doc ?? {}}
      nextStepSlug={nextStepSlug}
      visitorIdHint={visitorIdHint}
    />
  );
}
