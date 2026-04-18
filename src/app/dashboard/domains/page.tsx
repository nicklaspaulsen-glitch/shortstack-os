"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Search, Loader, CheckCircle, XCircle, ExternalLink,
  ShieldCheck, Plus, RefreshCw, Link2, Copy, Trash2,
  AlertTriangle, Edit3,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { VercelIcon, GoDaddyIcon } from "@/components/ui/platform-icons";

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
}

interface DnsRecord {
  type: string;
  name: string;
  data: string;
  ttl?: number;
}

interface SearchResult {
  domain: string;
  available: boolean;
  price: number | null;
  currency: string;
  source: string;
}

interface ProjectRef {
  id: string;
  name: string;
  vercel_url: string | null;
  custom_domain: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
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

  // search UI
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  // DNS editor state
  const [dnsOpen, setDnsOpen] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dnsLoading, setDnsLoading] = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);

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
      } else {
        toast.error(data.error || "Search failed");
      }
    } catch {
      toast.error("Search failed");
    }
    setSearching(false);
  }

  async function purchaseDomain(domain: string) {
    if (!confirm(`Purchase ${domain}?`)) return;
    try {
      const res = await fetch("/api/websites/domains/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.stub ? "Domain reserved (stub mode)" : `Domain ${domain} purchased!`);
        await loadData();
      } else {
        toast.error(data.error || "Purchase failed");
      }
    } catch {
      toast.error("Purchase failed");
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

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Link2 size={28} />}
        title="Domains"
        subtitle="Search, buy & manage domains via GoDaddy. Connect them to your Vercel deployments."
        gradient="ocean"
        actions={
          <div className="flex items-center gap-1.5 text-[10px] text-white/80 bg-white/10 border border-white/20 px-2 py-1 rounded-lg">
            <GoDaddyIcon size={12} /> GoDaddy
            <span className="opacity-40">·</span>
            <VercelIcon size={12} /> Vercel
          </div>
        }
      />

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
            {results.map(r => (
              <div key={r.domain} className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-light">
                <div className="flex items-center gap-2 min-w-0">
                  {r.available
                    ? <CheckCircle size={14} className="text-success shrink-0" />
                    : <XCircle size={14} className="text-muted shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{r.domain}</p>
                    <p className="text-[10px] text-muted">
                      {r.available
                        ? (r.price ? `${r.currency} $${r.price.toFixed(2)}/yr` : "Available")
                        : "Taken"}
                    </p>
                  </div>
                </div>
                {r.available && (
                  <button
                    onClick={() => purchaseDomain(r.domain)}
                    className="text-[10px] px-3 py-1.5 rounded-lg bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 flex items-center gap-1"
                  >
                    <Plus size={10} /> Buy
                  </button>
                )}
              </div>
            ))}
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
                      </div>
                      <p className="text-[10px] text-muted mt-0.5">
                        {d.purchase_price ? `$${d.purchase_price.toFixed(2)} / year` : "—"}
                        {d.expires_at && ` · expires ${new Date(d.expires_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
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
          <li>You (the client) own the domain — we just process the purchase.</li>
          <li>Use DNS records above to point your domain to Vercel (A: 76.76.21.21, CNAME: cname.vercel-dns.com).</li>
          <li>SSL is auto-provisioned by Vercel once DNS resolves.</li>
          <li>Transfer out any time via the GoDaddy dashboard using the auth code.</li>
        </ul>
      </div>
    </div>
  );
}
