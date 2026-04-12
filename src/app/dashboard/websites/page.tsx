"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Globe, Sparkles, Loader, ExternalLink, Copy,
  Code, Zap, Heart, Eye, Mail, CheckCircle
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
  const [tab, setTab] = useState<"build" | "preview" | "deploy" | "demos">("build");
  const supabase = createClient();

  const [lovablePrompt, setLovablePrompt] = useState("");
  const [lovableLoading, setLovableLoading] = useState(false);
  const [demos, setDemos] = useState<Array<{ id: string; business_name: string; url: string; status: string; created_at: string; client_id: string | null }>>([]);

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
    fetchDemos();
  });

  async function fetchDemos() {
    const { data } = await supabase
      .from("trinity_log")
      .select("id, description, result, status, created_at, client_id")
      .eq("action_type", "website_deploy")
      .order("created_at", { ascending: false })
      .limit(20);
    setDemos((data || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      business_name: d.description as string,
      url: ((d.result as Record<string, string>)?.url) || "",
      status: d.status as string,
      created_at: d.created_at as string,
      client_id: d.client_id as string | null,
    })));
  }

  async function generateDemoSite() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setGenerating(true);
    toast.loading("Generating demo site...");
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
          demo: true,
        }),
      });
      const genData = await res.json();
      const html = genData.pages?.[0]?.html || genData.html;
      if (!html) { toast.dismiss(); toast.error("Generation failed"); setGenerating(false); return; }

      // Auto-deploy as demo
      const safeName = config.business_name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-demo";
      const deployRes = await fetch("/api/websites/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, project_name: safeName, client_id: selectedClient || null }),
      });
      toast.dismiss();
      const deployData = await deployRes.json();
      if (deployData.url) {
        setDeployUrl(deployData.url);
        setGeneratedHtml(html);
        // Log as demo
        await supabase.from("trinity_log").insert({
          action_type: "website_deploy",
          description: config.business_name,
          client_id: selectedClient || null,
          status: "demo",
          result: { url: deployData.url, style: config.style },
        });
        fetchDemos();
        setTab("deploy");
        toast.success("Demo site live!");
      } else {
        setGeneratedHtml(html);
        setTab("preview");
        toast.success("Website generated! Add VERCEL_TOKEN to auto-deploy.");
      }
    } catch { toast.dismiss(); toast.error("Error"); }
    setGenerating(false);
  }

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

  async function buildWithLovable() {
    if (!config.business_name) { toast.error("Enter a business name"); return; }
    setLovableLoading(true);
    try {
      const res = await fetch("/api/lovable/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: config.business_name,
          industry: config.industry,
          description: config.description,
          style: config.style,
          sections: config.sections,
        }),
      });
      const data = await res.json();
      if (data.lovable_prompt || data.prompt) {
        setLovablePrompt(data.lovable_prompt || data.prompt);
        toast.success("Lovable prompt generated!");
      } else {
        toast.error(data.error || "Failed to generate Lovable prompt");
      }
    } catch {
      toast.error("Error generating Lovable prompt");
    }
    setLovableLoading(false);
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Globe size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Website Builder</h1>
            <p className="text-xs text-muted">AI builds full websites, deploy as demo, go live with custom domain</p>
          </div>
        </div>
        <select value={selectedClient} onChange={e => selectClient(e.target.value)} className="input text-xs py-1.5 min-w-[160px]">
          <option value="">No client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>

      <div className="tab-group w-fit">
        {(["build", "preview", "deploy", "demos"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === "demos") fetchDemos(); }} className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "build" ? "Build" : t === "preview" ? "Preview" : t === "deploy" ? "Deploy" : `Demos (${demos.length})`}
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
                    className={`p-2.5 rounded-xl border text-left transition-all ${config.style === s.id ? "border-gold/30 bg-gold/[0.05]" : "border-border"}`}>
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
                    className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${config.sections.includes(s) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={generateDemoSite} disabled={generating || !config.business_name}
                className="flex-1 text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl border border-success/30 bg-success/[0.08] text-success hover:bg-success/[0.15] transition-all font-semibold">
                {generating ? <Loader size={14} className="animate-spin" /> : <Eye size={14} />}
                {generating ? "Building..." : "One-Click Demo"}
              </button>
              <button onClick={generateWebsite} disabled={generating || !config.business_name}
                className="btn-primary flex-1 text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                {generating ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generating ? "Building..." : "Generate with AI"}
              </button>
            </div>
            <button onClick={buildWithLovable} disabled={lovableLoading || !config.business_name}
              className="w-full text-xs py-2.5 flex items-center justify-center gap-2 disabled:opacity-50 rounded-xl border border-pink-500/30 bg-pink-500/[0.08] text-pink-500 hover:bg-pink-500/[0.15] transition-all font-medium">
              {lovableLoading ? <Loader size={14} className="animate-spin" /> : <Heart size={14} />}
              {lovableLoading ? "Generating..." : "Build with Lovable (Recommended)"}
            </button>

            {lovablePrompt && (
              <div className="card border-pink-500/15 space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] text-pink-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <Heart size={10} /> Lovable Prompt Ready
                  </h3>
                  <button onClick={() => {
                    navigator.clipboard.writeText(lovablePrompt);
                    window.open("https://lovable.dev", "_blank");
                    toast.success("Prompt copied! Paste it in Lovable.");
                  }} className="text-[10px] px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 transition-all flex items-center gap-1">
                    <Copy size={10} /> Copy & Open Lovable
                  </button>
                </div>
                <pre className="text-[9px] text-muted bg-surface-light rounded-lg p-2.5 max-h-32 overflow-y-auto whitespace-pre-wrap">{lovablePrompt}</pre>
                <p className="text-[8px] text-muted/60">Lovable builds full React apps with Supabase — much better than raw HTML. Paste this prompt in Lovable to get a production-ready site.</p>
              </div>
            )}
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

            <div className="card border-pink-500/10">
              <h3 className="section-header flex items-center gap-2"><Heart size={12} className="text-pink-400" /> Lovable (Recommended)</h3>
              <div className="space-y-2 text-[10px] text-muted">
                <p>Lovable builds <span className="text-pink-500 font-medium">full React + Supabase apps</span> — not just raw HTML. The result is a real, production-ready website with:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[9px] pl-1">
                  <li>Responsive design with modern animations</li>
                  <li>Contact forms that actually work</li>
                  <li>SEO optimization built in</li>
                  <li>Hosted on its own URL instantly</li>
                </ul>
                <p className="text-[8px] text-muted/60 pt-1">Use Generate with AI for quick HTML demos, or Build with Lovable for client-ready sites.</p>
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
              <div className="rounded-xl border border-border overflow-hidden bg-white" style={{ height: "600px" }}>
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
                <CheckCircle size={24} className="text-success" />
              </div>
              <h2 className="text-sm font-bold mb-1">Demo Site Live!</h2>
              <p className="text-xs text-muted mb-4">{config.business_name} demo is ready to share</p>

              <div className="bg-surface-light/50 rounded-xl p-3 mb-4 flex items-center justify-between border border-border">
                <a href={deployUrl} target="_blank" rel="noopener" className="text-xs text-gold hover:text-gold-light truncate">{deployUrl}</a>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("URL copied!"); }}>
                  <Copy size={12} className="text-muted hover:text-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                <button onClick={() => window.open(deployUrl, "_blank")} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <ExternalLink size={12} /> Open Demo Site
                </button>
                <button onClick={() => { navigator.clipboard.writeText(`Hey! Here's a preview of your new website: ${deployUrl}\n\nLet me know what you think!`); toast.success("Message copied with link!"); }}
                  className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                  <Mail size={12} /> Copy Message for Client
                </button>
                <button onClick={() => { navigator.clipboard.writeText(deployUrl); toast.success("Link copied!"); }}
                  className="btn-ghost w-full text-xs flex items-center justify-center gap-1.5">
                  <Copy size={12} /> Copy Link Only
                </button>
              </div>

              <div className="mt-6 pt-4 border-t border-border text-left">
                <h3 className="text-[10px] text-muted uppercase tracking-wider font-bold mb-2">Client Likes It? Next Steps</h3>
                <div className="space-y-1.5 text-[10px] text-muted">
                  <p><span className="text-success font-medium">1.</span> Send payment link via Stripe</p>
                  <p><span className="text-success font-medium">2.</span> After payment → add custom domain in Vercel</p>
                  <p><span className="text-success font-medium">3.</span> Client points their DNS to Vercel (76.76.21.21)</p>
                  <p><span className="text-success font-medium">4.</span> SSL auto-configured — site is live!</p>
                  <p><span className="text-success font-medium">5.</span> Or use Lovable for a React app with CMS</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <Globe size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No deployment yet. Use One-Click Demo to auto-generate and deploy.</p>
            </div>
          )}
        </div>
      )}

      {/* Demos Tab */}
      {tab === "demos" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">All demo sites created for prospects and clients</p>
            <button onClick={() => setTab("build")} className="btn-primary text-[10px] flex items-center gap-1">
              <Sparkles size={10} /> New Demo
            </button>
          </div>
          {demos.length === 0 ? (
            <div className="card text-center py-12">
              <Globe size={20} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No demos yet. Create one to show prospects what their website could look like.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {demos.map((d) => (
                <div key={d.id} className="card-hover p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-xs font-semibold">{d.business_name}</h3>
                      <p className="text-[9px] text-muted">{new Date(d.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${d.status === "demo" ? "bg-gold/10 text-gold" : d.status === "live" ? "bg-success/10 text-success" : "bg-surface-light text-muted"}`}>
                      {d.status === "demo" ? "Demo" : d.status === "live" ? "Live" : d.status}
                    </span>
                  </div>
                  {d.url && (
                    <div className="bg-surface-light rounded-lg px-2.5 py-1.5 mb-2.5 flex items-center justify-between border border-border">
                      <a href={d.url} target="_blank" rel="noopener" className="text-[10px] text-gold hover:text-gold-light truncate">{d.url}</a>
                      <button onClick={() => { navigator.clipboard.writeText(d.url); toast.success("Copied!"); }}>
                        <Copy size={10} className="text-muted hover:text-foreground shrink-0 ml-2" />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {d.url && <a href={d.url} target="_blank" rel="noopener" className="btn-secondary text-[9px] py-1 px-2 flex items-center gap-1"><ExternalLink size={9} /> View</a>}
                    <button onClick={() => { navigator.clipboard.writeText(`Hey! Here's a preview of your new website: ${d.url}\n\nLet me know what you think!`); toast.success("Message copied!"); }}
                      className="btn-ghost text-[9px] py-1 px-2 flex items-center gap-1"><Mail size={9} /> Send</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
