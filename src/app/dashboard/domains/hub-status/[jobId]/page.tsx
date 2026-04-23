"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Mail, Phone, Globe, LayoutDashboard, MessageSquare,
  CheckCircle, AlertTriangle, RefreshCw, Loader, Copy,
  ExternalLink, Sparkles, ShieldCheck, Info,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/**
 * Live-progress page for a Domain-as-Hub provisioning job.
 *
 * Polls `/api/domains/hub-setup/job/:id` every 1.5s until every sub-task
 * reaches a terminal state. Then freezes polling.
 *
 * Each of 5 colored dots:
 *   gray     → pending
 *   yellow   → in_progress
 *   green    → done
 *   red      → failed  (with retry button)
 *   faded    → skipped (toggle was off)
 */

type ServiceKey = "email" | "phone" | "website" | "portal" | "chat";

interface ServiceSummary {
  service: ServiceKey;
  enabled: boolean;
  status: "pending" | "in_progress" | "done" | "failed" | "skipped";
  result: Record<string, unknown> | null;
}

interface JobResponse {
  id: string;
  domain: string;
  services: ServiceSummary[];
  errors: Array<{ service: string; error: string; at: string }>;
  completed_at: string | null;
  created_at: string;
  all_done: boolean;
  any_failed: boolean;
  all_green: boolean;
}

const SERVICE_META: Record<ServiceKey, { label: string; icon: React.ReactNode }> = {
  email: { label: "Branded email", icon: <Mail size={14} /> },
  phone: { label: "Phone number", icon: <Phone size={14} /> },
  website: { label: "Website", icon: <Globe size={14} /> },
  portal: { label: "Client portal", icon: <LayoutDashboard size={14} /> },
  chat: { label: "Chat widget", icon: <MessageSquare size={14} /> },
};

function dotColor(status: ServiceSummary["status"]): string {
  switch (status) {
    case "done": return "bg-emerald-500";
    case "failed": return "bg-red-500";
    case "in_progress": return "bg-amber-400 animate-pulse";
    case "skipped": return "bg-slate-600 opacity-40";
    default: return "bg-slate-500";
  }
}

function dotLabel(status: ServiceSummary["status"]): string {
  switch (status) {
    case "done": return "Ready";
    case "failed": return "Failed";
    case "in_progress": return "Working…";
    case "skipped": return "Skipped";
    default: return "Queued";
  }
}

export default function HubStatusPage() {
  const params = useParams();
  const rawJobId = params?.jobId;
  const jobId = Array.isArray(rawJobId) ? rawJobId[0] : rawJobId;
  const [job, setJob] = useState<JobResponse | null>(null);
  const [retrying, setRetrying] = useState<ServiceKey | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/domains/hub-setup/job/${jobId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as JobResponse;
      setJob(data);
      // Keep polling every 1.5s until every sub-task is terminal. Then stop.
      if (!data.all_done) {
        pollRef.current = setTimeout(poll, 1500);
      }
    } catch {
      pollRef.current = setTimeout(poll, 3000);
    }
  }, [jobId]);

  useEffect(() => {
    poll();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [poll]);

  async function retry(service: ServiceKey) {
    if (!jobId) return;
    setRetrying(service);
    try {
      const res = await fetch(`/api/domains/hub-setup/job/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Retrying ${service}…`);
        // Kick polling back on
        if (pollRef.current) clearTimeout(pollRef.current);
        setTimeout(poll, 500);
      } else {
        toast.error(data.error || "Retry failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(null);
    }
  }

  if (!job) {
    return (
      <div className="fade-in p-6 text-center text-muted text-sm">
        <Loader className="inline animate-spin mr-2" size={14} /> Loading job status…
      </div>
    );
  }

  const orderedServices: ServiceSummary[] = (["email", "phone", "website", "portal", "chat"] as const)
    .map(key => job.services.find(s => s.service === key))
    .filter((s): s is ServiceSummary => !!s);

  const pendingCount = orderedServices.filter(s => s.status === "pending" || s.status === "in_progress").length;

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={job.all_green ? <Sparkles size={28} /> : <Loader size={28} className="animate-spin" />}
        title={job.all_green ? "Your brand is live" : `Provisioning ${job.domain}`}
        subtitle={
          job.all_green
            ? `All services green on ${job.domain}. Share the URLs below.`
            : job.any_failed
              ? "Some sub-tasks need attention — retry below."
              : `${pendingCount} service${pendingCount === 1 ? "" : "s"} still working…`
        }
        gradient={job.all_green ? "gold" : job.any_failed ? "sunset" : "ocean"}
      />

      {/* 5 colored dots — the visual contract from the spec */}
      <div className="card">
        <div className="flex items-center justify-center gap-4 py-2 flex-wrap">
          {orderedServices.map(s => (
            <div key={s.service} className="flex flex-col items-center gap-1 min-w-[90px]">
              <div className={`w-4 h-4 rounded-full ${dotColor(s.status)} ring-2 ring-offset-2 ring-offset-surface ring-transparent`} />
              <span className="text-[10px] text-muted">{SERVICE_META[s.service].label}</span>
              <span className="text-[9px] text-muted/70">{dotLabel(s.status)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-service detail cards */}
      <div className="space-y-3">
        {orderedServices.map(s => {
          const meta = SERVICE_META[s.service];
          if (s.status === "skipped") {
            return (
              <div key={s.service} className="card opacity-60">
                <div className="flex items-center gap-2 text-muted text-xs">
                  {meta.icon}
                  <span>{meta.label} — skipped</span>
                </div>
              </div>
            );
          }
          return (
            <ServiceCard
              key={s.service}
              summary={s}
              meta={meta}
              domain={job.domain}
              onRetry={() => retry(s.service)}
              retrying={retrying === s.service}
            />
          );
        })}
      </div>

      {/* Live-DNS-still-pending callout — relevant once email/portal are done */}
      {job.all_done && (job.services.some(s => s.service === "email" && s.status === "done") ||
        job.services.some(s => s.service === "portal" && s.status === "done")) && (
        <div className="card border-blue-500/20 bg-blue-500/5 flex items-start gap-2">
          <Info size={14} className="text-blue-300 mt-0.5 shrink-0" />
          <div className="text-[11px] text-blue-100">
            <p className="font-semibold mb-1">DNS may still be propagating</p>
            <p className="text-blue-200/80 leading-relaxed">
              Even once all dots go green, DNS records can take up to 24 hours to fully propagate
              at public resolvers — typically though, it&apos;s minutes. Email verification in
              particular may show &ldquo;verifying&rdquo; for a few more minutes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({
  summary,
  meta,
  domain,
  onRetry,
  retrying,
}: {
  summary: ServiceSummary;
  meta: { label: string; icon: React.ReactNode };
  domain: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const r = (summary.result ?? {}) as Record<string, unknown>;

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            summary.status === "done" ? "bg-emerald-500/10 text-emerald-400" :
              summary.status === "failed" ? "bg-red-500/10 text-red-400" :
                summary.status === "in_progress" ? "bg-amber-500/10 text-amber-400" :
                  "bg-slate-500/10 text-muted"
          }`}>
            {summary.status === "done" ? <CheckCircle size={14} /> :
              summary.status === "failed" ? <AlertTriangle size={14} /> :
                summary.status === "in_progress" ? <Loader size={14} className="animate-spin" /> :
                  meta.icon}
          </div>
          <div>
            <p className="text-xs font-semibold">{meta.label}</p>
            <p className="text-[10px] text-muted">{dotLabel(summary.status)}</p>
          </div>
        </div>
        {summary.status === "failed" && (
          <button
            onClick={onRetry}
            disabled={retrying}
            className="text-[10px] px-2.5 py-1 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={10} className={retrying ? "animate-spin" : ""} />
            {retrying ? "Retrying…" : "Retry"}
          </button>
        )}
      </div>

      {summary.status === "done" && (
        <ServiceDoneDetail service={summary.service} result={r} domain={domain} />
      )}
    </div>
  );
}

function ServiceDoneDetail({
  service,
  result,
  domain,
}: {
  service: ServiceKey;
  result: Record<string, unknown>;
  domain: string;
}) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  if (service === "email") {
    const sendAddress = (result.send_address as string) || `hello@${domain}`;
    const dns = Array.isArray(result.dns_records) ? (result.dns_records as Array<Record<string, string>>) : [];
    const sandbox = result.sandbox === true;
    return (
      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
        {sandbox && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-center gap-2">
            <AlertTriangle size={11} /> Sandbox — DNS not written to GoDaddy OTE. Works on production.
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-gold">{sendAddress}</span>
          <button
            onClick={() => copyToClipboard(sendAddress, "Address")}
            className="text-[10px] p-1.5 rounded border border-border hover:bg-white/5"
          >
            <Copy size={10} />
          </button>
        </div>
        {dns.length > 0 && (
          <details className="text-[10px] text-muted">
            <summary className="cursor-pointer hover:text-foreground">
              DNS records still propagating ({dns.length}) — tap to expand
            </summary>
            <div className="mt-2 space-y-1">
              {dns.map((r, i) => (
                <div key={i} className="font-mono break-all bg-background/40 rounded p-2">
                  <span className="text-gold">{r.type}</span> {r.name || "@"} → {r.value || r.data}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  }

  if (service === "phone") {
    const phone = result.phone_number as string;
    return (
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
        <div>
          <p className="text-sm font-mono font-semibold">{phone}</p>
          <p className="text-[10px] text-muted">
            {(result.locality as string) || ""} {(result.region as string) || ""} · ${(result.monthly_cost_usd as number)?.toFixed(2) ?? "1.15"}/mo
          </p>
        </div>
        <button
          onClick={() => copyToClipboard(phone, "Number")}
          className="text-[10px] p-1.5 rounded border border-border hover:bg-white/5"
        >
          <Copy size={10} />
        </button>
      </div>
    );
  }

  if (service === "website") {
    const editorUrl = result.editor_url as string;
    const publicUrl = result.public_url as string;
    return (
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-muted min-w-0">
          <p>Template: {String(result.template || "coming-soon")}</p>
          <p className="font-mono text-foreground truncate">{publicUrl}</p>
        </div>
        <a
          href={editorUrl}
          className="text-[10px] px-2.5 py-1 rounded-lg border border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1"
        >
          Open builder <ExternalLink size={10} />
        </a>
      </div>
    );
  }

  if (service === "portal") {
    const subdomain = result.subdomain as string;
    const manual = result.manual_dns_required === true;
    const cnameTarget = result.cname_target as string;
    return (
      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-gold">https://{subdomain}</span>
          <button
            onClick={() => copyToClipboard(`https://${subdomain}`, "Portal URL")}
            className="text-[10px] p-1.5 rounded border border-border hover:bg-white/5"
          >
            <Copy size={10} />
          </button>
        </div>
        {manual && (
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300">
            <ShieldCheck size={11} className="inline mr-1" />
            Manual DNS still required — add CNAME <code className="font-mono">portal → {cnameTarget}</code> to the zone.
          </div>
        )}
      </div>
    );
  }

  if (service === "chat") {
    const embed = result.embed_script as string;
    return (
      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
        <p className="text-[10px] text-muted">Paste this into the &lt;head&gt; of the client&apos;s site:</p>
        <pre className="text-[10px] bg-background/40 rounded p-2 overflow-x-auto font-mono border border-border/50">
          {embed}
        </pre>
        <button
          onClick={() => copyToClipboard(embed, "Embed script")}
          className="text-[10px] px-2.5 py-1 rounded-lg border border-border hover:bg-white/5 flex items-center gap-1"
        >
          <Copy size={10} /> Copy embed
        </button>
      </div>
    );
  }

  return null;
}
