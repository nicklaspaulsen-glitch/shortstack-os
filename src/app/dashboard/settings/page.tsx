"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Code,
  CreditCard,
  Mail,
  Mic,
  Palette,
  Plug,
  User,
  Users,
} from "lucide-react";

import PageHero from "@/components/ui/page-hero";
import SettingsCard from "@/components/settings/settings-card";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { tokens } from "@/lib/brand/tokens";

/**
 * Settings index — Phase 2B editorial-bento redesign.
 *
 * Replaces the legacy 2629-line tabbed page with a 10-card category index.
 * Each card links to either a real sub-route (existing today) or a queued
 * route that will resolve once the parallel PRs land. Routes flagged as
 * "queued" render a tiny "Soon" pill so the user knows.
 *
 * Status preview (right-bottom of certain cards) is fetched lazily from
 * the user's profile + plan + branding so the cards have something
 * specific to show — not a generic "click to configure" template grid.
 *
 * Existing legacy components (AccountSettings, IntegrationsSettings, etc.)
 * remain in `src/components/settings/` for the dedicated sub-routes to
 * reuse. This file no longer renders them inline — it only navigates.
 */

interface BrandPreview {
  brandColor: string | null;
  logoUrl: string | null;
}

interface PlanPreview {
  tier: string | null;
  status: string | null;
}

interface IntegrationsPreview {
  connected: number;
  total: number;
}

export default function SettingsIndexPage() {
  const { profile } = useAuth();
  const [brand, setBrand] = useState<BrandPreview>({ brandColor: null, logoUrl: null });
  const [plan, setPlan] = useState<PlanPreview>({ tier: null, status: null });
  const [integrations, setIntegrations] = useState<IntegrationsPreview>({ connected: 0, total: 8 });

  // Pull current branding + plan tier as small previews so each card has
  // something specific to show. All queries are best-effort — failures
  // collapse the preview row silently.
  useEffect(() => {
    if (!profile?.id) return;

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("white_label_settings")
          .select("brand_color, logo_url")
          .eq("user_id", profile.id)
          .maybeSingle();
        if (!cancelled && data) {
          setBrand({
            brandColor: (data.brand_color as string) || null,
            logoUrl: (data.logo_url as string) || null,
          });
        }
      } catch {
        // table may not exist on older schemas — ignore
      }
    })();

    setPlan({
      tier: (profile.plan_tier as string) || "starter",
      // No plan_status field on Profile — assume active for the preview row.
      // Billing card click-through shows the real status.
      status: "active",
    });

    (async () => {
      try {
        const res = await fetch("/api/integrations/status");
        if (!res.ok) return;
        const json = (await res.json()) as { connected?: number; total?: number };
        if (!cancelled && typeof json.connected === "number") {
          setIntegrations({
            connected: json.connected,
            total: json.total ?? 8,
          });
        }
      } catch {
        // ignore — preview just won't render
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.plan_tier]);

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      <PageHero
        variant="default"
        gradient="purple"
        eyebrow="Configuration"
        title="Settings"
        subtitle="Configure your workspace, your brand, and the integrations that power ShortStack."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SettingsCard
          index={0}
          href="/dashboard/settings/account"
          title="Account & Profile"
          description="Your name, email, avatar, password, and account deletion."
          Icon={User}
          queued
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Signed in as
              </span>
              <span
                className="text-[11px] font-medium truncate"
                style={{ color: tokens.text.primary }}
              >
                {profile?.email || "Loading..."}
              </span>
            </>
          }
        />

        <SettingsCard
          index={1}
          href="/dashboard/settings/white-label"
          title="Branding & White-label"
          description="Logo, brand color, custom domain, support email."
          Icon={Palette}
          preview={<BrandPreviewRow brand={brand} />}
        />

        <SettingsCard
          index={2}
          href="/dashboard/settings/email-templates"
          title="Email Templates"
          description="Welcome, invite, and reset emails — branded with your colors."
          Icon={Mail}
          queued
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                3 templates
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                Welcome / Invite / Reset
              </span>
            </>
          }
        />

        <SettingsCard
          index={3}
          href="/dashboard/settings/voice-profile"
          title="Voice Profile"
          description="Your writing voice + audio voice clones used by the AI agents."
          Icon={Mic}
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Min. corpus
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                200 words to activate
              </span>
            </>
          }
        />

        <SettingsCard
          index={4}
          href="/dashboard/integrations"
          title="Integrations"
          description="Stripe, Resend, Twilio, Nango, RunPod, ElevenLabs, and more."
          Icon={Plug}
          preview={<IntegrationsPreviewRow integrations={integrations} />}
        />

        <SettingsCard
          index={5}
          href="/dashboard/team"
          title="Team"
          description="Members, roles, and per-seat permissions."
          Icon={Users}
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Members
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                Invite teammates
              </span>
            </>
          }
        />

        <SettingsCard
          index={6}
          href="/dashboard/billing"
          title="Billing & Plan"
          description="Current plan, invoices, and usage caps."
          Icon={CreditCard}
          preview={<PlanPreviewRow plan={plan} />}
        />

        <SettingsCard
          index={7}
          href="/dashboard/settings/notifications"
          title="Notifications"
          description="Email, push, and Slack toggles for every alert type."
          Icon={Bell}
          queued
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Channels
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                Email · Push · Slack
              </span>
            </>
          }
        />

        <SettingsCard
          index={8}
          href="/dashboard/api/keys"
          title="API & Webhooks"
          description="Personal API keys + outgoing webhook signing secrets."
          Icon={Code}
          preview={
            <>
              <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                Programmatic
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                REST + Webhooks
              </span>
            </>
          }
        />

        <SettingsCard
          index={9}
          href="/dashboard/settings/danger"
          title="Danger Zone"
          description="Export workspace data, transfer ownership, delete account."
          Icon={AlertTriangle}
          danger
          queued
          preview={
            <>
              <span
                className="text-[10px] uppercase tracking-wider font-semibold"
                style={{ color: tokens.status.error }}
              >
                Irreversible
              </span>
              <span className="text-[11px]" style={{ color: tokens.text.muted }}>
                Read carefully
              </span>
            </>
          }
        />
      </div>
    </div>
  );
}

function BrandPreviewRow({ brand }: { brand: BrandPreview }) {
  const swatch = brand.brandColor || tokens.brand.lime;
  return (
    <>
      <span
        className="w-5 h-5 rounded-md shrink-0"
        style={{
          background: swatch,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.06), 0 0 8px -2px ${swatch}88`,
        }}
        aria-label={`Brand color ${swatch}`}
      />
      <span
        className="text-[10px] font-mono"
        style={{ color: tokens.text.muted }}
      >
        {(brand.brandColor || "default lime").toLowerCase()}
      </span>
      {brand.logoUrl && (
        <span
          className="text-[10px] ml-auto"
          style={{ color: tokens.text.muted }}
        >
          Logo set
        </span>
      )}
    </>
  );
}

function PlanPreviewRow({ plan }: { plan: PlanPreview }) {
  const tier = plan.tier || "Starter";
  const status = plan.status || "active";
  const isActive = status === "active" || status === "trialing";
  return (
    <>
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: tokens.text.muted }}
      >
        Plan
      </span>
      <span
        className="text-[11px] font-medium capitalize"
        style={{ color: tokens.text.primary }}
      >
        {tier}
      </span>
      <span
        className="ml-auto text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
        style={{
          background: isActive ? `${tokens.status.success}22` : `${tokens.status.warning}22`,
          color: isActive ? tokens.status.success : tokens.status.warning,
        }}
      >
        {status}
      </span>
    </>
  );
}

function IntegrationsPreviewRow({ integrations }: { integrations: IntegrationsPreview }) {
  return (
    <>
      <span
        className="text-[10px] uppercase tracking-wider"
        style={{ color: tokens.text.muted }}
      >
        Connected
      </span>
      <span
        className="text-[11px] font-mono tabular-nums"
        style={{ color: tokens.text.primary }}
      >
        {integrations.connected}
        <span style={{ color: tokens.text.muted }}> / {integrations.total}</span>
      </span>
    </>
  );
}
