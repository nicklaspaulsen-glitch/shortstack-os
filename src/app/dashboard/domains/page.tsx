"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Globe2, Search, Loader, CheckCircle, XCircle, ExternalLink,
  ShieldCheck, Plus, RefreshCw, Copy, Trash2,
  AlertTriangle, Edit3, AlertCircle, Mail, MailCheck, MailWarning,
  ArrowUpRight, Info, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { VercelIcon, GoDaddyIcon } from "@/components/ui/platform-icons";
import { computeMonthlyPrice, computeYearlyPrice } from "@/lib/domain-pricing";

interface WebsiteDomain {
  id: string;
  domain: string;
  status: string;
  godaddy_order_id: string | null;
  purchase_price: number | null;
  purchase_currency: string | null;
  expires_at: string | null;
  website_id: string | null;
  dns_records: DnsRecord[];
  created_at: string;
  resend_domain_id: string | null;
  resend_status: "pending" | "verifying" | "verified" | "failed" | null;
  resend_dns_configured: boolean | null;
  resend_last_error: string | null;
}

interface DnsRecord {
  type: string;
  name: string;
  data: string;
  ttl?: number;
}

interface SearchResult {
  domain: string;
  // null = registry check failed (auth/creds issue). Unknown, not "taken".
  available: boolean | null;
  price: number | null;
  currency: string;
  source: string;
  error?: string;
}

interface ProjectRef {
  id: string;
  name: string;
  vercel_url: string | null;
  custom_domain: string | null;
}

interface UsageSnapshot {
  plan_tier: string;
  usage: Record<string, number>;
  limits: Record<string, number | "unlimited">;
  remaining: Record<string, number | "unlimited">;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  pending_payment: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  purchased: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  dns_configured: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  active: "bg-green-500/10 text-green-400 border-green-500/30",
  expired: "bg-red-500/10 text-red-400 border-red-500/30",
  transferred: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function DomainsPage() {
  useAuth();
  const supabase = createClient();

  const [domains, setDomains] = useState<WebsiteDomain[]>([]);
  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);

  // search UI
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  // DNS editor state
  const [dnsOpen, setDnsOpen] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/current", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as UsageSnapshot;
      setUsage(data);
    } catch {
      // silent — quota chip simply won't render
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [d, p] = await Promise.all([
      supabase.from("website_domains").select("*").order("created_at", { ascending: false }),
      supabase.from("website_projects").select("id, name, vercel_url, custom_domain").order("created_at", { ascending: false }),
    ]);
    setDomains((d.data as WebsiteDomain[]) || []);
    setProjects((p.data as ProjectRef[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); loadUsage(); }, [loadData, loadUsage]);

  // Handle Stripe redirect after successful checkout
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get("purchase");
    const domain = params.get("domain");
    if (purchase === "success" && domain) {
      toast.success(`Payment confirmed! Setting up ${domain}…`, { duration: 6000 });
      // Clean the URL
      window.history.replaceState({}, "", "/dashboard/domains");
      // Give the webhook a moment to process the GoDaddy purchase + Vercel
      // attach, then reload and offer to kick off mail setup immediately.
      setTimeout(() => {
        loadData();
        toast(
          (t) => (
            <div className="flex items-start gap-2">
              <div className="flex-1 text-[12px]">
                <p className="font-semibold text-foreground">
                  Next: set up email sending for {domain}
                </p>
                <p className="text-muted mt-0.5">
                  One click to write Resend DKIM/SPF to GoDaddy — then your client can
                  send from anything@{domain}.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      window.location.href = `/dashboard/mail-setup?domain=${encodeURIComponent(domain)}`;
                    }}
                    className="px-3 py-1 rounded-md bg-gold text-black text-[11px] font-semibold"
                  >
                    Set up mail
                  </button>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="px-3 py-1 rounded-md border border-border text-muted text-[11px]"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          ),
          { duration: 12000, icon: <Mail size={16} className="text-blue-400" /> },
        );
      }, 3000);
    } else if (purchase === "cancelled") {
      toast("Purchase cancelled. No charge made.", { icon: "↩" });
      window.history.replaceState({}, "", "/dashboard/domains");
    }
  }, [loadData]);

  async function searchDomains() {
    if (!query.trim()) { toast.error("Enter a name to search"); return; }
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch("/api/websites/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.results) {
        setResults(data.results);
        if (data.stub) toast("Showing preview prices — GoDaddy credentials not set.", { icon: "ℹ️" });
        // API-level error (e.g. GoDaddy credentials rejected). Warn the user
        // once rather than letting every row mislead as "Taken".
        if (data.error) toast.error(data.error, { duration: 8000 });
      } else {
        toast.error(data.error || "Search failed");
      }
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  }

  async function purchaseDomain(
    domain: string,
    billingCycle: "monthly" | "yearly" = "monthly",
    basePrice?: number,
  ) {
    const rowKey = `${domain}:${billingCycle}`;
    setPurchasingDomain(rowKey);
    const toastId = toast.loading("Creating secure checkout...");
    try {
      const res = await fetch("/api/websites/domains/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          billing_cycle: billingCycle,
          base_price: basePrice,
        }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.success && data.url) {
        // Redirect to Stripe Checkout — on success, webhook fires GoDaddy
        // purchase + Vercel attach + DNS config automatically.
        window.location.href = data.url;
        // Don't clear spinner — the page is navigating away
        return;
      }
      if (data.missing_env) {
        toast.error(`Stripe not set up: missing ${data.missing_env.join(", ")}`);
      } else {
        // Surface GoDaddy-API-style errors with more context when they come back
        const detail = typeof data.error === "string" ? data.error : "Checkout failed";
        toast.error(detail, { duration: 7000 });
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err instanceof Error ? `Checkout failed: ${err.message}` : "Checkout failed — network error",
      );
    } finally {
      setPurchasingDomain(null);
    }
  }

  async function retryAutoConfigure(domain: WebsiteDomain) {
    const toastId = toast.loading("Configuring domain…");
    try {
      const res = await fetch("/api/websites/domains/auto-configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.domain,
          project_id: domain.website_id || undefined,
          user_id: undefined, // service client path uses the row's profile_id
        }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.success) {
        toast.success("Domain configured + attached to Vercel");
        await loadData();
      } else {
        const errorStep = data?.steps?.find((s: { status: string }) => s.status === "error");
        const msg =
          errorStep?.detail ||
          data?.error ||
          `Auto-configure failed (HTTP ${res.status}) — check GoDaddy credentials or try again in a minute.`;
        toast.error(msg, { duration: 8000 });
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(
        err instanceof Error
          ? `Auto-configure failed: ${err.message}`
          : "Auto-configure failed — network error",
      );
    }
  }

  // Resend mail provisioning — creates the domain in Resend, writes DKIM/SPF
  // to GoDaddy, kicks off verification. Client can then send from
  // anything@this-domain.com once verification flips to "verified".
  async function setupMail(domain: WebsiteDomain) {
    const toastId = toast.loading("Setting up mail via Resend...");
    try {
      const res = await fetch("/api/websites/domains/mail-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.domain }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.ok) {
        toast.success(`Mail provisioned — ${data.status}`);
        await loadData();
      } else if (data.sandbox) {
        toast("Sandbox: GoDaddy OTE can't hold real DNS. Works on production.", { icon: "⚠️", duration: 7000 });
        await loadData();
      } else {
        toast.error(data.error || "Mail setup failed");
      }
    } catch {
      toast.dismiss(toastId);
      toast.error("Mail setup failed");
    }
  }

  async function refreshMailStatus(domain: WebsiteDomain) {
    const toastId = toast.loading("Checking Resend status...");
    try {
      const res = await fetch(
        `/api/websites/domains/mail-setup?domain=${encodeURIComponent(domain.domain)}`,
      );
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.ok) {
        toast.success(`Status: ${data.status || "pending"}`);
        await loadData();
      } else {
        toast.error(data.error || "Status check failed");
      }
    } catch {
      toast.dismiss(toastId);
      toast.error("Status check failed");
    }
  }

  async function connectToWebsite(domainId: string, websiteId: string) {
    await supabase.from("website_domains").update({ website_id: websiteId || null }).eq("id", domainId);
    if (websiteId) {
      const domain = domains.find(d => d.id === domainId);
      if (domain) {
        await supabase.from("website_projects").update({ custom_domain: domain.domain }).eq("id", websiteId);
      }
    }
    toast.success("Domain linked");
    loadData();
  }

  async function openDns(domain: WebsiteDomain) {
    setDnsOpen(domain.id);
    setDnsLoading(true);
    try {
      const res = await fetch(`/api/websites/domains/dns?domain=${encodeURIComponent(domain.domain)}`);
      const data = await res.json();
      setDnsRecords(data.records || []);
    } catch {
      setDnsRecords([]);
    }
    setDnsLoading(false);
  }

  async function saveDns(domain: string) {
    setDnsLoading(true);
    try {
      const res = await fetch("/api/websites/domains/dns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, records: dnsRecords }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("DNS records saved");
        loadData();
      } else {
        toast.error(data.error || "Save failed");
      }
    } catch {
      toast.error("Save failed");
    }
    setDnsLoading(false);
  }

  function addDnsRecord() {
    setDnsRecords([...dnsRecords, { type: "A", name: "@", data: "76.76.21.21", ttl: 3600 }]);
  }

  function updateDnsRecord(idx: number, patch: Partial<DnsRecord>) {
    setDnsRecords(dnsRecords.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeDnsRecord(idx: number) {
    setDnsRecords(dnsRecords.filter((_, i) => i !== idx));
  }

  function pointToVercel() {
    setDnsRecords([
      { type: "A", name: "@", data: "76.76.21.21", ttl: 3600 },
      { type: "CNAME", name: "www", data: "cname.vercel-dns.com", ttl: 3600 },
    ]);
    toast.success("Loaded Vercel DNS template — click Save to apply");
  }

  const planTierLabel = usage?.plan_tier || "—";
  const domainsOwned = domains.length;

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Globe2 size={28} />}
        title="Domains"
        subtitle="Search, buy & manage domains via GoDaddy. Connect them to your Vercel deployments."
        gradient="ocean"
        actions={
          <div className="flex items-center gap-2">
            {usage && (
              <div className="flex items-center gap-1.5 text-[10px] text-white/85 bg-white/10 border border-white/20 px-2.5 py-1.5 rounded-lg">
                <Globe size={11} />
                <span>
                  <span className="font-semibold">{domainsOwned}</span>
                  <span className="opacity-70"> owned</span>
                  <span className="opacity-60"> · {planTierLabel}</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-white/10 border border-white/20 px-2 py-1 rounded-lg">
              <GoDaddyIcon size={12} /> GoDaddy
              <span className="opacity-40">·</span>
              <VercelIcon size={12} /> Vercel
            </div>
          </div>
        }
      />

      {/* Who-pays clarity banner — agencies pass domain costs to clients, so
          make it unambiguous on a page where a miscommunication = a chargeback. */}
      <div className="flex flex-wrap items-start gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-blue-200">
        <Info size={13} className="mt-0.5 shrink-0 text-blue-300" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-blue-100">Who pays?</span>{" "}
          <span>
            Domain purchases charge <span className="font-semibold">your</span> Stripe-linked card.
            Most agencies rebill the client (monthly: our yearly-retail price divided by 12 + $4
            ops fee; yearly: same with a 20% discount). Adjust the markup in{" "}
            <code className="px-1 py-0.5 rounded bg-blue-500/10 text-[10px]">
              src/lib/domain-pricing.ts
            </code>
            .
          </span>
        </div>
      </div>

      {/* Domain-as-Hub promo — surface the one-click brand launch flow from
          the main domains page. Sits above the search so the "buy the
          domain → launch the brand" loop is discoverable. */}
      <a
        href="/dashboard/domains/hub-setup"
        className="card block bg-gradient-to-br from-gold/10 to-amber-500/5 border-gold/30 hover:border-gold/50 transition"
      >
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-gold shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">One-click brand launch</p>
            <p className="text-[10px] text-muted mt-0.5">
              Provision email, phone, website, portal, and chat widget on your domain in one flow.
            </p>
          </div>
          <ArrowUpRight size={14} className="text-gold shrink-0" />
        </div>
      </a>

      {/* ── Domain search ────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2">
          <Search size={13} className="text-gold" /> Find & buy a domain
        </h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchDomains()}
            className="input flex-1 text-sm"
            placeholder="mybusiness"
          />
          <button onClick={searchDomains} disabled={searching} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
            {searching ? <Loader size={12} className="animate-spin" /> : <Search size={12} />}
            Search
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            {results.map(r => {
              // Use shared pricing helpers so the buttons match the checkout
              // price exactly (previously used hand-rolled math that could drift).
              const base = r.price || 12.99;
              const monthly = computeMonthlyPrice(base);
              const yearly = computeYearlyPrice(monthly);
              const rowMonthlyLoading = purchasingDomain === `${r.domain}:monthly`;
              const rowYearlyLoading = purchasingDomain === `${r.domain}:yearly`;
              const anyRowLoading = rowMonthlyLoading || rowYearlyLoading;
              return (
                <div key={r.domain} className="p-3 rounded-xl border border-border bg-surface-light">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.available === true
                        ? <CheckCircle size={14} className="text-success shrink-0" />
                        : r.available === false
                          ? <XCircle size={14} className="text-muted shrink-0" />
                          : <AlertCircle size={14} className="text-amber-400 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{r.domain}</p>
                        <p className="text-[10px] text-muted">
                          {r.available === true
                            ? (r.price ? `${r.currency} $${r.price.toFixed(2)} wholesale/yr` : "Available")
                            : r.available === false
                              ? "Taken"
                              : "Unknown — can't verify"}
                        </p>
                      </div>
                    </div>
                  </div>
                  {r.available === true && (
                    <>
                      {/* Clear pricing breakdown BEFORE commit — shows wholesale
                          vs what-user-pays so there are no surprises at Stripe
                          checkout. */}
                      <div className="mb-2 px-2 py-1.5 rounded-md bg-background/40 text-[9px] text-muted leading-relaxed">
                        Wholesale: ${base.toFixed(2)}/yr · Your price:{" "}
                        <span className="text-foreground font-semibold">${monthly}/mo</span> or{" "}
                        <span className="text-foreground font-semibold">${yearly}/yr</span> ·
                        Includes registration, SSL, DNS, hosting. Renews automatically.
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => purchaseDomain(r.domain, "monthly", r.price || undefined)}
                          disabled={anyRowLoading}
                          className="text-[10px] px-2 py-2 rounded-lg border border-border text-foreground hover:border-gold/40 hover:bg-white/5 flex flex-col items-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {rowMonthlyLoading ? (
                            <Loader size={12} className="animate-spin my-1" />
                          ) : (
                            <>
                              <span className="font-bold">${monthly}/mo</span>
                              <span className="text-[9px] text-muted">Monthly</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => purchaseDomain(r.domain, "yearly", r.price || undefined)}
                          disabled={anyRowLoading}
                          className="relative text-[10px] px-2 py-2 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-black font-bold flex flex-col items-center hover:shadow-lg hover:shadow-amber-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {rowYearlyLoading ? (
                            <Loader size={12} className="animate-spin my-1" />
                          ) : (
                            <>
                              <span className="absolute -top-1.5 right-1 text-[8px] bg-emerald-500 text-white px-1 py-0.5 rounded-full font-bold">Save 20%</span>
                              <span>${yearly}/yr</span>
                              <span className="text-[9px] opacity-80">Yearly</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Owned domains ────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-header flex items-center gap-2 mb-0">
            <Globe size={13} className="text-gold" /> Your domains ({domains.length})
          </h2>
          <button onClick={loadData} className="btn-ghost text-[10px] flex items-center gap-1">
            <RefreshCw size={10} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-muted text-xs">Loading...</div>
        ) : domains.length === 0 ? (
          <div className="py-10 text-center">
            <Globe size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No domains yet. Search above to buy one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {domains.map(d => (
              <div key={d.id} className="p-3 rounded-xl border border-border bg-surface-light">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <GoDaddyIcon size={20} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{d.domain}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${STATUS_BADGE[d.status] || STATUS_BADGE.pending}`}>
                          {d.status.replace(/_/g, " ")}
                        </span>
                        {/* Resend mail badge — one per status */}
                        {d.resend_status === "verified" ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
                            <MailCheck size={9} /> Mail verified
                          </span>
                        ) : d.resend_status === "verifying" || d.resend_status === "pending" ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1">
                            <Mail size={9} /> Mail verifying
                          </span>
                        ) : d.resend_status === "failed" ? (
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/30 flex items-center gap-1">
                            <MailWarning size={9} /> Mail failed
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/30 flex items-center gap-1">
                            <Mail size={9} /> Mail not set up
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">
                        {d.purchase_price ? `$${d.purchase_price.toFixed(2)} / year` : "—"}
                        {d.expires_at && ` · expires ${new Date(d.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(d.status === "processing" || d.status === "purchased" || d.status === "pending_payment") && (
                      <button
                        onClick={() => retryAutoConfigure(d)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 flex items-center gap-1"
                      >
                        <RefreshCw size={10} /> Finish setup
                      </button>
                    )}
                    {/* Resend mail action: set up, or refresh while verifying */}
                    {!d.resend_status && (
                      <button
                        onClick={() => setupMail(d)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 flex items-center gap-1"
                      >
                        <Mail size={10} /> Set up mail
                      </button>
                    )}
                    {(d.resend_status === "verifying" || d.resend_status === "pending") && (
                      <button
                        onClick={() => refreshMailStatus(d)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-blue-500/30 text-blue-300 hover:bg-blue-500/10 flex items-center gap-1"
                      >
                        <RefreshCw size={10} /> Check status
                      </button>
                    )}
                    {d.resend_status === "failed" && (
                      <button
                        onClick={() => setupMail(d)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 flex items-center gap-1"
                      >
                        <RefreshCw size={10} /> Retry mail
                      </button>
                    )}
                    <button onClick={() => openDns(d)} className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1">
                      <Edit3 size={10} /> DNS
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(d.domain); toast.success("Copied"); }}
                      className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"
                    >
                      <Copy size={10} />
                    </button>
                    <a
                      href={`https://${d.domain}`}
                      target="_blank"
                      rel="noopener"
                      className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"
                    >
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                {/* Connect to website */}
                <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted">Link to website:</span>
                  <select
                    value={d.website_id || ""}
                    onChange={e => connectToWebsite(d.id, e.target.value)}
                    className="text-[10px] py-1 px-2 rounded-lg bg-surface border border-border text-foreground"
                  >
                    <option value="">Not linked</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {d.website_id && (
                    <span className="text-[10px] flex items-center gap-1 text-success">
                      <VercelIcon size={10} /> deployed
                    </span>
                  )}
                </div>

                {/* Resend mail-status hints */}
                {d.resend_status === "verified" && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/20 text-[10px] text-green-300 flex items-center gap-2 flex-wrap">
                    <MailCheck size={11} />
                    <span>Client can now send from <span className="font-mono">anything@{d.domain}</span></span>
                    <a
                      href={`/dashboard/mail-setup?domain=${encodeURIComponent(d.domain)}`}
                      className="ml-auto inline-flex items-center gap-1 text-green-200 hover:text-green-100"
                    >
                      Open in Mail Setup <ArrowUpRight size={10} />
                    </a>
                  </div>
                )}
                {/* When mail is set up but still verifying, cross-link to the
                    dedicated /dashboard/mail-setup page so the user can
                    copy-paste DNS records or trigger a re-verify. */}
                {(d.resend_status === "verifying" || d.resend_status === "pending") && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[10px] text-blue-200 flex items-center gap-2 flex-wrap">
                    <Mail size={11} />
                    <span>DNS records are propagating — this usually takes a few minutes.</span>
                    <a
                      href={`/dashboard/mail-setup?domain=${encodeURIComponent(d.domain)}`}
                      className="ml-auto inline-flex items-center gap-1 text-blue-100 hover:text-white"
                    >
                      View records <ArrowUpRight size={10} />
                    </a>
                  </div>
                )}
                {d.resend_status === "failed" && d.resend_last_error && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-[10px] text-red-300 flex items-start gap-2">
                    <MailWarning size={11} className="mt-0.5 shrink-0" />
                    <span className="break-all flex-1">{d.resend_last_error}</span>
                    <a
                      href={`/dashboard/mail-setup?domain=${encodeURIComponent(d.domain)}`}
                      className="shrink-0 inline-flex items-center gap-1 text-red-200 hover:text-red-100"
                    >
                      Debug <ArrowUpRight size={10} />
                    </a>
                  </div>
                )}
                {/* No mail yet — gentle nudge since this is the "agency flow" win */}
                {!d.resend_status && (d.status === "active" || d.status === "dns_configured" || d.status === "purchased") && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-gold/5 border border-gold/20 text-[10px] text-gold flex items-center gap-2 flex-wrap">
                    <Sparkles size={11} />
                    <span>
                      Send marketing email from{" "}
                      <span className="font-mono">hello@{d.domain}</span>? Takes ~1 minute.
                    </span>
                    <button
                      onClick={() => setupMail(d)}
                      className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline"
                    >
                      Set up now <ArrowUpRight size={10} />
                    </button>
                  </div>
                )}

                {/* DNS editor */}
                {dnsOpen === d.id && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-[11px] font-semibold flex items-center gap-1.5">
                        <ShieldCheck size={12} className="text-gold" /> DNS Records
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button onClick={pointToVercel} className="text-[10px] px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 flex items-center gap-1">
                          <VercelIcon size={10} /> Point to Vercel
                        </button>
                        <button onClick={addDnsRecord} className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1">
                          <Plus size={10} /> Record
                        </button>
                      </div>
                    </div>

                    {dnsLoading ? (
                      <div className="py-4 text-center text-[10px] text-muted">Loading DNS...</div>
                    ) : dnsRecords.length === 0 ? (
                      <p className="text-[10px] text-muted py-2">No records. Click &ldquo;Point to Vercel&rdquo; for a one-click setup.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dnsRecords.map((r, i) => (
                          <div key={i} className="grid grid-cols-12 gap-1.5 items-center text-[10px]">
                            <select
                              value={r.type}
                              onChange={e => updateDnsRecord(i, { type: e.target.value })}
                              className="col-span-2 input text-[10px] py-1"
                            >
                              {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <input
                              value={r.name}
                              onChange={e => updateDnsRecord(i, { name: e.target.value })}
                              placeholder="name"
                              className="col-span-3 input text-[10px] py-1"
                            />
                            <input
                              value={r.data}
                              onChange={e => updateDnsRecord(i, { data: e.target.value })}
                              placeholder="value"
                              className="col-span-5 input text-[10px] py-1"
                            />
                            <input
                              type="number"
                              value={r.ttl || 3600}
                              onChange={e => updateDnsRecord(i, { ttl: Number(e.target.value) })}
                              className="col-span-1 input text-[10px] py-1"
                            />
                            <button onClick={() => removeDnsRecord(i)} className="col-span-1 p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setDnsOpen(null)} className="text-[10px] text-muted hover:text-foreground">Close</button>
                      <button onClick={() => saveDns(d.domain)} disabled={dnsLoading} className="btn-primary text-[10px] disabled:opacity-50">
                        Save DNS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tip card */}
      <div className="card border-gold/10">
        <h3 className="text-[11px] font-semibold flex items-center gap-1.5 mb-2">
          <AlertTriangle size={11} className="text-gold" /> How domain ownership works
        </h3>
        <ul className="text-[10px] text-muted space-y-1 list-disc list-inside">
          <li>Domains are registered under your ShortStack GoDaddy customer account.</li>
          <li>You (the agency) own the registration until you transfer it to the client.</li>
          <li>Use DNS records above to point your domain to Vercel (A: 76.76.21.21, CNAME: cname.vercel-dns.com).</li>
          <li>SSL is auto-provisioned by Vercel once DNS resolves.</li>
          <li>Transfer out any time via the GoDaddy dashboard using the auth code.</li>
          <li>
            After purchase →{" "}
            <a href="/dashboard/mail-setup" className="text-gold hover:underline">
              Mail Setup
            </a>{" "}
            writes Resend DKIM/SPF so the client can send email from their own domain.
          </li>
        </ul>
      </div>
    </div>
  );
}
