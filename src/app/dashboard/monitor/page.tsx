"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SystemHealthEntry } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import { formatRelativeTime } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Wifi, Shield } from "lucide-react";
import toast from "react-hot-toast";

const INTEGRATIONS = [
  "GoHighLevel", "PandaDoc", "Google Drive", "Google Places", "Canva",
  "Slack", "Telegram", "TikTok", "Meta/Facebook", "Instagram",
  "LinkedIn", "YouTube", "Google Ads", "TikTok Ads", "Meta Ads",
  "Retell AI", "GoDaddy", "Stripe", "Supabase", "OpenAI",
];

export default function MonitorPage() {
  const [health, setHealth] = useState<SystemHealthEntry[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchHealth(); }, []);

  async function fetchHealth() {
    try {
      setLoading(true);
      const { data } = await supabase.from("system_health").select("*").order("integration_name");
      setHealth(data || []);
    } catch (err) {
      console.error("[Monitor] fetchHealth error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function runHealthCheck() {
    toast.loading("Running health check...");
    try {
      const res = await fetch("/api/cron/health-check", {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
      });
      toast.dismiss();
      if (res.ok) {
        toast.success("Health check complete");
        fetchHealth();
      } else {
        toast.error("Health check failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Failed to run health check");
    }
  }

  const healthy = health.filter((h) => h.status === "healthy").length;
  const degraded = health.filter((h) => h.status === "degraded").length;
  const down = health.filter((h) => h.status === "down").length;
  const unknown = health.filter((h) => h.status === "unknown").length;
  const notChecked = Math.max(0, INTEGRATIONS.length - health.length);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle size={16} className="text-success" />;
      case "degraded": return <AlertTriangle size={16} className="text-warning" />;
      case "down": return <XCircle size={16} className="text-danger" />;
      default: return <Wifi size={16} className="text-muted" />;
    }
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Shield size={18} className="text-gold" /> System Monitor
          </h1>
          <p className="text-muted text-xs mt-0.5">Integration health & uptime</p>
        </div>
        <button onClick={runHealthCheck} className="btn-secondary flex items-center gap-2 text-xs">
          <RefreshCw size={14} /> Run Check
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Healthy" value={healthy} icon={<CheckCircle size={14} />} changeType="positive" />
        <StatCard label="Degraded" value={degraded} icon={<AlertTriangle size={14} />} changeType={degraded > 0 ? "negative" : "neutral"} />
        <StatCard label="Down" value={down} icon={<XCircle size={14} />} changeType={down > 0 ? "negative" : "positive"} />
        <StatCard label="Not Checked" value={unknown + notChecked} icon={<Wifi size={14} />} />
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {INTEGRATIONS.map((name) => {
          const entry = health.find((h) => h.integration_name === name);
          const status = entry?.status || "unknown";

          return (
            <div key={name} className={`card-hover flex items-center gap-2.5 p-3.5 ${
              status === "down" ? "border-danger/20" : status === "degraded" ? "border-warning/20" : ""
            }`}>
              {getStatusIcon(status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs">{name}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  {entry?.response_time_ms && (
                    <span className="text-[10px] text-muted font-mono">{entry.response_time_ms}ms</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {entry?.uptime_percentage !== undefined && (
                  <p className={`text-xs font-mono font-medium ${entry.uptime_percentage >= 99 ? "text-success" : entry.uptime_percentage >= 95 ? "text-warning" : "text-danger"}`}>
                    {entry.uptime_percentage}%
                  </p>
                )}
                {entry?.last_check_at && (
                  <p className="text-[9px] text-muted">{formatRelativeTime(entry.last_check_at)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Log — only show actual down services, not auth issues or unconfigured */}
      {(() => {
        const realErrors = health.filter((h) =>
          h.error_message &&
          !h.error_message.includes("Not configured") &&
          h.status === "down"
        );
        const authIssues = health.filter((h) =>
          h.error_message &&
          !h.error_message.includes("Not configured") &&
          h.status === "degraded" &&
          (h.error_message.includes("401") || h.error_message.includes("403") || h.error_message.includes("404"))
        );

        return (
          <>
            {realErrors.length > 0 && (
              <div className="card border-danger/15">
                <h2 className="section-header text-danger flex items-center gap-2">
                  <AlertTriangle size={14} /> Service Outages
                </h2>
                <div className="space-y-2">
                  {realErrors.map((h) => (
                    <div key={h.id} className="bg-danger/5 border border-danger/10 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs">{h.integration_name}</span>
                        <span className="text-[10px] text-muted font-mono">{formatRelativeTime(h.last_check_at)}</span>
                      </div>
                      <p className="text-[10px] text-danger">{h.error_message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {authIssues.length > 0 && (
              <div className="card border-warning/15">
                <h2 className="section-header text-warning flex items-center gap-2">
                  <Shield size={14} /> Credentials Need Refresh
                </h2>
                <p className="text-[10px] text-muted mb-2">These services are online but need updated API keys or tokens</p>
                <div className="space-y-1.5">
                  {authIssues.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                      <span className="text-xs">{h.integration_name}</span>
                      <span className="text-[10px] text-warning font-mono">{h.error_message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
