"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Copy, ExternalLink, Image, Layout, Award, Flag, Monitor,
  Camera, MessageCircle, Play, Briefcase, Music
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

interface GeneratedPrompt {
  id: string;
  section: string;
  prompt: string;
  style: string;
  dimensions: string;
}

interface TemplatePreset {
  label: string;
  icon: React.ReactNode;
  width: number;
  height: number;
  style: string;
}

const SECTIONS = [
  { key: "thumbnails", label: "Thumbnails", icon: <Image size={18} />, description: "YouTube & video thumbnails" },
  { key: "social", label: "Social Posts", icon: <Camera size={18} />, description: "Posts for all platforms" },
  { key: "ads", label: "Ad Creatives", icon: <Flag size={18} />, description: "Facebook, Google & display ads" },
  { key: "logos", label: "Logos", icon: <Award size={18} />, description: "Brand logos & marks" },
  { key: "banners", label: "Banners", icon: <Monitor size={18} />, description: "Website & social banners" },
];

const TEMPLATES: TemplatePreset[] = [
  { label: "Instagram Post", icon: <Camera size={14} />, width: 1080, height: 1080, style: "vibrant, social media aesthetic, clean typography" },
  { label: "Facebook Ad", icon: <MessageCircle size={14} />, width: 1200, height: 628, style: "professional, high-converting ad creative, bold CTA" },
  { label: "YouTube Thumbnail", icon: <Play size={14} />, width: 1280, height: 720, style: "eye-catching, bold text overlay, expressive" },
  { label: "LinkedIn Banner", icon: <Briefcase size={14} />, width: 1584, height: 396, style: "corporate, professional, clean gradient" },
  { label: "TikTok Cover", icon: <Music size={14} />, width: 1080, height: 1920, style: "trendy, Gen-Z aesthetic, bold colors" },
];

export default function DesignStudioPage() {
  useAuth();
  const supabase = createClient();
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedPrompt[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreset | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1080, height: 1080 });
  const [style, setStyle] = useState("");

  // Map section keys to API type values
  const sectionTypeMap: Record<string, string> = {
    thumbnails: "thumbnail",
    social: "social_post",
    ads: "ad",
    logos: "logo",
    banners: "banner",
  };

  // Map dimensions to aspect ratios
  function getAspectRatio(w: number, h: number): string {
    if (w === h) return "1:1";
    if (w / h > 1.7) return "16:9";
    if (h / w > 1.7) return "9:16";
    if (w / h > 1.3) return "3:2";
    return "4:5";
  }

  async function generateDesign(section: string) {
    const prompt = prompts[section];
    if (!prompt?.trim()) {
      toast.error("Please enter a design prompt");
      return;
    }

    setGenerating(section);
    try {
      const w = selectedTemplate?.width || dimensions.width;
      const h = selectedTemplate?.height || dimensions.height;

      const res = await fetch("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: prompt,
          type: sectionTypeMap[section] || section,
          aspect_ratio: getAspectRatio(w, h),
          style: selectedTemplate?.style || style || "professional, modern",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // API returns { prompts: [{ prompt, description }] }
        const mjPrompts = data.prompts || [];
        const mainPrompt = mjPrompts[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;

        const newPrompt: GeneratedPrompt = {
          id: crypto.randomUUID(),
          section,
          prompt: mainPrompt,
          style: selectedTemplate?.style || style || "professional",
          dimensions: `${w}x${h}`,
        };
        setGenerated((prev) => [newPrompt, ...prev]);

        // If multiple prompts returned, add them all
        if (mjPrompts.length > 1) {
          mjPrompts.slice(1).forEach((p: { prompt: string }) => {
            setGenerated((prev) => [{
              id: crypto.randomUUID(),
              section,
              prompt: p.prompt,
              style: selectedTemplate?.style || style || "professional",
              dimensions: `${w}x${h}`,
            }, ...prev]);
          });
        }

        await supabase.from("trinity_log").insert({
          agent: "design_studio",
          action: "generate_image_prompt",
          details: { section, prompt: mainPrompt, dimensions: `${w}x${h}` },
          status: "success",
        });

        toast.success(`${mjPrompts.length || 1} Midjourney prompt${mjPrompts.length > 1 ? "s" : ""} generated!`);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to generate design prompt");
      }
    } catch {
      toast.error("Error connecting to AI service");
    }
    setGenerating(null);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  }

  function applyTemplate(template: TemplatePreset) {
    setSelectedTemplate(template);
    setDimensions({ width: template.width, height: template.height });
    setStyle(template.style);
    toast.success(`Template applied: ${template.label}`);
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Sparkles size={24} className="text-gold" />
            </div>
            Canva Design Studio
          </h1>
          <p className="text-muted text-sm mt-1">Generate AI-powered designs for thumbnails, social posts, ads & more</p>
        </div>
        <a
          href="https://www.canva.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex items-center gap-2 rounded-lg"
        >
          <ExternalLink size={16} /> Open in Canva
        </a>
      </div>

      {/* Quick Templates */}
      <div className="card rounded-xl">
        <h2 className="section-header flex items-center gap-2 mb-4">
          <Layout size={18} /> Quick Templates
        </h2>
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedTemplate?.label === t.label
                  ? "bg-gold text-black"
                  : "bg-surface-light text-muted hover:text-white hover:bg-surface-light/80"
              }`}
            >
              {t.icon} {t.label}
              <span className="text-[10px] opacity-60">{t.width}x{t.height}</span>
            </button>
          ))}
        </div>
        {selectedTemplate && (
          <div className="mt-3 flex items-center gap-4 text-xs text-muted">
            <span>Dimensions: {selectedTemplate.width}x{selectedTemplate.height}</span>
            <span>Style: {selectedTemplate.style}</span>
            <button
              onClick={() => { setSelectedTemplate(null); setStyle(""); }}
              className="text-gold hover:text-gold/80"
            >
              Clear template
            </button>
          </div>
        )}
      </div>

      {/* Design Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((section) => (
          <div key={section.key} className="card card-hover rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                {section.icon}
              </div>
              <div>
                <h3 className="font-medium text-sm">{section.label}</h3>
                <p className="text-[10px] text-muted">{section.description}</p>
              </div>
            </div>
            <textarea
              className="input w-full h-20 text-xs mb-3"
              placeholder={`Describe your ${section.label.toLowerCase()} design...`}
              value={prompts[section.key] || ""}
              onChange={(e) => setPrompts((prev) => ({ ...prev, [section.key]: e.target.value }))}
            />
            <button
              onClick={() => generateDesign(section.key)}
              disabled={generating === section.key}
              className="btn-primary w-full flex items-center justify-center gap-2 rounded-lg text-xs"
            >
              <Sparkles size={14} />
              {generating === section.key ? "Generating..." : "Generate with AI"}
            </button>
          </div>
        ))}
      </div>

      {/* Generated Prompts */}
      {generated.length > 0 && (
        <div className="card rounded-xl">
          <h2 className="section-header flex items-center gap-2 mb-4">
            <Image size={18} /> Generated Prompts ({generated.length})
          </h2>
          <div className="space-y-3">
            {generated.map((g) => (
              <div key={g.id} className="card-hover rounded-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="badge bg-gold/10 text-gold text-[10px] px-2 py-0.5 rounded capitalize">
                        {g.section}
                      </span>
                      <span className="text-[10px] text-muted">{g.dimensions}</span>
                    </div>
                    <p className="text-xs text-white/90 leading-relaxed">{g.prompt}</p>
                    <p className="text-[10px] text-muted mt-1">Style: {g.style}</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => copyToClipboard(g.prompt)}
                      className="btn-primary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg"
                    >
                      <Copy size={12} /> Copy to Midjourney
                    </button>
                    <a
                      href="https://www.canva.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg text-center justify-center"
                    >
                      <ExternalLink size={12} /> Open in Canva
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <PageAI pageName="Design Studio" context="AI design prompt generator for thumbnails, social posts, ads, logos, and banners. Generates Midjourney prompts." suggestions={["Generate a thumbnail concept for '5 Marketing Tips'", "Create an Instagram post design for a restaurant", "What colors work best for dental practice ads?", "Design a YouTube banner concept"]} />
    </div>
  );
}
