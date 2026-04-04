"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SystemHealthEntry } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import { PageLoading } from "@/components/ui/loading";
import { formatRelativeTime } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Wifi } from "lucide-react";
import toast from "react-hot-toast";

const INTEGRATIONS = [
  "GoHighLevel", "PandaDoc", "Google Drive", "Google Places", "Canva",
  "Slack", "Telegram", "TikTok", "Meta/Facebook", "Instagram",
  "LinkedIn", "YouTube", "Google Ads", "TikTok Ads", "Meta Ads",
  "Retell AI", "GoDaddy", "Stripe", "Supabase", "OpenAI",
];

export default function MonitorPage() {
  const [health, setHealth] = useState<SystemHealthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 3000); return () => clearTimeout(t); }, []);
  const supabase = createClient();

  useEffect(() => { fetchHealth(); }, []);

  async function fetchHealth() {
    setLoading(true);
    const { data } = await supabase.from("system_health").select("*").order("integration_name");
    setHealth(data || []);
    setLoading(false);
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

  if (loading) return <PageLoading />;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy": return <CheckCircle size={18} className="text-success" />;
      case "degraded": return <AlertTriangle size={18} className="text-warning" />;
      case "down": return <XCircle size={18} className="text-danger" />;
      default: return <Wifi size={18} className="text-muted" />;
    }
  };

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">System Monitor</h1>
          <p className="text-muted text-sm">Integration health & uptime tracking</p>
        </div>
        <button onClick={runHealthCheck} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Run Check
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Healthy" value={healthy} icon={<CheckCircle size={18} />} changeType="positive" />
        <StatCard label="Degraded" value={degraded} icon={<AlertTriangle size={18} />} changeType={degraded > 0 ? "negative" : "neutral"} />
        <StatCard label="Down" value={down} icon={<XCircle size={18} />} changeType={down > 0 ? "negative" : "positive"} />
        <StatCard label="Not Checked" value={unknown + Math.max(0, INTEGRATIONS.length - health.length)} icon={<Wifi size={18} />} />
      </div>

      {/* Integration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {INTEGRATIONS.map((name) => {
          const entry = health.find((h) => h.integration_name === name);
          const status = entry?.status || "unknown";

          return (
            <div key={name} className={`card-hover flex items-center gap-3 p-4 ${
              status === "down" ? "border-danger/30" : status === "degraded" ? "border-warning/30" : ""
            }`}>
              {getStatusIcon(status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{name}</p>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  {entry?.response_time_ms && (
                    <span className="text-xs text-muted">{entry.response_time_ms}ms</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {entry?.uptime_percentage !== undefined && (
                  <p className={`text-sm font-medium ${entry.uptime_percentage >= 99 ? "text-success" : entry.uptime_percentage >= 95 ? "text-warning" : "text-danger"}`}>
                    {entry.uptime_percentage}%
                  </p>
                )}
                {entry?.last_check_at && (
                  <p className="text-xs text-muted">{formatRelativeTime(entry.last_check_at)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Log */}
      {health.filter((h) => h.error_message).length > 0 && (
        <div className="card border-danger/20">
          <h2 className="section-header text-danger flex items-center gap-2">
            <AlertTriangle size={18} /> Recent Errors
          </h2>
          <div className="space-y-3">
            {health.filter((h) => h.error_message).map((h) => (
              <div key={h.id} className="bg-danger/5 border border-danger/10 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{h.integration_name}</span>
                  <span className="text-xs text-muted">{formatRelativeTime(h.last_check_at)}</span>
                </div>
                <p className="text-xs text-danger">{h.error_message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
