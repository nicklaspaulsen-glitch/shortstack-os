"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, AlertCircle, X, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";

interface ServiceStatus {
  key: string;
  label: string;
  status: "operational" | "degraded" | "down" | "unknown";
  message?: string;
  last_check?: string;
}

interface HealthResponse {
  overall: "operational" | "degraded" | "down";
  count: number;
  services: ServiceStatus[];
  checked_at: string;
}

export default function DowntimeBanner() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/dashboard/service-health");
      if (res.ok) setHealth(await res.json());
    } catch {
      // silent
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // Load dismissed list
    try {
      const stored = localStorage.getItem("ss-dismissed-alerts");
      if (stored) setDismissed(JSON.parse(stored));
    } catch {}

    fetchHealth();
    // Re-check every 2 minutes
    const interval = setInterval(fetchHealth, 120_000);
    return () => clearInterval(interval);
  }, []);

  function dismiss(key: string) {
    const next = [...dismissed, key];
    setDismissed(next);
    try { localStorage.setItem("ss-dismissed-alerts", JSON.stringify(next)); } catch {}
  }

  if (!health || health.overall === "operational") return null;

  const activeServices = health.services.filter(s => !dismissed.includes(s.key));
  if (activeServices.length === 0) return null;

  const isDown = health.overall === "down";
  const primaryService = activeServices[0];
  const count = activeServices.length;

  return (
    <div className={`fade-in rounded-xl border overflow-hidden ${
      isDown
        ? "bg-red-500/[0.06] border-red-500/30"
        : "bg-amber-500/[0.06] border-amber-500/30"
    }`}>
      <div className="flex items-center gap-3 p-3">
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg ${
          isDown ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
        }`}>
          {isDown ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
          <span className={`absolute inset-0 rounded-lg animate-ping ${
            isDown ? "bg-red-500/30" : "bg-amber-500/30"
          } opacity-30`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-xs font-semibold ${isDown ? "text-red-400" : "text-amber-400"}`}>
              {isDown
                ? count === 1 ? "Service outage detected" : `${count} services down`
                : count === 1 ? "Performance issue detected" : `${count} services degraded`}
            </p>
            {count > 1 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[9px] text-muted hover:text-foreground flex items-center gap-0.5"
              >
                {expanded ? "Hide" : "Show all"}
                {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted truncate">
            <span className="font-medium text-foreground">{primaryService.label}</span>
            {primaryService.message ? ` — ${primaryService.message}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={fetchHealth}
            disabled={checking}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            title="Re-check"
          >
            <RefreshCw size={12} className={checking ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => dismiss(primaryService.key)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-white/5 transition-colors"
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {expanded && count > 1 && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {activeServices.slice(1).map(service => (
            <div key={service.key} className="flex items-center gap-3 px-3 py-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                service.status === "down" ? "bg-red-400" : "bg-amber-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground">{service.label}</p>
                {service.message && (
                  <p className="text-[9px] text-muted truncate">{service.message}</p>
                )}
              </div>
              <span className="text-[9px] text-muted whitespace-nowrap">
                {service.last_check ? new Date(service.last_check).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
              <button
                onClick={() => dismiss(service.key)}
                className="p-1 rounded text-muted hover:text-foreground opacity-60 hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Operational badge — small indicator that shows when all services are up */
export function ServiceHealthPill() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    const load = () => fetch("/api/dashboard/service-health").then(r => r.ok ? r.json() : null).then(setHealth).catch(() => {});
    load();
    const i = setInterval(load, 180_000);
    return () => clearInterval(i);
  }, []);

  if (!health) return null;
  const isOk = health.overall === "operational";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-medium ${
      isOk ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
           : health.overall === "down" ? "bg-red-500/10 text-red-400 border border-red-500/20"
           : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isOk ? "bg-emerald-400 animate-pulse" : health.overall === "down" ? "bg-red-400 animate-pulse" : "bg-amber-400"}`} />
      {isOk ? "All systems operational" : health.overall === "down" ? "Outage" : "Degraded"}
    </div>
  );
}
