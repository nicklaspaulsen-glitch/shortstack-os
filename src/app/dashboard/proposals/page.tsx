"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  FileText, Sparkles, Loader, Building, MapPin, Target, DollarSign
} from "lucide-react";
import toast from "react-hot-toast";

const SERVICES = [
  "Short-Form Content", "Long-Form Content", "Paid Ads (Meta/Google/TikTok)",
  "SEO & Content Marketing", "Web Design & Funnels", "AI Receptionist",
  "Automation Workflows", "Branding & Creative", "Social Media Management",
  "Email Marketing", "Cold DM Outreach",
];

export default function ProposalsPage() {
  useAuth();
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    industry: "",
    location: "",
    services: [] as string[],
    pain_points: "",
    budget: "",
  });

  const toggleService = (s: string) => {
    setForm(prev => ({
      ...prev,
      services: prev.services.includes(s) ? prev.services.filter(x => x !== s) : [...prev.services, s],
    }));
  };

  async function generateProposal() {
    if (!form.business_name || !form.industry) {
      toast.error("Fill in business name and industry");
      return;
    }
    setGenerating(true);
    toast.loading("AI is writing your proposal...");

    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.dismiss();

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${form.business_name}_proposal.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Proposal downloaded!");
      } else {
        toast.error("Failed to generate proposal");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating proposal");
    }
    setGenerating(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <FileText size={18} className="text-gold" /> Proposal Generator
        </h1>
        <p className="text-xs text-muted mt-0.5">AI generates a professional PDF proposal tailored to each prospect</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card space-y-3">
            <h2 className="section-header">Prospect Details</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Business Name *</label>
                <div className="relative">
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={form.business_name} onChange={e => setForm({ ...form, business_name: e.target.value })}
                    className="input w-full text-xs pl-9" placeholder="e.g., Bright Smile Dental" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Industry *</label>
                <div className="relative">
                  <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}
                    className="input w-full text-xs pl-9" placeholder="e.g., Dental, HVAC, Legal" required />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Location</label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    className="input w-full text-xs pl-9" placeholder="e.g., Miami, FL" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Budget Range</label>
                <div className="relative">
                  <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })}
                    className="input w-full text-xs pl-9" placeholder="e.g., $1,000 - $2,500/mo" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Pain Points / Challenges</label>
              <textarea value={form.pain_points} onChange={e => setForm({ ...form, pain_points: e.target.value })}
                className="input w-full h-20 text-xs"
                placeholder="e.g., Not getting enough new patients, social media isn't working, competitors are outranking them on Google..." />
            </div>
          </div>

          <div className="card">
            <h2 className="section-header">Recommended Services</h2>
            <p className="text-[10px] text-muted mb-3">Select the services to include in the proposal</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {SERVICES.map(s => (
                <button key={s} onClick={() => toggleService(s)}
                  className={`text-[10px] p-2 rounded-lg border text-left transition-all ${
                    form.services.includes(s)
                      ? "bg-gold/10 border-gold/20 text-gold"
                      : "border-border/30 text-muted hover:border-gold/15 hover:text-white"
                  }`}>
                  {form.services.includes(s) ? "+" : ""} {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview / Generate */}
        <div className="space-y-4">
          <div className="card border-gold/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-30" />
            <div className="relative text-center py-4">
              <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-3 breathe">
                <FileText size={24} className="text-gold" />
              </div>
              <h3 className="text-sm font-semibold mb-1">AI Proposal</h3>
              <p className="text-[10px] text-muted mb-4">
                Claude AI will write a custom proposal with strategy, pricing, and expected results
              </p>
              <button onClick={generateProposal} disabled={generating || !form.business_name}
                className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? "Writing proposal..." : "Generate PDF Proposal"}
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="section-header">What&apos;s Included</h3>
            <div className="space-y-2">
              {[
                "Executive Summary",
                "Situation Analysis",
                "Proposed Strategy (per service)",
                "Expected Results & Timeline",
                "Investment & Pricing",
                "Why ShortStack",
                "Next Steps & CTA",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  <div className="w-4 h-4 bg-gold/10 rounded flex items-center justify-center text-gold text-[8px] font-bold">{i + 1}</div>
                  <span className="text-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
