"use client";

/**
 * Mail Setup — agency-facing page to add a custom email subdomain
 * (like `mail.yourclient.com`) so outbound email uses the agency's
 * brand instead of the shared ShortStack domain.
 *
 * Flow:
 *   1. Enter the subdomain you want to send from
 *   2. We register it with Resend → returns DNS records
 *   3. Add the records to your DNS provider (copy-paste each)
 *   4. Click "Verify" — we poll Resend until the status flips to verified
 *   5. Done: use the new address as the `from` on future campaigns
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  ArrowLeft,
  ArrowRight,
  Loader,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Trash2,
  Globe,
  Sparkles,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";

interface DnsRecord {
  type: string;
  name: string;
  value: string;
  priority?: number;
  ttl?: string | number;
}

interface AgencyDomain {
  id?: string;
  resend_id?: string;
  domain: string;
  status: string; // pending | verifying | verified | failed
  records: DnsRecord[];
  verified_at?: string | null;
  created_at?: string;
}

export default function MailSetupPage() {
  useAuth();
  const [mode, setMode] = useState<"list" | "new">("list");
  const [domains, setDomains] = useState<AgencyDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AgencyDomain | null>(null);
  const [polling, setPolling] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);

  // New-domain wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [newDomain, setNewDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mail-setup");
      const data = await res.json();
      if (data.ok) {
        setDomains((data.domains as AgencyDomain[]) || []);
      }
    } catch (err) {
      console.error("[mail-setup] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  async function createDomain() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/mail-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Failed (${res.status})`);
        return;
      }
      const row: AgencyDomain = {
        resend_id: data.id,
        domain: data.domain,
        status: data.status,
        records: data.records || [],
      };
      setSelected(row);
      setDomains((d) => [row, ...d]);
      setStep(3);
      toast.success("Domain registered — add the DNS records next.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyDomain(resendId: string) {
    setPolling(true);
    try {
      const res = await fetch(`/api/mail-setup?id=${resendId}&verify=1`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Verify failed (${res.status})`);
        return;
      }
      // Update our state row
      setDomains((d) =>
        d.map((row) =>
          row.resend_id === resendId || row.id === data.id
            ? { ...row, status: data.status, records: data.records }
            : row,
        ),
      );
      if (selected?.resend_id === resendId) {
        setSelected({ ...selected, status: data.status, records: data.records });
      }
      if (data.status === "verified") {
        toast.success("Domain verified — you can send from it now.");
      } else if (data.status === "failed") {
        toast.error("Verification failed — double-check the DNS records.");
      } else {
        toast(`Status: ${data.status} — DNS may still be propagating.`, { icon: "⏳" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setPolling(false);
    }
  }

  async function deleteDomain(resendId: string) {
    if (!window.confirm("Remove this domain from Resend? You'll need to re-verify if you add it back.")) {
      return;
    }
    try {
      const res = await fetch(`/api/mail-setup?id=${resendId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || `Delete failed (${res.status})`);
        return;
      }
      setDomains((d) => d.filter((row) => row.resend_id !== resendId));
      if (selected?.resend_id === resendId) setSelected(null);
      toast.success("Domain removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function copyRecord(id: string, text: string) {
    try {
      navigator.clipboard.writeText(text);
      setCopiedRow(id);
      setTimeout(() => setCopiedRow(null), 1200);
      toast.success("Copied!");
    } catch {
      toast.error("Copy failed");
    }
  }

  const validDomain = useMemo(
    () => /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(newDomain.trim()),
    [newDomain],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="Mail Setup"
        subtitle="Send email from your own branded subdomain (mail.yourdomain.com) so it lands in the inbox, not spam."
        icon={<Mail size={20} />}
      />

      <div className="mx-auto max-w-5xl px-6 pb-10">
        {mode === "list" ? (
          // ───────────── LIST VIEW ─────────────
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your email domains</h2>
              <button
                onClick={() => {
                  setMode("new");
                  setStep(1);
                  setNewDomain("");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90"
              >
                <Plus size={14} /> Add domain
              </button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader size={14} className="animate-spin" /> Loading…
              </div>
            ) : domains.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/50 bg-surface-light/20 p-10 text-center">
                <Mail size={28} className="mx-auto mb-3 text-muted" />
                <h3 className="mb-1 text-base font-semibold">No custom domains yet</h3>
                <p className="mx-auto mb-4 max-w-md text-sm text-muted">
                  Add your first subdomain to send email from your own brand. Outbound messages
                  will use <span className="font-mono text-foreground">yourname@mail.yourdomain.com</span> instead of the shared ShortStack address.
                </p>
                <button
                  onClick={() => {
                    setMode("new");
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black"
                >
                  <Plus size={14} /> Add your first domain
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {domains.map((d) => (
                  <DomainRow
                    key={d.resend_id || d.id}
                    domain={d}
                    onVerify={() => d.resend_id && verifyDomain(d.resend_id)}
                    onView={() => setSelected(d)}
                    onDelete={() => d.resend_id && deleteDomain(d.resend_id)}
                    polling={polling}
                  />
                ))}
              </div>
            )}

            {/* Detail pane for currently-selected row */}
            {selected && (
              <div className="mt-6 rounded-xl border border-gold/30 bg-gold/5 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">DNS records for <span className="font-mono">{selected.domain}</span></h3>
                    <p className="text-[11px] text-muted">
                      Add each record to your DNS provider exactly as shown, then click Verify.
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    Close
                  </button>
                </div>
                <DnsRecordList
                  records={selected.records}
                  copiedRow={copiedRow}
                  onCopy={copyRecord}
                />
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => selected.resend_id && verifyDomain(selected.resend_id)}
                    disabled={polling}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {polling ? (
                      <>
                        <Loader size={14} className="animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        <RotateCw size={14} /> Verify DNS
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          // ───────────── NEW DOMAIN WIZARD ─────────────
          <>
            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((n) => {
                const label = n === 1 ? "Domain" : n === 2 ? "Review" : "DNS";
                const active = step === n;
                const done = step > n;
                return (
                  <div key={n} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                        done
                          ? "bg-gold text-black"
                          : active
                            ? "bg-gold/15 text-gold ring-2 ring-gold/50"
                            : "bg-surface-light text-muted"
                      }`}
                    >
                      {done ? <Check size={12} /> : n}
                    </div>
                    <span
                      className={`text-[11px] ${active ? "text-foreground" : "text-muted"}`}
                    >
                      {label}
                    </span>
                    {n < 3 && <div className="ml-1 flex-1 h-px bg-border/60" />}
                  </div>
                );
              })}
            </div>

            {step === 1 && (
              <div className="rounded-xl border border-border/50 bg-surface-light/20 p-6">
                <h2 className="mb-1 text-lg font-semibold">Pick a subdomain</h2>
                <p className="mb-4 text-sm text-muted">
                  Recommended pattern: <span className="font-mono text-foreground">mail.yourdomain.com</span>
                  — separates marketing email from your root domain&apos;s reputation.
                </p>

                <label className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                  Subdomain
                </label>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="mail.yourdomain.com"
                  className="mb-1 w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 font-mono text-sm placeholder:text-muted"
                  autoFocus
                />
                {newDomain && !validDomain && (
                  <p className="text-[11px] text-amber-400">
                    Use a real domain format — e.g. <span className="font-mono">mail.example.com</span>
                  </p>
                )}
                {validDomain && (
                  <p className="text-[11px] text-emerald-400">✓ Looks good</p>
                )}

                <div className="mt-6 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-[11px] text-amber-300">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                  <p>
                    Use a subdomain you CONTROL. You&apos;ll need to add 3–5 DNS records to
                    complete verification. Don&apos;t use your root domain — it affects your
                    main website&apos;s email reputation.
                  </p>
                </div>

                <div className="mt-5 flex justify-between">
                  <button
                    onClick={() => setMode("list")}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"
                  >
                    <ArrowLeft size={14} /> Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!validDomain}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    Review <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-xl border border-border/50 bg-surface-light/20 p-6">
                <h2 className="mb-1 text-lg font-semibold">Confirm</h2>
                <p className="mb-5 text-sm text-muted">
                  Ready to register this domain with Resend?
                </p>

                <div className="mb-5 space-y-3 rounded-lg border border-border/40 bg-background/40 p-4">
                  <Row label="Domain" value={<span className="font-mono font-semibold">{newDomain}</span>} />
                  <Row label="Provider" value="Resend" />
                  <Row label="Cost" value="Free (uses your existing Resend plan)" />
                  <Row
                    label="What happens next"
                    value={
                      <span className="text-[13px]">
                        We register the domain with Resend → you receive 3-5 DNS records →
                        you add them to your DNS provider → we verify.
                      </span>
                    }
                  />
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-40"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={createDomain}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader size={14} className="animate-spin" /> Creating…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Register domain
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && selected && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                  <h2 className="text-lg font-semibold">
                    Domain registered — add these DNS records
                  </h2>
                </div>

                <DnsRecordList
                  records={selected.records}
                  copiedRow={copiedRow}
                  onCopy={copyRecord}
                />

                <div className="mt-5 rounded-lg border border-border/40 bg-background/40 p-4 text-[12px] text-muted">
                  <p className="mb-1 font-semibold text-foreground">Adding records in…</p>
                  <ul className="ml-4 list-disc space-y-0.5">
                    <li>
                      <strong>GoDaddy:</strong> Domains → your domain → DNS → Add new record
                    </li>
                    <li>
                      <strong>Cloudflare:</strong> Websites → your site → DNS → Records → Add record
                    </li>
                    <li>
                      <strong>Namecheap:</strong> Domain List → Manage → Advanced DNS → Add new record
                    </li>
                    <li>
                      <strong>Route 53:</strong> Hosted zones → your zone → Create record
                    </li>
                  </ul>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => selected.resend_id && verifyDomain(selected.resend_id)}
                    disabled={polling}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                  >
                    {polling ? (
                      <>
                        <Loader size={14} className="animate-spin" /> Verifying…
                      </>
                    ) : (
                      <>
                        <RotateCw size={14} /> Verify DNS
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setMode("list");
                      loadDomains();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-4 py-2 text-sm font-semibold transition hover:bg-surface-light"
                  >
                    Back to list
                  </button>
                </div>

                <p className="mt-3 text-[11px] text-muted">
                  DNS changes typically propagate in 5–30 minutes. You can close this page and come back —
                  the domain will be in your list with its current status.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}

function DomainRow({
  domain,
  onVerify,
  onView,
  onDelete,
  polling,
}: {
  domain: AgencyDomain;
  onVerify: () => void;
  onView: () => void;
  onDelete: () => void;
  polling: boolean;
}) {
  const statusColor =
    domain.status === "verified"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : domain.status === "failed"
        ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";
  const statusLabel =
    domain.status === "verified"
      ? "✓ Verified"
      : domain.status === "failed"
        ? "× Failed"
        : "⏳ Pending";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-light/20 p-3">
      <Globe size={18} className="shrink-0 text-muted" />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-semibold">{domain.domain}</p>
        {domain.created_at && (
          <p className="text-[11px] text-muted">Added {new Date(domain.created_at).toLocaleDateString()}</p>
        )}
      </div>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}>
        {statusLabel}
      </span>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={onView}
          className="rounded bg-surface-light/80 px-2 py-1 text-[11px] hover:bg-surface-light"
          title="View DNS records"
        >
          Records
        </button>
        {domain.status !== "verified" && (
          <button
            onClick={onVerify}
            disabled={polling}
            className="rounded bg-gold/15 px-2 py-1 text-[11px] text-gold hover:bg-gold/25 disabled:opacity-60"
          >
            Verify
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
          title="Remove domain"
          aria-label="Remove domain"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function DnsRecordList({
  records,
  copiedRow,
  onCopy,
}: {
  records: DnsRecord[];
  copiedRow: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  if (!records || records.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-6 text-center text-sm text-muted">
        No DNS records returned — try verifying to refresh.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {records.map((r, i) => {
        const rowId = `${r.type}-${r.name}-${i}`;
        return (
          <div
            key={rowId}
            className="rounded-lg border border-border/50 bg-background/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="rounded bg-gold/15 px-2 py-0.5 text-[10px] font-bold uppercase text-gold">
                {r.type}
              </span>
              {r.priority !== undefined && (
                <span className="text-[10px] text-muted">Priority: {r.priority}</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr_auto]">
              <div>
                <p className="text-[10px] uppercase text-muted">Name / Host</p>
                <p className="truncate font-mono text-[12px]">{r.name}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase text-muted">Value</p>
                <p className="truncate font-mono text-[12px]" title={r.value}>
                  {r.value}
                </p>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => onCopy(rowId, r.value)}
                  className="inline-flex items-center gap-1 rounded-md bg-surface-light/80 px-2 py-1 text-[10px] hover:bg-surface-light"
                >
                  {copiedRow === rowId ? (
                    <>
                      <Check size={10} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={10} /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
