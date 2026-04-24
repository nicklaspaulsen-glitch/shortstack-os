"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { Activity, CheckCircle, AlertTriangle, XCircle, Clock, RefreshCw, Wifi } from "lucide-react";

interface ServiceHealth {
  id: string;
  integration_name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  last_check_at: string | null;
  last_healthy_at: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  uptime_percentage: number | null;
}

type ComputedStatus = "healthy" | "degraded" | "down";

function computeFreshness(last_check_at: string | null): ComputedStatus {
  if (!last_check_at) return "down";
  const ageHours = (Date.now() - new Date(last_check_at).getTime()) / 3600000;
  if (ageHours < 2) return "healthy";
  if (ageHours < 24) return "degraded";
  return "down";
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy") return <CheckCircle className="w-5 h-5 text-emerald-400" />;
  if (status === "degraded") return <AlertTriangle className="w-5 h-5 text-amber-400" />;
  if (status === "down") return <XCircle className="w-5 h-5 text-red-400" />;
  return <Clock className="w-5 h-5 text-slate-400" />;
}

function StatusDot({ status }: { status: string }) {
  const cls: Record<string, string> = {
    healthy: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    degraded: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
    down: "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]",
    unknown: "bg-slate-400",
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${cls[status] ?? "bg-slate-400"}`} />;
}

function getCategory(name: string): string {
  const n = name.toLowerCase();
  if (["stripe", "paypal", "invoic"].some(k => n.includes(k))) return "Payments";
  if (["sendgrid", "resend", "smtp", "email"].some(k => n.includes(k))) return "Email";
  if (["twilio", "sms", "whatsapp", "telegram"].some(k => n.includes(k))) return "Messaging";
  if (["meta", "facebook", "instagram", "tiktok", "linkedin"].some(k => n.includes(k))) return "Social";
  if (["google", "places", "maps"].some(k => n.includes(k))) return "Google";
  if (["slack", "notion", "airtable"].some(k => n.includes(k))) return "Productivity";
  if (["openai", "anthropic", " ai", "llm"].some(k => n.includes(k))) return "AI";
  return "Other";
}

export default function MonitorPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("system_health")
      .select("id, integration_name, status, last_check_at, last_healthy_at, error_message, response_time_ms, uptime_percentage")
      .order("integration_name");
    setServices((data as ServiceHealth[]) ?? []);
    setLastRefresh(new Date());
    setCountdown(30);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [lastRefresh]);

  type Annotated = ServiceHealth & { computedStatus: ComputedStatus };
  const annotated: Annotated[] = services.map(s => ({
    ...s,
    computedStatus: (s.status !== "unknown" ? s.status : computeFreshness(s.last_check_at)) as ComputedStatus,
  }));

  const grouped = annotated.reduce<Record<string, Annotated[]>>((acc, s) => {
    const cat = getCategory(s.integration_name);
    (acc[cat] ??= []).push(s);
    return acc;
  }, {});

  const overall: ComputedStatus = annotated.every(s => s.computedStatus === "healthy")
    ? "healthy"
    : annotated.some(s => s.computedStatus === "down")
    ? "down"
    : "degraded";

  const overallLabel = { healthy: "All Systems Operational", degraded: "Partial Outage", down: "Major Outage" }[overall];
  const overallCls = {
    healthy: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
    degraded: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    down: "bg-red-500/15 border-red-500/30 text-red-400",
  }[overall];

  return (
    <div className="space-y-6">
      <PageHero
        title="System Monitor"
        subtitle="Live status board — auto-refreshes every 30 seconds."
        icon={<Activity className="w-6 h-6" />}
        gradient="ocean"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 tabular-nums">Next refresh in {countdown}s</span>
            <button
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors border border-white/15"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh now
            </button>
          </div>
        }
      />

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${overallCls}`}>
        <Wifi className="w-5 h-5" />
        <span className="font-semibold">{overallLabel}</span>
        <span className="ml-auto text-xs opacity-70">Last updated {lastRefresh.toLocaleTimeString()}</span>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Healthy", count: annotated.filter(s => s.computedStatus === "healthy").length, cls: "text-emerald-400" },
          { label: "Degraded", count: annotated.filter(s => s.computedStatus === "degraded").length, cls: "text-amber-400" },
          { label: "Down", count: annotated.filter(s => s.computedStatus === "down").length, cls: "text-red-400" },
        ].map(({ label, count, cls }) => (
          <div key={label} className="card-premium p-4 text-center">
            <div className={`text-2xl font-bold ${cls}`}>{count}</div>
            <div className="text-xs text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Per-category boards */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/4 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-10 bg-white/5 rounded" />)}
              </div>
            </div>
          ))}
        </div>
      ) : annotated.length === 0 ? (
        <div className="card-premium p-10 text-center text-muted">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No services found. Health checks will appear here once running.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, svcs]) => (
            <div key={category} className="card-premium overflow-hidden">
              <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-sm font-semibold text-white">{category}</span>
                <span className="text-xs text-muted">{svcs.length} service{svcs.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y divide-white/5">
                {svcs.map(svc => (
                  <div key={svc.id} className="px-5 py-3.5 flex items-center gap-3 flex-wrap">
                    <StatusDot status={svc.computedStatus} />
                    <StatusIcon status={svc.computedStatus} />
                    <span className="flex-1 text-sm text-white/90">{svc.integration_name}</span>
                    <div className="flex items-center gap-4 text-xs text-muted">
                      {svc.response_time_ms != null && <span>{svc.response_time_ms}ms</span>}
                      {svc.uptime_percentage != null && (
                        <span className="text-white/60">{Number(svc.uptime_percentage).toFixed(1)}% uptime</span>
                      )}
                      <span>Checked {timeAgo(svc.last_check_at)}</span>
                    </div>
                    {svc.error_message && (
                      <span className="text-xs text-red-400/70 max-w-[200px] truncate" title={svc.error_message}>
                        {svc.error_message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
