"use client";

import { useAuth } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import {
  Play, Database, RefreshCw, Copy, Check, Link2,
  ClipboardList, Sparkles, AlertCircle, CheckCircle2
} from "lucide-react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

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
      <MotionPage className="flex items-center justify-center min-h-[60vh]"><motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="glass rounded-xl p-6 text-center"
                >
                  <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="text-xs text-[#6B7280]">Admin access required</p>
                </motion.div></MotionPage>
    );
  }

  return (
    <div className="fade-in space-y-4 p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xs font-bold text-[#111827] flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2563EB]" />
            Demo Management
          </h1>
          <p className="text-[10px] text-[#6B7280] mt-0.5">Seed, reset, and share demo data</p>
        </div>
      </div>

      {/* Demo Client Status */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass rounded-xl p-4"
      >
        <div className="section-header flex items-center gap-2 mb-3">
          <ClipboardList className="w-3.5 h-3.5 text-[#2563EB]" />
          <h2 className="text-xs font-semibold text-[#111827]">Demo Client Status</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 text-[#2563EB] animate-spin" />
          </div>
        ) : demoClient ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Business", value: demoClient.business_name, color: "text-[#111827]" },
                { label: "Industry", value: demoClient.industry, color: "text-[#111827]", capitalize: true },
                { label: "MRR", value: `$${demoClient.mrr.toLocaleString()}`, color: "text-emerald-600" },
                { label: "Health", value: `${demoClient.health_score}/100`, color: "text-[#111827]" },
                { label: "Package", value: demoClient.package_tier, color: "text-[#2563EB]" },
                { label: "Contract", value: demoClient.contract_status, color: "text-[#111827]", capitalize: true },
              ].map((tile, index) => (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.4 }}
                  className="glass-md rounded-xl p-2.5 relative overflow-hidden"
                >
                  <div style={{ height: 3, background: "linear-gradient(90deg, #2563EB, #8b5cf6, #ec4899, #f97316, #2563EB)" }} className="absolute top-0 inset-x-0" />
                  <p className="text-[9px] text-[#6B7280] uppercase tracking-wider">{tile.label}</p>
                  <p className={`text-[10px] ${tile.color} font-medium mt-0.5 ${tile.capitalize ? "capitalize" : ""}`}>{tile.value}</p>
                </motion.div>
              ))}
            </div>
            <div className="glass-md rounded-xl p-2.5">
              <p className="text-[9px] text-[#6B7280] uppercase tracking-wider mb-1">Services</p>
              <div className="flex flex-wrap gap-1">
                {demoClient.services?.map((s) => (
                  <span key={s} className="text-[9px] bg-[rgba(37,99,235,0.08)] text-[#2563EB] px-1.5 py-0.5 rounded-lg">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span className="text-[10px] text-emerald-600">Demo client active</span>
              <span className="text-[9px] text-[#9CA3AF] ml-auto">ID: {demoClient.id.slice(0, 8)}...</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Database className="w-6 h-6 text-[#9CA3AF] mx-auto mb-2" />
            <p className="text-[10px] text-[#6B7280]">No demo client found</p>
            <p className="text-[9px] text-[#9CA3AF] mt-0.5">Click &quot;Seed Demo Data&quot; to create one</p>
          </div>
        )}
      </motion.div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          onClick={seedDemo}
          disabled={seeding}
          whileHover={{ y: -4, scale: 1.01 }}
          className="glass rounded-xl p-4 text-left group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-semibold text-[#111827]">Seed Demo Data</span>
          </div>
          <p className="text-[9px] text-[#6B7280] leading-relaxed">
            Create &quot;Bright Smile Dental&quot; with tasks, invoices, content, and outreach data.
          </p>
          {seeding && (
            <div className="flex items-center gap-1.5 mt-2">
              <RefreshCw className="w-3 h-3 text-[#2563EB] animate-spin" />
              <span className="text-[9px] text-[#2563EB]">Seeding...</span>
            </div>
          )}
        </motion.button>

        <motion.button
          onClick={resetDemo}
          disabled={seeding}
          whileHover={{ y: -4, scale: 1.01 }}
          className="glass rounded-xl p-4 text-left group"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-[#111827]">Reset Demo</span>
          </div>
          <p className="text-[9px] text-[#6B7280] leading-relaxed">
            Clear all existing demo data and re-seed with fresh entries.
          </p>
        </motion.button>
      </div>

      {/* Share Demo Link */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="glass rounded-xl p-4"
      >
        <div className="section-header flex items-center gap-2 mb-3">
          <Link2 className="w-3.5 h-3.5 text-[#2563EB]" />
          <h2 className="text-xs font-semibold text-[#111827]">Share Demo Link</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[rgba(0,0,0,0.04)] rounded-lg px-3 py-2 text-[10px] text-[#374151] font-mono truncate">
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
        <p className="text-[9px] text-[#9CA3AF] mt-2">Share this link with prospects to preview the platform with sample data.</p>
      </motion.div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass rounded-xl p-4"
      >
        <div className="section-header flex items-center gap-2 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
          <h2 className="text-xs font-semibold text-[#111827]">How to Use Demo Mode</h2>
        </div>
        <div className="space-y-2">
          {[
            "Click \"Seed Demo Data\" to create a sample dental client with full data.",
            "Navigate to the Dashboard to see the demo client in your metrics.",
            "Visit Clients, Content, and Outreach pages to explore the seeded data.",
            "Share the demo link with prospects so they can see a live preview.",
            "Use \"Reset Demo\" anytime to start fresh with clean sample data.",
          ].map((instruction, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-start gap-2"
            >
              <span className="text-[9px] text-[#2563EB] font-bold mt-px">{i + 1}.</span>
              <p className="text-[10px] text-[#374151] leading-relaxed">{instruction}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
