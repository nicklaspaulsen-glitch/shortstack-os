"use client";

import React, { useEffect, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useDesignStore, makeEmptyDoc } from "@/lib/design/store";
import type { DesignRow } from "@/lib/design/types";
import PageHero from "@/components/ui/page-hero";
import TopBar from "@/components/design-studio/TopBar";
import LeftRail from "@/components/design-studio/LeftRail";
import Canvas from "@/components/design-studio/Canvas";
import RightInspector from "@/components/design-studio/RightInspector";
import { PenTool, Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { SIZE_PRESETS } from "@/lib/design/types";
import { PrismPanel } from "@/components/prism";

export default function DesignStudioPage() {
  const searchParams = useSearchParams();
  const designId = searchParams?.get("id") ?? null;

  const loadDesign = useDesignStore((s) => s.loadDesign);
  const design = useDesignStore((s) => s.design);
  const setIsSaving = useDesignStore((s) => s.setIsSaving);
  const markSaved = useDesignStore((s) => s.markSaved);
  const getDoc = useDesignStore((s) => s.getDoc);
  const isDirty = useDesignStore((s) => s.isDirty);

  const [loading, setLoading] = React.useState(false);
  const [showPicker, setShowPicker] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  // Load existing design from URL param
  useEffect(() => {
    if (!designId) return;
    setLoading(true);
    fetch(`/api/design-studio/designs/${designId}`)
      .then((r) => r.json())
      .then(({ data }: { data: DesignRow }) => {
        if (data) loadDesign(data);
      })
      .catch(() => toast.error("Could not load design"))
      .finally(() => setLoading(false));
  }, [designId, loadDesign]);

  // Auto-save on dirty every 30s
  useEffect(() => {
    if (!design || !isDirty) return;
    const timer = setTimeout(() => {
      void handleSave();
    }, 30_000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, design]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key === "z") {
        e.preventDefault();
        useDesignStore.getState().undo();
      } else if (isCtrl && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        useDesignStore.getState().redo();
      } else if (isCtrl && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = useCallback(async () => {
    if (!design) return;
    const doc = getDoc();
    if (!doc) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/design-studio/designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, title: design.title }),
      });
      if (!res.ok) throw new Error("Save failed");
      markSaved();
    } catch {
      toast.error("Save failed — try again");
    } finally {
      setIsSaving(false);
    }
  }, [design, getDoc, setIsSaving, markSaved]);

  async function createNewDesign(preset: typeof SIZE_PRESETS[0]) {
    setCreating(true);
    try {
      const res = await fetch("/api/design-studio/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: preset.label,
          width: preset.width,
          height: preset.height,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const { data } = (await res.json()) as { data: { id: string } };
      window.location.href = `/dashboard/design-studio?id=${data.id}`;
    } catch {
      toast.error("Could not create design");
    } finally {
      setCreating(false);
    }
  }

  // No design loaded — show picker
  if (!designId && !design) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a14]">
        <PageHero
          title="Design Studio"
          subtitle="Create on-brand visuals with AI — text, shapes, images, templates."
          icon={<PenTool size={24} />}
          gradient="purple"
        />
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">New Design</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SIZE_PRESETS.map((preset, i) => (
                <motion.button
                  key={`${preset.width}x${preset.height}-${preset.label}`}
                  onClick={() => createNewDesign(preset)}
                  disabled={creating}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="rounded-xl overflow-hidden flex flex-col items-center gap-2 pt-0 px-4 pb-4 hover:border-[#FF2D2D]/40 transition-colors group"
                  style={{ background: "rgba(255,255,255,0.035)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div style={{ height: 3, background: "linear-gradient(90deg, #FF2D2D, #8b5cf6, #ec4899, #f97316, #FF2D2D)", width: "calc(100% + 32px)", marginLeft: -16, marginRight: -16, marginBottom: 8, flexShrink: 0 }} />
                  <div
                    className="border border-white/20 bg-white/5 rounded group-hover:border-[#FF2D2D]/50 transition-colors"
                    style={{
                      width: 48,
                      height: Math.round(48 * (preset.height / preset.width)),
                    }}
                  />
                  <div className="text-center">
                    <p className="text-xs font-medium text-gray-300 group-hover:text-white">
                      {preset.label}
                    </p>
                    <p className="text-[10px] text-gray-600">
                      {preset.width}×{preset.height}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="mt-10">
              <h2 className="text-lg font-semibold text-white mb-4">Recent Designs</h2>
              <RecentDesigns />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a14]">
        <Loader2 size={32} className="animate-spin text-[#FF2D2D]" />
      </div>
    );
  }

  // Editor mode
  return (
    <div className="h-screen flex flex-col bg-[#0a0a14] overflow-hidden">
      <TopBar onSave={handleSave} />
      <div className="flex flex-1 overflow-hidden">
        <LeftRail />
        <Canvas />
        <RightInspector />
      </div>
    </div>
  );
}

// ── Recent designs list ───────────────────────────────────────────────────────

function RecentDesigns() {
  const [designs, setDesigns] = React.useState<DesignRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    fetch("/api/design-studio/designs?limit=12")
      .then((r) => r.json())
      .then(({ data }: { data: DesignRow[] }) => setDesigns(data ?? []))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (designs.length === 0) {
    return <p className="text-sm text-gray-600">No designs yet. Create one above.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {designs.map((d, i) => (
        <motion.a
          key={d.id}
          href={`/dashboard/design-studio?id=${d.id}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          whileHover={{ y: -4, scale: 1.01 }}
          className="rounded-xl overflow-hidden hover:border-[#FF2D2D]/30 transition-colors group"
          style={{ background: "rgba(255,255,255,0.035)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div style={{ height: 3, background: "linear-gradient(90deg, #FF2D2D, #8b5cf6, #ec4899, #f97316, #FF2D2D)" }} />
          <div className="relative aspect-video bg-[#1a1a2e] flex items-center justify-center">
            {d.thumbnail_url ? (
              <Image
                src={d.thumbnail_url}
                alt={d.title}
                fill
                unoptimized
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover"
              />
            ) : (
              <PenTool size={20} className="text-gray-600" />
            )}
          </div>
          <div className="p-2">
            <p className="text-xs font-medium text-gray-300 group-hover:text-white truncate">
              {d.title}
            </p>
            <p className="text-[10px] text-gray-600">
              {d.width}×{d.height}
            </p>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
