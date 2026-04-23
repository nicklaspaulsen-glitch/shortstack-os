"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import {
  FileBarChart,
  Users,
  Calendar,
  ListChecks,
  Eye,
  Download,
  Mail,
  Loader,
  Clock,
  FileText,
  Check,
  History,
  RefreshCw,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { Wizard, type WizardStepDef } from "@/components/ui/wizard";

/* ── Types ──────────────────────────────────────────────────── */

interface Client {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  industry: string | null;
}

interface HistoryRow {
  id: string;
  client_id: string | null;
  metrics: string[];
  date_from: string;
  date_to: string;
  pdf_url: string | null;
  pdf_size_bytes: number | null;
  created_at: string;
}

/* ── Metric catalogue — ids match what the API expects ─────── */

const METRIC_OPTIONS: { id: string; label: string; group: "outbound" | "revenue" | "content" | "platform" }[] = [
  { id: "leads_scraped", label: "Leads scraped", group: "outbound" },
  { id: "emails_sent", label: "Emails sent", group: "outbound" },
  { id: "calls_made", label: "Calls made", group: "outbound" },
  { id: "conversion_rate", label: "Conversion rate", group: "outbound" },
  { id: "deals_moved", label: "Deals moved", group: "revenue" },
  { id: "revenue_generated", label: "Revenue generated", group: "revenue" },
  { id: "cost_summary", label: "Cost summary", group: "revenue" },
  { id: "social_posts", label: "Social posts", group: "content" },
  { id: "video_content", label: "Video content", group: "content" },
  { id: "thumbnails_created", label: "Thumbnails created", group: "content" },
  { id: "top_content", label: "Top content pieces", group: "content" },
  { id: "page_views", label: "Page views / impressions", group: "platform" },
  { id: "ai_tokens_used", label: "AI tokens used", group: "platform" },
  { id: "customer_feedback", label: "Customer feedback", group: "platform" },
];

const GROUP_LABEL: Record<string, string> = {
  outbound: "Outbound & Leads",
  revenue: "Deals & Revenue",
  content: "Content",
  platform: "Platform Usage",
};

const RANGE_PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "custom", label: "Custom range", days: 0 },
] as const;

/* ── Helpers ───────────────────────────────────────────────── */

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* ── Component ─────────────────────────────────────────────── */

export default function ReportGeneratorPage() {
  const supabase = createClient();

  // Step state
  const [step, setStep] = useState(0);

  // Form state
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [rangePreset, setRangePreset] = useState<string>("30");
  const [customFrom, setCustomFrom] = useState<string>(isoDate(new Date(Date.now() - 30 * 86400000)));
  const [customTo, setCustomTo] = useState<string>(isoDate(new Date()));
  const [metrics, setMetrics] = useState<string[]>([
    "leads_scraped", "emails_sent", "deals_moved", "revenue_generated",
  ]);
  const [emailToClient, setEmailToClient] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Data state
  const [loadingClients, setLoadingClients] = useState(true);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Computed dates for the current selection
  const { fromDate, toDate } = useMemo(() => {
    if (rangePreset === "custom") {
      return { fromDate: customFrom, toDate: customTo };
    }
    const preset = RANGE_PRESETS.find(p => p.id === rangePreset);
    const days = preset?.days || 30;
    return {
      fromDate: isoDate(new Date(Date.now() - days * 86400000)),
      toDate: isoDate(new Date()),
    };
  }, [rangePreset, customFrom, customTo]);

  const selectedClientObj = useMemo(
    () => clients.find(c => c.id === selectedClient) || null,
    [clients, selectedClient],
  );

  /* ── Load data ────────────────────────────────────────── */

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    const { data } = await supabase
      .from("clients")
      .select("id, business_name, contact_name, email, industry")
      .order("business_name");
    setClients(data || []);
    setLoadingClients(false);
  }, [supabase]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/reports/pdf?limit=20");
      const json = await res.json();
      setHistory(json.reports || []);
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetchClients();
    fetchHistory();
  }, [fetchClients, fetchHistory]);

  /* ── Actions ──────────────────────────────────────────── */

  const toggleMetric = (id: string) => {
    setMetrics(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
  };

  const generate = useCallback(async () => {
    if (!selectedClient || metrics.length === 0) return;
    setGenerating(true);
    const promise = fetch("/api/reports/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: selectedClient,
        date_from: fromDate,
        date_to: toDate,
        metrics,
        email_to_client: emailToClient,
      }),
    }).then(async (res) => {
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Generation failed");
      return json as { pdf_url: string; emailed: boolean; email_error: string | null };
    });

    try {
      const result = await toast.promise(promise, {
        loading: "Generating PDF report…",
        success: "Report generated",
        error: (err) => err instanceof Error ? err.message : "Failed to generate report",
      });
      // Open the PDF in a new tab
      window.open(result.pdf_url, "_blank", "noopener,noreferrer");
      if (emailToClient) {
        if (result.emailed) toast.success("Emailed to client with PDF attached");
        else toast.error(`Email send failed: ${result.email_error || "unknown"}`);
      }
      fetchHistory();
    } catch {
      // Error already toasted
    } finally {
      setGenerating(false);
    }
  }, [selectedClient, metrics, fromDate, toDate, emailToClient, fetchHistory]);

  /* ── Step components ──────────────────────────────────── */

  const stepClient = (
    <div className="space-y-3">
      <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Client</label>
      {loadingClients ? (
        <div className="flex items-center gap-2 text-xs text-muted"><Loader size={12} className="animate-spin" /> Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="p-4 rounded-xl bg-surface-light border border-border/30 text-xs text-muted">
          No clients yet. Add one in the Clients page first.
        </div>
      ) : (
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="input text-xs w-full"
          autoFocus
        >
          <option value="">Select a client…</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.business_name}</option>
          ))}
        </select>
      )}
      {selectedClientObj && (
        <div className="p-3 rounded-xl bg-surface-light border border-border/30 text-xs">
          <p className="font-semibold text-foreground">{selectedClientObj.business_name}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] text-muted">
            {selectedClientObj.contact_name && <span>Contact: {selectedClientObj.contact_name}</span>}
            {selectedClientObj.email && <span>Email: {selectedClientObj.email}</span>}
            {selectedClientObj.industry && <span>Industry: {selectedClientObj.industry}</span>}
          </div>
        </div>
      )}
    </div>
  );

  const stepRange = (
    <div className="space-y-3">
      <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Date range</label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {RANGE_PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setRangePreset(p.id)}
            className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${
              rangePreset === p.id
                ? "bg-gold/10 border-gold/40 text-gold"
                : "bg-surface-light border-border/30 text-muted hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {rangePreset === "custom" && (
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider font-medium">From</label>
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={e => setCustomFrom(e.target.value)}
              className="input text-xs w-full mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider font-medium">To</label>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={isoDate(new Date())}
              onChange={e => setCustomTo(e.target.value)}
              className="input text-xs w-full mt-1"
            />
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted">Window: <span className="text-foreground font-medium">{fromDate}</span> → <span className="text-foreground font-medium">{toDate}</span></p>
    </div>
  );

  const stepMetrics = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Metrics to include</label>
        <div className="flex items-center gap-2 text-[10px]">
          <button
            type="button"
            onClick={() => setMetrics(METRIC_OPTIONS.map(m => m.id))}
            className="text-gold hover:underline"
          >
            Select all
          </button>
          <span className="text-muted">·</span>
          <button type="button" onClick={() => setMetrics([])} className="text-muted hover:text-foreground">
            Clear
          </button>
        </div>
      </div>
      {(["outbound", "revenue", "content", "platform"] as const).map(group => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] text-muted font-semibold uppercase tracking-wider">{GROUP_LABEL[group]}</p>
          <div className="grid grid-cols-2 gap-2">
            {METRIC_OPTIONS.filter(m => m.group === group).map(m => {
              const on = metrics.includes(m.id);
              return (
                <label
                  key={m.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-xs transition-all ${
                    on ? "border-gold/40 bg-gold/5 text-foreground" : "border-border/30 bg-surface-light text-muted hover:text-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleMetric(m.id)}
                    className="accent-gold"
                  />
                  <span>{m.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted">Pick at least one metric. The PDF will include a section per metric.</p>
    </div>
  );

  const previewBlock = (
    <div className="bg-surface-light border border-border/30 rounded-2xl p-5 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <FileText size={12} className="text-gold" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-gold">Report preview</p>
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-foreground">{selectedClientObj?.business_name || "No client selected"}</p>
        {selectedClientObj?.industry && <p className="text-[11px] text-muted">{selectedClientObj.industry}</p>}
        <p className="text-[11px] text-muted">
          <Calendar size={10} className="inline -mt-0.5 mr-1" />
          {fromDate} → {toDate}
        </p>
      </div>
      <div className="mt-3 border-t border-border/30 pt-3 space-y-2">
        {metrics.length === 0 ? (
          <p className="text-[11px] text-muted italic">No metrics selected yet.</p>
        ) : (
          metrics.map(id => {
            const meta = METRIC_OPTIONS.find(m => m.id === id);
            return (
              <div key={id} className="flex items-center gap-2 text-[11px]">
                <Check size={11} className="text-gold" />
                <span className="text-foreground">{meta?.label || id}</span>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-3 border-t border-border/30 pt-3">
        <label className="flex items-center gap-2 text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={emailToClient}
            onChange={e => setEmailToClient(e.target.checked)}
            className="accent-gold"
            disabled={!selectedClientObj?.email}
          />
          <Mail size={11} className="text-gold" />
          <span className={selectedClientObj?.email ? "text-foreground" : "text-muted"}>
            Email PDF to client{selectedClientObj?.email ? ` (${selectedClientObj.email})` : " (client email missing)"}
          </span>
        </label>
      </div>
    </div>
  );

  const stepPreview = (
    <div className="space-y-4">
      {previewBlock}
      <div className="text-[10px] text-muted">
        Click <span className="font-semibold text-foreground">Generate PDF</span> to render the report, upload it to
        secure storage, and save it to your history. Signed URL valid for 7 days.
      </div>
    </div>
  );

  const steps: WizardStepDef[] = [
    {
      id: "client",
      title: "Client",
      description: "Pick which client this report is for.",
      component: stepClient,
      canProceed: !!selectedClient,
      icon: <Users size={16} />,
    },
    {
      id: "range",
      title: "Date range",
      description: "Choose the reporting window.",
      component: stepRange,
      canProceed: rangePreset !== "custom" || (!!customFrom && !!customTo && customFrom <= customTo),
      icon: <Calendar size={16} />,
    },
    {
      id: "metrics",
      title: "Metrics",
      description: "Select what goes into the PDF.",
      component: stepMetrics,
      canProceed: metrics.length > 0,
      icon: <ListChecks size={16} />,
    },
    {
      id: "preview",
      title: "Preview & generate",
      description: "Final check. We'll render a PDF and optionally email it.",
      component: stepPreview,
      canProceed: !!selectedClient && metrics.length > 0,
      icon: <Eye size={16} />,
    },
  ];

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 fade-in">
      <PageHero
        icon={<FileBarChart size={22} />}
        title="Report Generator"
        subtitle="Professional, white-labeled PDF reports for your clients — built from real data in your workspace."
        gradient="gold"
        actions={
          <button
            onClick={() => { fetchClients(); fetchHistory(); }}
            className="text-xs flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white font-medium hover:bg-white/25 transition-all"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Wizard
            steps={steps}
            onFinish={generate}
            finishLabel={generating ? "Generating…" : "Generate PDF"}
            busy={generating}
            preview={
              step === 3 ? undefined : (
                <div className="text-[11px] text-muted flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Users size={10} className="text-gold" />
                    {selectedClientObj?.business_name || "No client"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={10} className="text-gold" />
                    {fromDate} → {toDate}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ListChecks size={10} className="text-gold" />
                    {metrics.length} metric{metrics.length === 1 ? "" : "s"}
                  </span>
                </div>
              )
            }
            activeIdx={step}
            onStepChange={setStep}
          />
        </div>

        <div className="lg:col-span-1 space-y-4">
          {/* Live preview always visible on desktop */}
          <div className="hidden lg:block">
            {previewBlock}
          </div>

          {/* Past reports */}
          <div className="bg-surface border border-border/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <History size={14} className="text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Past reports</h2>
              <span className="text-[9px] text-muted bg-surface-light px-2 py-0.5 rounded-full">{history.length}</span>
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader size={14} className="animate-spin text-muted" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-[11px] text-muted py-4 text-center">No reports generated yet.</div>
            ) : (
              <ul className="space-y-2">
                {history.map(r => {
                  const c = clients.find(cl => cl.id === r.client_id);
                  return (
                    <li key={r.id} className="border border-border/30 rounded-xl px-3 py-2.5 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">
                          {c?.business_name || "Unknown client"}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {r.date_from} → {r.date_to} · {r.metrics.length} metric{r.metrics.length === 1 ? "" : "s"} · {fmtBytes(r.pdf_size_bytes)}
                        </p>
                        <p className="text-[9px] text-muted/70">
                          <Clock size={8} className="inline -mt-0.5 mr-1" />
                          {new Date(r.created_at).toLocaleString()}
                        </p>
                      </div>
                      {r.pdf_url && (
                        <a
                          href={r.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline shrink-0"
                          title="Download (signed URL, 7-day expiry)"
                        >
                          <Download size={10} />
                          PDF
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
