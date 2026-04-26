"use client";

import React, { useState } from "react";
import { useDesignStore, makeTextLayer, makeImageLayer, makeShapeLayer } from "@/lib/design/store";
import { SIZE_PRESETS } from "@/lib/design/types";
import type { DesignTemplateRow } from "@/lib/design/types";
import {
  LayoutTemplate, Palette, Sparkles, Upload, Shapes,
  Type, ImageIcon, Square, Circle, Loader2, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";

type Tab = "templates" | "brand" | "generate" | "elements";

export default function LeftRail() {
  const [activeTab, setActiveTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<DesignTemplateRow[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genWidth, setGenWidth] = useState(1024);
  const [genHeight, setGenHeight] = useState(1024);

  const design = useDesignStore((s) => s.design);
  const addLayer = useDesignStore((s) => s.addLayer);

  async function fetchTemplates() {
    if (templates.length > 0) return;
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/design-studio/templates");
      if (!res.ok) throw new Error("Failed");
      const { data } = (await res.json()) as { data: DesignTemplateRow[] };
      setTemplates(data ?? []);
    } catch {
      toast.error("Could not load templates");
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function cloneTemplate(tplId: string) {
    try {
      const res = await fetch("/api/design-studio/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: tplId }),
      });
      if (!res.ok) throw new Error("Clone failed");
      const { data } = (await res.json()) as { data: { id: string } };
      // Navigate to the new design
      window.location.href = `/dashboard/design-studio?id=${data.id}`;
    } catch {
      toast.error("Failed to create design from template");
    }
  }

  async function handleGenerate() {
    if (!design || !prompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/design-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          design_id: design.id,
          width: genWidth,
          height: genHeight,
        }),
      });
      const json = (await res.json()) as { url?: string; r2_key?: string; placeholder?: boolean };

      if (json.url) {
        const layer = makeImageLayer({
          name: prompt.trim().slice(0, 30),
          src: json.url,
          r2Key: json.r2_key ?? null,
          width: Math.min(genWidth, design.width),
          height: Math.min(genHeight, design.height),
          x: Math.round((design.width - Math.min(genWidth, design.width)) / 2),
          y: Math.round((design.height - Math.min(genHeight, design.height)) / 2),
        });
        addLayer(layer);
        toast.success(json.placeholder ? "Placeholder added (RunPod not configured)" : "Image generated!");
        setPrompt("");
      } else {
        toast.error("Generation failed");
      }
    } catch {
      toast.error("Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "templates", icon: <LayoutTemplate size={16} />, label: "Templates" },
    { id: "brand", icon: <Palette size={16} />, label: "Brand" },
    { id: "generate", icon: <Sparkles size={16} />, label: "AI Generate" },
    { id: "elements", icon: <Shapes size={16} />, label: "Elements" },
  ];

  return (
    <div className="w-60 flex flex-col border-r border-white/10 bg-[#151525] shrink-0">
      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setActiveTab(t.id);
              if (t.id === "templates") fetchTemplates();
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
              activeTab === t.id
                ? "text-white border-b-2 border-[#C9A84C]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.icon}
            <span className="leading-none">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">

        {/* Templates */}
        {activeTab === "templates" && (
          <div>
            {loadingTemplates ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-gray-500" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No templates found</p>
            ) : (
              <div className="space-y-1">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => cloneTemplate(tpl.id)}
                    className="w-full text-left px-2 py-2 rounded hover:bg-white/8 transition-colors group"
                  >
                    <div className="text-xs font-medium text-gray-300 group-hover:text-white truncate">
                      {tpl.name}
                    </div>
                    <div className="text-[10px] text-gray-600 group-hover:text-gray-400">
                      {tpl.category}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Brand kit */}
        {activeTab === "brand" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-400 leading-relaxed">
              Brand colors and fonts are pulled from your White Label settings and applied to new text layers automatically.
            </p>
            <a
              href="/dashboard/white-label"
              target="_blank"
              className="block text-xs text-[#C9A84C] hover:underline"
            >
              Configure White Label →
            </a>
            <div className="border-t border-white/10 pt-3">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Quick apply</p>
              <button
                onClick={() => {
                  const layer = makeTextLayer({
                    name: "Brand Headline",
                    content: "Your Headline",
                    fontFamily: "Inter",
                    fontWeight: "800",
                    color: "#C9A84C",
                    fontSize: 64,
                  });
                  addLayer(layer);
                  toast.success("Brand text layer added");
                }}
                className="w-full text-left px-2 py-2 rounded hover:bg-white/8 text-xs text-gray-300 hover:text-white transition-colors"
              >
                + Add brand headline
              </button>
            </div>
          </div>
        )}

        {/* AI Generate */}
        {activeTab === "generate" && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-gray-400">Generate an image from a text prompt using FLUX AI.</p>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A professional headshot on white background…"
                rows={3}
                className="mt-1 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 placeholder-gray-600 p-2 resize-none focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">Width</label>
                <select
                  value={genWidth}
                  onChange={(e) => setGenWidth(Number(e.target.value))}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 p-1 focus:outline-none"
                >
                  {[512, 768, 1024, 1280].map((v) => (
                    <option key={v} value={v} className="bg-[#1a1a2e]">{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500">Height</label>
                <select
                  value={genHeight}
                  onChange={(e) => setGenHeight(Number(e.target.value))}
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded text-xs text-gray-300 p-1 focus:outline-none"
                >
                  {[512, 768, 1024, 1280].map((v) => (
                    <option key={v} value={v} className="bg-[#1a1a2e]">{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || !design}
              className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#C9A84C] hover:bg-[#d4b35e] text-[#1a1a2e] text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>
        )}

        {/* Elements */}
        {activeTab === "elements" && (
          <div className="space-y-3 pt-1">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Text</p>
              <div className="space-y-1">
                {[
                  { label: "Heading", fontSize: 72, fontWeight: "800" },
                  { label: "Subheading", fontSize: 40, fontWeight: "600" },
                  { label: "Body text", fontSize: 24, fontWeight: "400" },
                  { label: "Caption", fontSize: 16, fontWeight: "400" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      addLayer(makeTextLayer({
                        name: item.label,
                        content: item.label,
                        fontSize: item.fontSize,
                        fontWeight: item.fontWeight,
                      }));
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 text-xs text-gray-300 hover:text-white transition-colors"
                  >
                    <Type size={12} className="shrink-0 text-gray-500" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Shapes</p>
              <div className="grid grid-cols-3 gap-1">
                {(["rectangle", "ellipse", "triangle"] as const).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => {
                      addLayer(makeShapeLayer({
                        name: shape,
                        shapeType: shape,
                        fill: "#8B6FCF",
                        width: 200,
                        height: shape === "ellipse" ? 200 : shape === "triangle" ? 150 : 120,
                      }));
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded hover:bg-white/8 text-gray-400 hover:text-white transition-colors"
                  >
                    {shape === "ellipse" ? (
                      <Circle size={20} />
                    ) : (
                      <Square size={20} />
                    )}
                    <span className="text-[10px] capitalize">{shape}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Image</p>
              <button
                onClick={() => {
                  addLayer(makeImageLayer({ name: "Image", width: 400, height: 300 }));
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/8 text-xs text-gray-300 hover:text-white transition-colors"
              >
                <ImageIcon size={12} className="shrink-0 text-gray-500" />
                Add image placeholder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
