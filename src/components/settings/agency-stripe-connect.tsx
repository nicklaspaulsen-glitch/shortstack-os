"use client";

/**
 * Agency Stripe Connect — settings section for the authed agency to connect
 * their OWN Stripe account for billing clients. Completely separate from the
 * Trinity-subscription section (which bills the agency for the SaaS).
 *
 * Renders a "Connect your Stripe" CTA when no account is connected, and a
 * connected state with capability chips + Express dashboard link + disconnect
 * button once they've onboarded.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  CreditCard, ExternalLink, Loader2, CheckCircle2, AlertTriangle, Link2, Plug,
} from "lucide-react";

type ConnectedAccount = {
  stripe_account_id: string;
  account_type: "express" | "standard";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  country: string | null;
  default_currency: string | null;
  business_name: string | null;
  connected_at: string | null;
  fully_onboarded: boolean;
};

export default function AgencyStripeConnect() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [account, setAccount] = useState<ConnectedAccount | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/integrations/stripe-connect/status");
      if (!res.ok) throw new Error("Failed to load status");
      const data = await res.json();
      setAccount(data.connected ? data.account : null);
    } catch (err) {
      console.error(err);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    // If we just returned from Stripe onboarding, the URL will have
    // ?stripe_connected=1 — refresh status & clean the URL.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("stripe_connected") === "1") {
        toast.success("Stripe connected — finishing setup...");
        url.searchParams.delete("stripe_connected");
        window.history.replaceState({}, "", url.toString());
      }
      if (url.searchParams.has("stripe_connect_error")) {
        toast.error(
          `Stripe Connect: ${url.searchParams.get("stripe_connect_error")}`,
        );
        url.searchParams.delete("stripe_connect_error");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [fetchStatus]);

  async function startOnboarding() {
    setConnecting(true);
    try {
      const res = await fetch("/api/integrations/stripe-connect/onboard", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to start onboarding");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect Stripe");
      setConnecting(false);
    }
  }

  async function openExpressDashboard() {
    setOpeningDashboard(true);
    try {
      const res = await fetch("/api/integrations/stripe-connect/dashboard", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Failed to open Stripe dashboard");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error opening Stripe dashboard");
    } finally {
      setOpeningDashboard(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect your Stripe account from Trinity? You'll need to reconnect to bill clients. (This does NOT close your Stripe account.)")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/stripe-connect/disconnect", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to disconnect");
      toast.success("Stripe disconnected");
      setAccount(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error disconnecting");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="section-header flex items-center gap-2">
            <Plug size={14} className="text-gold" />
            Accept Payments from Clients
          </h3>
          <p className="text-[10px] text-muted">
            Connect your own Stripe account to bill your clients through Trinity —
            create invoices, payment links, and accept card payments that land in your Stripe balance.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 p-4 bg-surface-light/50 rounded-lg border border-border animate-pulse">
          <Loader2 size={14} className="animate-spin text-muted" />
          <p className="text-xs text-muted">Checking connection...</p>
        </div>
      ) : !account ? (
        // ── Not connected ──
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-surface-light/50 rounded-lg border border-border">
            <CreditCard size={18} className="text-gold shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold">No Stripe account connected yet</p>
              <p className="text-[10px] text-muted mt-0.5">
                We&apos;ll open Stripe-hosted onboarding. Once complete, you can send invoices and generate payment links from any client&apos;s page.
              </p>
            </div>
            <button
              onClick={startOnboarding}
              disabled={connecting}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              {connecting ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Connect your Stripe
            </button>
          </div>
          <p className="text-[9px] text-muted flex items-center gap-1">
            <Shield /> Charges land on YOUR Stripe account, not Trinity&apos;s.
            Trinity never sees customer card details.
          </p>
          <EnvHint />
        </div>
      ) : (
        // ── Connected ──
        <div className="space-y-3">
          <div className="p-3 bg-success/[0.05] border border-success/20 rounded-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle2 size={16} className="text-success" />
                </div>
                <div>
                  <p className="text-xs font-semibold">
                    {account.business_name || "Stripe account connected"}
                  </p>
                  <p className="text-[10px] text-muted">
                    {account.country ? `${account.country.toUpperCase()} · ` : ""}
                    {account.default_currency ? `${account.default_currency.toUpperCase()} · ` : ""}
                    {account.account_type === "express" ? "Express" : "Standard"}
                  </p>
                </div>
              </div>
              <span className="text-[9px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full">
                CONNECTED
              </span>
            </div>

            {/* Capability chips */}
            <div className="flex flex-wrap gap-2 mt-3">
              <CapabilityChip label="Charges enabled" on={account.charges_enabled} />
              <CapabilityChip label="Payouts enabled" on={account.payouts_enabled} />
              <CapabilityChip label="Details submitted" on={account.details_submitted} />
            </div>

            {!account.fully_onboarded && (
              <div className="mt-3 p-2 bg-warning/[0.06] border border-warning/20 rounded-lg flex items-start gap-2">
                <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
                <p className="text-[10px] text-warning">
                  Onboarding incomplete. Finish verifying your identity, business info, and bank account before charging clients.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {!account.fully_onboarded && (
              <button
                onClick={startOnboarding}
                disabled={connecting}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {connecting ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Finish onboarding
              </button>
            )}
            <button
              onClick={openExpressDashboard}
              disabled={openingDashboard}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {openingDashboard ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              Open Stripe dashboard
            </button>
            <button
              onClick={disconnect}
              disabled={disconnecting}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 flex items-center gap-1.5"
            >
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : null}
              Disconnect
            </button>
          </div>
          <EnvHint />
        </div>
      )}
    </div>
  );
}

function CapabilityChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
        on
          ? "bg-success/10 text-success"
          : "bg-surface-light text-muted"
      }`}
    >
      {on ? "✓" : "○"} {label}
    </span>
  );
}

function Shield() {
  // Tiny inline shield icon to avoid another lucide import inline.
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function EnvHint() {
  return (
    <details className="text-[9px] text-muted">
      <summary className="cursor-pointer hover:text-foreground">Admin: required env vars</summary>
      <div className="mt-2 space-y-1 p-2 bg-surface-light/50 rounded-lg border border-border">
        <p><code className="text-foreground">STRIPE_SECRET_KEY</code> — Trinity platform key (already set)</p>
        <p><code className="text-foreground">STRIPE_CONNECT_CLIENT_ID</code> — your Connect platform&apos;s <code>ca_xxxxx</code> ID from Stripe Connect settings</p>
        <p><code className="text-foreground">STRIPE_CONNECT_WEBHOOK_SECRET</code> — separate from <code>STRIPE_WEBHOOK_SECRET</code>; create at Stripe Dashboard → Webhooks → &quot;Events on Connected accounts&quot; pointing to <code>/api/webhooks/stripe-connect</code></p>
      </div>
    </details>
  );
}
