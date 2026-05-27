"use client";
import { Bell, Buildings, ClipboardText, Code, CreditCard, DownloadSimple, Envelope, Gift, GlobeHemisphereWest, Layout, Lightning, Microphone, Palette, Phone, Plug, Pulse, User, Users, Warning, PlugsConnected } from "@phosphor-icons/react";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import SettingsCard from "@/components/settings/settings-card";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { tokens } from "@/lib/brand/tokens";
import { MotionPage } from "@/components/motion/motion-page";

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
        // Apr 28 audit: was hitting non-existent /api/integrations/status.
        // The real surface is /api/integrations/health which returns
        // { results: HealthResult[] } where each result has a .status of
        // "connected" / "not_configured" / "error". Compute counts here.
        const res = await fetch("/api/integrations/health");
        if (!res.ok) return;
        const raw = (await res.json()) as { results?: Array<{ status: string }> };
        const connected = (raw.results ?? []).filter(r => r.status === "connected").length;
        const total = (raw.results ?? []).length;
        const json: { connected: number; total: number } = { connected, total };
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
    <MotionPage className="space-y-6 max-w-[1200px] mx-auto">{/* -- Settings command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Configuration</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Settings</h1>
      </div>
    </div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SettingsCard
                index={0}
                href="/dashboard/profile"
                title="Account & Profile"
                description="Your name, email, avatar, password, and account deletion."
                Icon={User}
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
                href="/dashboard/white-label"
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
                Icon={Envelope}
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
                Icon={Microphone}
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
                href="/dashboard/integrations-hub"
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
                href="/dashboard/notifications"
                title="Notifications"
                description="Email, push, and Slack toggles for every alert type."
                Icon={Bell}
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
                title="API & PlugsConnected"
                description="Personal API keys + outgoing webhook signing secrets."
                Icon={Code}
                preview={
                  <>
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                      Programmatic
                    </span>
                    <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                      REST + PlugsConnected
                    </span>
                  </>
                }
              />

              <SettingsCard
                index={9}
                href="/dashboard/settings/danger"
                title="Danger Zone"
                description="Export workspace data, transfer ownership, delete account."
                Icon={Warning}
                danger
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
            </div>{/* ── Channel & Infrastructure config ─────────────────────────────── */}<motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.12 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className="font-editorial text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: tokens.text.muted }}
                >
                  Channels &amp; Infrastructure
                </h2>
                <div className="flex-1 h-px" style={{ background: tokens.border.subtle }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingsCard
                  index={10}
                  href="/dashboard/phone-email"
                  title="Phone & Email"
                  description="Twilio phone numbers, caller ID, and sending email addresses."
                  Icon={Phone}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Channels
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        SMS · Voice · Email
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={11}
                  href="/dashboard/phone-setup"
                  title="Phone Setup"
                  description="Configure Twilio SID, auth token, and inbound call routing."
                  Icon={Phone}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Provider
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Twilio
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={12}
                  href="/dashboard/mail-setup"
                  title="Envelope Setup"
                  description="Resend / SMTP configuration, DNS records, and deliverability."
                  Icon={Envelope}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Provider
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Resend / SMTP
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={13}
                  href="/dashboard/domains"
                  title="Domains"
                  description="Custom domains for portals, landing pages, and white-label apps."
                  Icon={GlobeHemisphereWest}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        CNAME / A
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Fully custom domain
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={14}
                  href="/dashboard/usage"
                  title="Usage & Tokens"
                  description="AI token consumption, credit balance, and plan usage caps."
                  Icon={Lightning}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Credits
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Usage breakdown
                      </span>
                    </>
                  }
                />
              </div>
            </motion.div>{/* ── Developer tools ──────────────────────────────────────────────── */}<motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.18 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className="font-editorial text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: tokens.text.muted }}
                >
                  Developer
                </h2>
                <div className="flex-1 h-px" style={{ background: tokens.border.subtle }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingsCard
                  index={15}
                  href="/dashboard/api/keys"
                  title="API Keys"
                  description="Personal access tokens for the ShortStack REST API."
                  Icon={Code}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Programmatic
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Bearer token auth
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={16}
                  href="/dashboard/webhooks"
                  title="PlugsConnected"
                  description="Outgoing webhook endpoints — trigger external services on events."
                  Icon={PlugsConnected}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Outgoing
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        HMAC signed
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={17}
                  href="/dashboard/api/webhooks"
                  title="API PlugsConnected"
                  description="Inbound webhook subscriptions via the public REST API."
                  Icon={PlugsConnected}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Inbound
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Event subscriptions
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={18}
                  href="/dashboard/activity-log"
                  title="Pulse Log"
                  description="Audit trail of all actions taken in your workspace."
                  Icon={ClipboardText}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Audit
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Full history
                      </span>
                    </>
                  }
                />
              </div>
            </motion.div>{/* ── Business & Admin ─────────────────────────────────────────────── */}<motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.24 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className="font-editorial text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: tokens.text.muted }}
                >
                  Business &amp; Admin
                </h2>
                <div className="flex-1 h-px" style={{ background: tokens.border.subtle }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SettingsCard
                  index={20}
                  href="/dashboard/subaccounts"
                  title="Subaccounts"
                  description="Create and manage sub-agency accounts under your workspace."
                  Icon={Buildings}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Multi-tenant
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Sub-agencies
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={21}
                  href="/dashboard/pricing"
                  title="Pricing Plans"
                  description="Configure the pricing tiers you offer your clients."
                  Icon={CreditCard}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Monetization
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Client tiers
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={22}
                  href="/dashboard/affiliates"
                  title="Affiliates"
                  description="Manage your affiliate program and referral commissions."
                  Icon={Gift}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Referrals
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Commission tracking
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={23}
                  href="/dashboard/verticals"
                  title="Vertical Templates"
                  description="Industry-specific page and workflow templates for your niche."
                  Icon={Layout}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Templates
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        By industry
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={24}
                  href="/dashboard/monitor"
                  title="Monitor"
                  description="System health, uptime checks, and background job status."
                  Icon={Pulse}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Observability
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Uptime &amp; jobs
                      </span>
                    </>
                  }
                />

                <SettingsCard
                  index={25}
                  href="/dashboard/download"
                  title="Desktop App"
                  description="Download the ShortStack desktop client for Mac or Windows."
                  Icon={DownloadSimple}
                  preview={
                    <>
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: tokens.text.muted }}>
                        Native
                      </span>
                      <span className="text-[11px]" style={{ color: tokens.text.secondary }}>
                        Mac · Windows
                      </span>
                    </>
                  }
                />
              </div>
            </motion.div></MotionPage>
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
          boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 0 8px -2px ${swatch}44`,
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
