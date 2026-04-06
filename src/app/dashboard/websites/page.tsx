"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Globe, Sparkles, Loader, ExternalLink, Copy, Eye,
  Code, Send, DollarSign, Zap
} from "lucide-react";
import toast from "react-hot-toast";

const STYLES = [
  { id: "modern-dark", name: "Modern Dark", desc: "Dark bg, clean typography, gold accents" },
  { id: "clean-white", name: "Clean White", desc: "Light, minimal, professional" },
  { id: "bold-gradient", name: "Bold Gradient", desc: "Gradient backgrounds, bold fonts" },
  { id: "corporate", name: "Corporate", desc: "Traditional, trust-focused, blue tones" },
];

const SECTIONS = ["Hero", "Services", "About", "Testimonials", "Pricing", "Contact", "FAQ", "Gallery", "Team", "Blog"];

export default function WebsitesPage() {
  useAuth();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [deployUrl, setDeployUrl] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState<"build" | "preview" | "deploy">("build");
  const supabase = createClient();

  const [config, setConfig] = useState({
    business_name: "",
    industry: "",
    style: "modern-dark",
    description: "",
    color_scheme: "dark with gold accents (#C9A84C)",
    sections: ["Hero", "Services", "About", "Testimonials", "Contact"],
  });

  useState(() => {
    supabase.from("clients").select("id, business_name, industry").eq("is_active", true).then(({ data }) => {
      setClients(data || []);
    });
  });

  function selectClient(id: string) {
    setSelectedClient(id);
    const client = clients.find(c => c.id === id);
    if (client) {
      setConfig(prev => ({ ...prev, business_name: client.business_name, industry: client.industry || "" }));
    }
  }

  async function generateWebsite() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setGenerating(true);
    toast.loading("AI is building the website...");

    try {
      const res = await fetch("/api/websites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: selectedClient || null,
          business_name: config.business_name,
          industry: config.industry,
          description: config.description,
          services: config.sections,
        }),
      });
      toast.dismiss();
      const data = await res.json();

      if (data.success && data.pages) {
        // Combine pages into single HTML
        const mainPage = data.pages.find((p: { name: string; html: string }) => p.name === "index" || p.name === "Home") || data.pages[0];
        if (mainPage) {
          setGeneratedHtml(mainPage.html);
          setTab("preview");
          toast.success("Website generated!");
        }
      } else if (data.html) {
        setGeneratedHtml(data.html);
        setTab("preview");
        toast.success("Website generated!");
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating website");
    }
    setGenerating(false);
  }

  async function deployWebsite() {
    if (!generatedHtml) { toast.error("Generate a website first"); return; }
    setDeploying(true);
    toast.loading("Deploying to Vercel...");

    try {
      const safeName = config.business_name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const res = await fetch("/api/websites/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: generatedHtml,
          project_name: safeName,
          client_id: selectedClient || null,
        }),
      });
      toast.dismiss();
      const data = await res.json();

      if (data.success && data.url) {
        setDeployUrl(data.url);
        setTab("deploy");
        toast.success("Website deployed!");
      } else if (data.preview_only) {
        toast.success("Preview ready! Add VERCEL_TOKEN to deploy live.");
        setTab("preview");
      } else {
        toast.error(data.error || "Deployment failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Deployment error");
    }
    setDeploying(false);
  }

  const toggleSection = (s: string) => {
    setConfig(prev => ({
      ...prev,
      sections: prev.sections.includes(s) ? prev.sections.filter(x => x !== s) : [...prev.sections, s],
    }));
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Globe size={18} className="text-gold" /> Website Builder
          </h1>
          <p className="text-xs text-muted mt-0.5">AI builds a full website, deploy as demo, then go live with custom domain</p>
        </div>
        <select value={selectedClient} onChange={e => selectClient(e.target.value)} className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      <div className="tab-group w-fit">
        {(["build", "preview", "deploy"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "build" ? "Build" : t === "preview" ? "Preview" : "Deploy"}
          </button>
        ))}
      </div>

      {/* Build Tab */}
      {tab === "build" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card space-y-3">
              <h2 className="section-header">Website Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Business Name *</label>
                  <input value={config.business_name} onChange={e => setConfig({ ...config, business_name: e.target.value })}
                    className="input w-full text-xs" placeholder="e.g., Bright Smile Dental" />
                </div>
                <div>
                  <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Industry</label>
                  <input value={config.industry} onChange={e => setConfig({ ...config, industry: e.target.value })}
                    className="input w-full text-xs" placeholder="e.g., Dental, HVAC, Legal" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted uppercase tracking-wider mb-1">Business Description</label>
                <textarea value={config.description} onChange={e => setConfig({ ...config, description: e.target.value })}
                  className="input w-full h-16 text-xs" placeholder="What does this business do? What makes them unique?" />
              </div>
            </div>

            <div className="card">
              <h2 className="section-header">Style</h2>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setConfig({ ...config, style: s.id })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${config.style === s.id ? "border-gold/30 bg-gold/[0.05]" : "border-border/20"}`}>
                    <p className="text-[10px] font-semibold">{s.name}</p>
                    <p className="text-[8px] text-muted">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="section-header">Sections</h2>
              <div className="flex flex-wrap gap-1.5">
                {SECTIONS.map(s => (
                  <button key={s} onClick={() => toggleSection(s)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${config.sections.includes(s) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border/20 text-muted hover:text-white"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generateWebsite} disabled={generating || !config.business_name}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
              {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? "Building website..." : "Generate Website with AI"}
            </button>
          </div>

          <div className="space-y-3">
            <div className="card border-gold/10">
              <h3 className="section-header flex items-center gap-2"><Zap size={12} className="text-gold" /> How it works</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p><span className="text-gold font-medium">1.</span> Configure the website details and style</p>
                <p><span className="text-gold font-medium">2.</span> AI generates a full responsive website</p>
                <p><span className="text-gold font-medium">3.</span> Preview it in the browser</p>
                <p><span className="text-gold font-medium">4.</span> Deploy as a demo link for the client</p>
                <p><span className="text-gold font-medium">5.</span> Client approves → add custom domain + payment</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Tab */}
      {tab === "preview" && (
        <div className="space-y-3">
          {generatedHtml ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Preview of {config.business_name} website</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => { navigator.clipboard.writeText(generatedHtml); toast.success("HTML copied!"); }}
                    className="btn-ghost text-[10px] flex items-center gap-1"><Code size={10} /> Copy HTML</button>
                  <button onClick={() => {
                    const win = window.open("", "_blank");
                    if (win) { win.document.write(generatedHtml); win.document.close(); }
                  }} className="btn-secondary text-[10px] flex items-center gap-1"><ExternalLink size={10} /> Open Full</button>
                  <button onClick={deployWebsite} disabled={deploying}
                    className="btn-primary text-[10px] flex items-center gap-1 disabled:opacity-50">
                    {deploying ? <Loader size={10} className="animate-spin" /> : <Globe size={10} />}
                    {deploying ? "Deploying..." : "Deploy to Vercel"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-border/30 overflow-hidden bg-white" style={{ height: "600px" }}>
                <iframe srcDoc={generatedHtml} className="w-full h-full" title="Website Preview" sandbox="allow-scripts" />
              </div>
            </>
          ) : (
            <div className="card text-center py-12">
              <Globe size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No website generated yet. Go to Build tab first.</p>
            </div>
          )}
        </div>
      )}

      {/* Deploy Tab */}
      {tab === "deploy" && (
        <div className="max-w-lg mx-auto space-y-4">
          {deployUrl ? (
            <div className="card border-success/15 text-center py-8">
              <div className="w-14 h-14 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Globe size={24} className="text-success" />
              </div>
              <h2 className="text-sm font-bold mb-1">Website Deployed!</h2>
              <p className="text-xs text-muted mb-4">Your demo site is live</p>

              <div className="bg-surface-light/50 rounded-xl p-3 mb-4 flex items-center justify-between border border-border/20">
                <a href={deployUrl} target="_blank" rel="noopener" className="text-xs text-gold hover:text-gold-light truncate">{deployUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("URL copied!"); }}>
                  <Copy size={12} className="text-muted hover:text-white" />
                </button>
              </div>

              <div className="space-y-2">
                <button onClick={() => window.open(deployUrl, "_blank")} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <ExternalLink size={12} /> Open Demo Site
                </button>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("Link copied! Send to client."); }}
                  className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                  <Send size={12} /> Copy Link to Send to Client
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-border/20 text-left">
                <h3 className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">Next Steps</h3>
                <div className="space-y-1.5 text-[10px] text-muted">
                  <p>1. Send demo link to client for approval</p>
                  <p>2. Client approves → send payment link via Stripe</p>
                  <p>3. After payment → add custom domain in Vercel</p>
                  <p>4. Point their domain DNS to Vercel</p>
                  <p>5. SSL auto-configured — site is live!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Globe size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No deployment yet. Generate and deploy a website first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
