"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Play, Database, RefreshCw, Copy, Check, Link2,
  ClipboardList, Sparkles, AlertCircle, CheckCircle2
} from "lucide-react";
import toast from "react-hot-toast";

interface DemoClient {
  id: string;
  business_name: string;
  industry: string;
  mrr: number;
  health_score: number;
  package_tier: string;
  services: string[];
  contract_status: string;
}

export default function DemoManagementPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [demoClient, setDemoClient] = useState<DemoClient | null>(null);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchDemoClient();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDemoClient() {
    setLoading(true);
    try {
      // maybeSingle() instead of single() so a missing demo client doesn't
      // throw and leave the loader spinning forever.
      const { data } = await supabase
        .from("clients")
        .select("id, business_name, industry, mrr, health_score, package_tier, services, contract_status")
        .eq("business_name", "Bright Smile Dental")
        .maybeSingle();
      setDemoClient(data || null);
    } finally {
      setLoading(false);
    }
  }

  async function seedDemo() {
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success("Demo data seeded successfully");
        await fetchDemoClient();
      } else {
        toast.error(json.error || "Failed to seed demo data");
      }
    } catch {
      toast.error("Network error while seeding demo");
    } finally {
      setSeeding(false);
    }
  }

  async function resetDemo() {
    toast.loading("Resetting demo data...", { id: "reset" });
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success("Demo data reset successfully", { id: "reset" });
        await fetchDemoClient();
      } else {
        toast.error(json.error || "Failed to reset demo", { id: "reset" });
      }
    } catch {
      toast.error("Network error while resetting", { id: "reset" });
    } finally {
      setSeeding(false);
    }
  }

  function copyDemoLink() {
    const url = `${window.location.origin}/dashboard?demo=true`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Demo link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  if (profile?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">Admin access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-4 p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xs font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            Demo Management
          </h1>
          <p className="text-[10px] text-zinc-500 mt-0.5">Seed, reset, and share demo data</p>
        </div>
      </div>

      {/* Demo Client Status */}
      <div className="card card-hover rounded-xl p-4">
        <div className="section-header flex items-center gap-2 mb-3">
          <ClipboardList className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-xs font-semibold text-white">Demo Client Status</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
          </div>
        ) : demoClient ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Business</p>
                <p className="text-[10px] text-white font-medium mt-0.5">{demoClient.business_name}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Industry</p>
                <p className="text-[10px] text-white font-medium mt-0.5 capitalize">{demoClient.industry}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">MRR</p>
                <p className="text-[10px] text-emerald-400 font-medium mt-0.5">${demoClient.mrr.toLocaleString()}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Health</p>
                <p className="text-[10px] text-white font-medium mt-0.5">{demoClient.health_score}/100</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Package</p>
                <p className="text-[10px] text-purple-400 font-medium mt-0.5">{demoClient.package_tier}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-2.5">
                <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Contract</p>
                <p className="text-[10px] text-white font-medium mt-0.5 capitalize">{demoClient.contract_status}</p>
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-xl p-2.5">
              <p className="text-[9px] text-zinc-500 uppercase tracking-wider mb-1">Services</p>
              <div className="flex flex-wrap gap-1">
                {demoClient.services?.map((s) => (
                  <span key={s} className="text-[9px] bg-purple-500/10 text-purple-600 px-1.5 py-0.5 rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Demo client active</span>
              <span className="text-[9px] text-zinc-600 ml-auto">ID: {demoClient.id.slice(0, 8)}...</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Database className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
            <p className="text-[10px] text-zinc-500">No demo client found</p>
            <p className="text-[9px] text-zinc-600 mt-0.5">Click &quot;Seed Demo Data&quot; to create one</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={seedDemo}
          disabled={seeding}
          className="card card-hover rounded-xl p-4 text-left group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <span className="text-xs font-semibold text-white">Seed Demo Data</span>
          </div>
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            Create &quot;Bright Smile Dental&quot; with tasks, invoices, content, and outreach data.
          </p>
          {seeding && (
            <div className="flex items-center gap-1.5 mt-2">
              <RefreshCw className="w-3 h-3 text-purple-400 animate-spin" />
              <span className="text-[9px] text-purple-400">Seeding...</span>
            </div>
          )}
        </button>

        <button
          onClick={resetDemo}
          disabled={seeding}
          className="card card-hover rounded-xl p-4 text-left group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-xs font-semibold text-white">Reset Demo</span>
          </div>
          <p className="text-[9px] text-zinc-500 leading-relaxed">
            Clear all existing demo data and re-seed with fresh entries.
          </p>
        </button>
      </div>

      {/* Share Demo Link */}
      <div className="card card-hover rounded-xl p-4">
        <div className="section-header flex items-center gap-2 mb-3">
          <Link2 className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-xs font-semibold text-white">Share Demo Link</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2 text-[10px] text-zinc-400 font-mono truncate">
            {typeof window !== "undefined" ? `${window.location.origin}/dashboard?demo=true` : "/dashboard?demo=true"}
          </div>
          <button
            onClick={copyDemoLink}
            className="btn-primary flex items-center gap-1.5 text-[10px] px-3 py-2 rounded-lg whitespace-nowrap"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-[9px] text-zinc-600 mt-2">Share this link with prospects to preview the platform with sample data.</p>
      </div>

      {/* Instructions */}
      <div className="card rounded-xl p-4">
        <div className="section-header flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <h2 className="text-xs font-semibold text-white">How to Use Demo Mode</h2>
        </div>
        <div className="space-y-2">
          {[
            "Click \"Seed Demo Data\" to create a sample dental client with full data.",
            "Navigate to the Dashboard to see the demo client in your metrics.",
            "Visit Clients, Content, and Outreach pages to explore the seeded data.",
            "Share the demo link with prospects so they can see a live preview.",
            "Use \"Reset Demo\" anytime to start fresh with clean sample data.",
          ].map((instruction, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[9px] text-purple-400 font-bold mt-px">{i + 1}.</span>
              <p className="text-[10px] text-zinc-400 leading-relaxed">{instruction}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
