"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import {
  GitBranch, ChevronRight, ChevronLeft, Sparkles, Users, Video,
  ShoppingCart, TrendingUp, Zap, Check, Plus, ArrowRight,
} from "lucide-react";

interface StepTemplate {
  title: string;
  step_type: string;
}

interface FunnelTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  steps: StepTemplate[];
}

const TEMPLATES: FunnelTemplate[] = [
  {
    id: "lead-gen",
    name: "Lead Gen",
    description: "Capture email leads with a compelling opt-in and thank-you page.",
    icon: <Users size={20} />,
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    steps: [
      { title: "Opt-In Page", step_type: "opt-in" },
      { title: "Thank You", step_type: "thank-you" },
    ],
  },
  {
    id: "webinar",
    name: "Webinar",
    description: "Register leads, send to webinar, and follow up with replay offer.",
    icon: <Video size={20} />,
    color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    steps: [
      { title: "Registration Page", step_type: "opt-in" },
      { title: "Webinar Room", step_type: "vsl" },
      { title: "Replay Offer", step_type: "upsell" },
      { title: "Thank You", step_type: "thank-you" },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Build hype with a VSL, collect orders, and upsell.",
    icon: <Zap size={20} />,
    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    steps: [
      { title: "Sales Video", step_type: "vsl" },
      { title: "Order Page", step_type: "checkout" },
      { title: "Upsell Offer", step_type: "upsell" },
      { title: "Downsell Offer", step_type: "downsell" },
      { title: "Thank You", step_type: "thank-you" },
    ],
  },
  {
    id: "tripwire",
    name: "Tripwire",
    description: "Low-ticket front-end offer that qualifies buyers for a higher-ticket upsell.",
    icon: <ShoppingCart size={20} />,
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    steps: [
      { title: "Opt-In Page", step_type: "opt-in" },
      { title: "Tripwire Offer ($7–$27)", step_type: "checkout" },
      { title: "Core Offer Upsell", step_type: "upsell" },
      { title: "Thank You", step_type: "thank-you" },
    ],
  },
  {
    id: "high-ticket",
    name: "High-Ticket",
    description: "Application funnel to pre-qualify before booking a strategy call.",
    icon: <TrendingUp size={20} />,
    color: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    steps: [
      { title: "Application Page", step_type: "opt-in" },
      { title: "Video Sales Letter", step_type: "vsl" },
      { title: "Strategy Call Booking", step_type: "webinar" },
      { title: "Thank You", step_type: "thank-you" },
    ],
  },
];

const STEP_TYPE_COLORS: Record<string, string> = {
  "opt-in": "bg-blue-500/15 text-blue-400 border-blue-500/20",
  "thank-you": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  vsl: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  checkout: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  upsell: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  downsell: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  webinar: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
};

const STEP_TYPE_LABELS: Record<string, string> = {
  "opt-in": "Opt-In",
  "thank-you": "Thank You",
  vsl: "VSL",
  checkout: "Checkout",
  upsell: "Upsell",
  downsell: "Downsell",
  webinar: "Webinar",
};

export default function NewFunnelPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<FunnelTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { toast.error("Enter a funnel name"); return; }
    setCreating(true);
    try {
      // Create funnel
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description, status: "draft" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      const funnelId = json.funnel.id;

      // Create template steps
      if (selectedTemplate) {
        for (let i = 0; i < selectedTemplate.steps.length; i++) {
          const s = selectedTemplate.steps[i];
          await fetch(`/api/funnels/${funnelId}/steps`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: s.title, step_type: s.step_type, sort_order: i }),
          });
        }
      }

      toast.success("Funnel created!");
      router.push(`/dashboard/funnels/${funnelId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <PageHero
        title="New Funnel"
        subtitle="Pick a template to get started in seconds, or build from scratch."
        icon={<GitBranch size={22} />}
        gradient="purple"
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: "Name & Template" },
          { n: 2, label: "Review & Create" },
        ].map((s, idx) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${step === s.n ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : step > s.n ? "text-emerald-400" : "text-zinc-600"}`}>
              {step > s.n ? <Check size={14} /> : <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-xs">{s.n}</span>}
              {s.label}
            </div>
            {idx < 1 && <ChevronRight size={14} className="text-zinc-700" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          {/* Name */}
          <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">Funnel Details</h2>
            <div>
              <label className="block text-xs text-zinc-400 font-medium mb-1.5">Funnel Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Lead Gen — Free Audit"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800/60 border border-white/8 text-white text-sm placeholder-zinc-600 outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 font-medium mb-1.5">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description of the funnel goal"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800/60 border border-white/8 text-white text-sm placeholder-zinc-600 outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          {/* Templates */}
          <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-purple-400" />
              <h2 className="text-white font-semibold text-base">Choose a Template</h2>
              <span className="text-zinc-500 text-xs ml-1">(optional)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Blank option */}
              <button
                onClick={() => setSelectedTemplate(null)}
                className={`text-left p-4 rounded-lg border transition-all ${!selectedTemplate ? "border-purple-500/50 bg-purple-500/10" : "border-white/8 hover:border-white/15 bg-white/3"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-zinc-700/50 border border-white/10 flex items-center justify-center">
                    <Plus size={15} className="text-zinc-400" />
                  </div>
                  <span className="text-white text-sm font-semibold">Blank</span>
                </div>
                <p className="text-zinc-500 text-xs">Start with an empty canvas.</p>
              </button>

              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedTemplate(tpl)}
                  className={`text-left p-4 rounded-lg border transition-all ${selectedTemplate?.id === tpl.id ? "border-purple-500/50 bg-purple-500/10" : "border-white/8 hover:border-white/15 bg-white/3"}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-md border flex items-center justify-center ${tpl.color}`}>
                      {tpl.icon}
                    </div>
                    <span className="text-white text-sm font-semibold">{tpl.name}</span>
                  </div>
                  <p className="text-zinc-500 text-xs">{tpl.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tpl.steps.map((s) => (
                      <span key={s.title} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STEP_TYPE_COLORS[s.step_type] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"}`}>
                        {STEP_TYPE_LABELS[s.step_type] ?? s.step_type}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                if (!name.trim()) { toast.error("Enter a funnel name"); return; }
                setStep(2);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-colors"
            >
              Review Steps
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold text-base">Funnel Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-zinc-500 text-xs">Name</span>
                <p className="text-white font-medium mt-0.5">{name}</p>
              </div>
              {description && (
                <div>
                  <span className="text-zinc-500 text-xs">Description</span>
                  <p className="text-white font-medium mt-0.5">{description}</p>
                </div>
              )}
              <div>
                <span className="text-zinc-500 text-xs">Template</span>
                <p className="text-white font-medium mt-0.5">{selectedTemplate?.name ?? "Blank"}</p>
              </div>
            </div>
          </div>

          {selectedTemplate && (
            <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-5 space-y-3">
              <h2 className="text-white font-semibold text-base">Steps Preview</h2>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {selectedTemplate.steps.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-2 shrink-0">
                    <div className="bg-zinc-800/80 border border-white/8 rounded-lg px-4 py-3 min-w-[120px]">
                      <div className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                        Step {idx + 1}
                      </div>
                      <div className="text-white text-sm font-medium mb-1.5">{s.title}</div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STEP_TYPE_COLORS[s.step_type] ?? "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"}`}>
                        {STEP_TYPE_LABELS[s.step_type] ?? s.step_type}
                      </span>
                    </div>
                    {idx < selectedTemplate.steps.length - 1 && (
                      <ArrowRight size={16} className="text-zinc-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
            >
              <ChevronLeft size={15} />
              Back
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
            >
              {creating ? "Creating…" : "Create Funnel"}
              <GitBranch size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
