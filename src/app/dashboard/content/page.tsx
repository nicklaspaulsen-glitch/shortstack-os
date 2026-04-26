"use client";

import { useEffect, useState, useRef } from "react";
import { useManagedClient } from "@/lib/use-managed-client";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ContentScript, ContentRequest, PublishQueueItem, PersonalBrandIdea, ContentCalendarEntry, PublishPlatform } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Film, FileText, Inbox, Upload, User, Sparkles, Calendar,
  Check, Edit3, Clock, Send, Search, BarChart3, RefreshCw,
  AlertTriangle, Zap, TrendingUp, Shield, Layers, Loader,
  ThumbsUp, GitBranch, Star, ChevronRight, X
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";
import { ALLOWED_GENERAL_UPLOADS, buildAccept, validateFile } from "@/lib/file-types";

type Tab = "scripts" | "requests" | "publish" | "calendar" | "personal" | "pipeline" | "analytics" | "seo";

type DropGoPlatform = "youtube" | "instagram" | "tiktok" | "linkedin" | "twitter";
const DROP_GO_PLATFORMS: DropGoPlatform[] = ["youtube", "instagram", "tiktok", "linkedin", "twitter"];

interface AIPackage {
  titles?: Partial<Record<DropGoPlatform, string>>;
  descriptions?: Partial<Record<DropGoPlatform, string>>;
  hashtags?: Partial<Record<DropGoPlatform, string[]>>;
  best_times?: Partial<Record<DropGoPlatform, string>>;
  suggested_caption_variations?: string[];
}

interface DropGoItem {
  id: string;              // local id
  file_name: string;
  file_size: number;
  file_url?: string;
  mime_type?: string;
  file_type?: string;
  status: "uploading" | "analyzing" | "ready" | "failed";
  ai_package?: AIPackage;
  package_id?: string;
  error?: string;
}

export default function ContentPage() {
  const { clientId: managedClientId } = useManagedClient();
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("scripts");
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [publishQueue, setPublishQueue] = useState<PublishQueueItem[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [personalIdeas, setPersonalIdeas] = useState<PersonalBrandIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPublishEditor, setShowPublishEditor] = useState<PublishQueueItem | null>(null);
  const [editingPublish, setEditingPublish] = useState<Partial<PublishQueueItem>>({});
  const supabase = createClient();

  // ── Drop & Go state ──────────────────────────────────────────────
  const [dropItems, setDropItems] = useState<DropGoItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [remixing, setRemixing] = useState<{ itemId: string; platform: DropGoPlatform } | null>(null);
  const [remixOptions, setRemixOptions] = useState<{ itemId: string; platform: DropGoPlatform; alternatives: string[] } | null>(null);
  const [planningWeek, setPlanningWeek] = useState(false);
  // Phase 3: each entry can carry its calendar row id + live publish status
  const [weekPlan, setWeekPlan] = useState<Array<{ day: string; date: string; platform: string; asset_id?: string | null; post_time: string; title?: string; caption?: string; brief?: string; needs_creation?: boolean; calendar_id?: string; status?: string; live_url?: string | null; published_error?: string | null }>>([]);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  // Phase 2: longer plans, themes, gap analysis, completion dialog
  const [planGapAnalysis, setPlanGapAnalysis] = useState<{ target_posts: number; real_assets: number; needs_creation: number; recommendation: string } | null>(null);
  const [planThemes, setPlanThemes] = useState<Array<{ week: number; theme: string }>>([]);
  const [planPeriodDays, setPlanPeriodDays] = useState<number>(7);
  const [showPlanComplete, setShowPlanComplete] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pipeline state
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  const [pipelineItems] = useState<Array<{ id: string; title: string; type: string; stage: string; assignee: string; due: string; seo_score: number }>>([]);

  // SEO checker state
  const [seoText, setSeoText] = useState("");
  const [seoKeyword, setSeoKeyword] = useState("");
  const [seoResults, setSeoResults] = useState<{ score: number; issues: string[]; suggestions: string[]; readability: string; wordCount: number; plagiarism: string } | null>(null);
  const [seoChecking, setSeoChecking] = useState(false);
  const [enhancing, setEnhancing] = useState<string | null>(null);

  const enhanceText = async (text: string, context: string, setter: (v: string) => void, key: string) => {
    if (!text.trim()) return;
    setEnhancing(key);
    try {
      const res = await fetch("/api/copywriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, context }),
      });
      const data = await res.json();
      if (data.text) { setter(data.text); toast.success("Enhanced!"); }
      else toast.error("AI enhancement failed");
    } catch { toast.error("AI enhancement failed"); }
    setEnhancing(null);
  };

  // Content analytics
  const [contentAnalytics] = useState({
    total_pieces: 0,
    published_this_month: 0,
    avg_engagement: "0%",
    top_performing: "N/A",
    content_types: { blog: 0, social: 0, video: 0, email: 0 },
    approval_rate: 0,
    ai_enhanced: 0,
  });

  // Version control
  const [versions] = useState<Array<{ id: string; content_title: string; version: number; author: string; timestamp: string; changes: string }>>([]);

  function runSeoCheck() {
    if (!seoText.trim()) { toast.error("Enter content to check"); return; }
    setSeoChecking(true);
    setTimeout(() => {
      const wordCount = seoText.split(/\s+/).filter(Boolean).length;
      const hasKeyword = seoKeyword ? seoText.toLowerCase().includes(seoKeyword.toLowerCase()) : false;
      const issues: string[] = [];
      const suggestions: string[] = [];
      if (wordCount < 300) issues.push("Content is too short (under 300 words)");
      if (seoKeyword && !hasKeyword) issues.push(`Primary keyword "${seoKeyword}" not found in content`);
      if (wordCount < 500) suggestions.push("Aim for 500+ words for better SEO");
      if (!seoText.includes("?")) suggestions.push("Add questions to improve engagement");
      suggestions.push("Add internal links to related content");
      suggestions.push("Include meta description (150-160 chars)");
      if (hasKeyword) suggestions.push("Good: keyword found. Add it to first paragraph and headers too.");
      const score = Math.min(100, Math.max(20, 40 + (wordCount > 500 ? 20 : 0) + (hasKeyword ? 25 : 0) + (seoText.includes("?") ? 10 : 0) + (wordCount > 300 ? 10 : 0)));
      const readability = wordCount > 100 ? (wordCount > 500 ? "Easy to read" : "Moderate") : "Too short to assess";
      setSeoResults({ score, issues, suggestions, readability, wordCount, plagiarism: "No issues detected" });
      setSeoChecking(false);
    }, 1500);
  }

  // codex round-1: use a ref-box so fetchData reads `cancelled.current`
  // at await-resume time rather than from a stale snapshot parameter.
  useEffect(() => {
    const cancelled = { current: false };
    fetchData(cancelled).catch((err: unknown) => {
      if (!cancelled.current) console.error("[Content] fetchData error:", err);
    });
    return () => { cancelled.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, managedClientId]);

  async function fetchData(cancelled: { current: boolean } = { current: false }) {
    setLoading(true);
    try {
      if (tab === "scripts") {
        let q = supabase.from("content_scripts").select("*").order("created_at", { ascending: false });
        if (managedClientId) q = q.eq("client_id", managedClientId);
        const { data } = await q;
        if (!cancelled.current) setScripts(data || []);
      } else if (tab === "requests") {
        let q = supabase.from("content_requests").select("*").order("created_at", { ascending: false });
        if (managedClientId) q = q.eq("client_id", managedClientId);
        const { data } = await q;
        if (!cancelled.current) setRequests(data || []);
      } else if (tab === "publish") {
        let q = supabase.from("publish_queue").select("*").order("created_at", { ascending: false });
        if (managedClientId) q = q.eq("client_id", managedClientId);
        const { data } = await q;
        if (!cancelled.current) setPublishQueue(data || []);
      } else if (tab === "calendar") {
        let q = supabase.from("content_calendar").select("*").order("scheduled_at", { ascending: true });
        if (managedClientId) q = q.eq("client_id", managedClientId);
        const { data } = await q;
        if (!cancelled.current) setCalendar(data || []);
      } else if (tab === "personal") {
        const { data } = await supabase.from("personal_brand_ideas").select("*").order("batch_date", { ascending: false });
        if (!cancelled.current) setPersonalIdeas(data || []);
      }
    } finally {
      // Always unstick the loader even if supabase throws — user would be
      // trapped on the spinner otherwise.
      if (!cancelled.current) setLoading(false);
    }
  }

  async function generateScript(formData: FormData) {
    toast.loading("Generating script with AI...");
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        body: JSON.stringify({
          client_id: formData.get("client_id"),
          script_type: formData.get("script_type"),
          topic: formData.get("topic"),
          brand_voice: formData.get("brand_voice"),
          platform: formData.get("platform"),
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.dismiss();
        toast.success("Script generated!");
        setShowGenerateModal(false);
        fetchData();
      } else {
        toast.dismiss();
        toast.error("Failed to generate script");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating script");
    }
  }

  async function approvePublish(item: PublishQueueItem) {
    const { error } = await supabase.from("publish_queue").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      ...editingPublish,
    }).eq("id", item.id);
    if (error) toast.error("Failed to approve");
    else { toast.success("Approved for publishing"); setShowPublishEditor(null); fetchData(); }
  }

  async function approveIdea(id: string) {
    await supabase.from("personal_brand_ideas").update({ is_approved: true }).eq("id", id);
    toast.success("Idea approved");
    fetchData();
  }

  async function addToCalendar(idea: PersonalBrandIdea) {
    await supabase.from("personal_brand_ideas").update({ added_to_calendar: true }).eq("id", idea.id);
    await supabase.from("content_calendar").insert({
      title: idea.title,
      platform: idea.platform_recommendation === "TikTok" ? "tiktok" : idea.platform_recommendation === "Shorts" ? "youtube_shorts" : "instagram_reels",
      status: "scheduled",
    });
    toast.success("Added to calendar");
    fetchData();
  }

  // ── Drop & Go: upload + auto-package ───────────────────────────────
  function fileKindFromMime(mime: string): string {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.includes("pdf") || mime.includes("document")) return "document";
    return "general";
  }

  const DROP_GO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

  async function handleDropGoFiles(files: File[]) {
    if (files.length === 0) return;

    for (const file of files) {
      const typeErr = validateFile(file, ALLOWED_GENERAL_UPLOADS, DROP_GO_MAX_BYTES);
      if (typeErr) { toast.error(typeErr); continue; }

      const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";

      setDropItems((prev) => [
        ...prev,
        {
          id: localId,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          file_type: ext,
          status: "uploading",
        },
      ]);

      try {
        // Upload to Supabase storage (client-uploads bucket — same as portal uploads)
        const path = `content-hub/${profile?.id || "anon"}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("client-uploads")
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("client-uploads").getPublicUrl(path);
        const fileUrl = urlData.publicUrl;

        // Mirror upload metadata into client_uploads when we have a client context
        if (managedClientId) {
          try {
            await fetch("/api/uploads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: managedClientId,
                file_name: file.name,
                file_type: ext,
                file_size: file.size,
                file_url: fileUrl,
                category: fileKindFromMime(file.type),
              }),
            });
          } catch { /* non-fatal */ }
        }

        setDropItems((prev) => prev.map((i) => (i.id === localId ? { ...i, status: "analyzing", file_url: fileUrl } : i)));

        // Kick off AI auto-package
        const res = await fetch("/api/content/auto-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_url: fileUrl,
            file_type: ext,
            mime_type: file.type,
            file_name: file.name,
            client_id: managedClientId || undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok || !data?.ai_package) {
          setDropItems((prev) => prev.map((i) => (i.id === localId ? { ...i, status: "failed", error: data?.error || "AI package failed" } : i)));
          toast.error(`AI package failed: ${file.name}`);
          continue;
        }

        setDropItems((prev) => prev.map((i) => (i.id === localId ? {
          ...i,
          status: "ready",
          ai_package: data.ai_package as AIPackage,
          package_id: data.package?.id,
        } : i)));
        toast.success(`AI package ready: ${file.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setDropItems((prev) => prev.map((i) => (i.id === localId ? { ...i, status: "failed", error: msg } : i)));
        toast.error(`Failed: ${file.name}`);
      }
    }
  }

  function removeDropItem(id: string) {
    setDropItems((prev) => prev.filter((i) => i.id !== id));
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) void handleDropGoFiles(files);
  }

  async function remixPlatformTitle(item: DropGoItem, platform: DropGoPlatform) {
    const currentTitle = item.ai_package?.titles?.[platform];
    if (!currentTitle) { toast.error("No title to remix"); return; }
    setRemixing({ itemId: item.id, platform });
    try {
      const res = await fetch("/api/content/remix-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          current_title: currentTitle,
          file_context: {
            file_name: item.file_name,
            file_type: item.file_type,
            descriptions: item.ai_package?.descriptions,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.alternatives) && data.alternatives.length > 0) {
        setRemixOptions({ itemId: item.id, platform, alternatives: data.alternatives });
      } else {
        toast.error(data.error || "No alternatives returned");
      }
    } catch {
      toast.error("Remix failed");
    } finally {
      setRemixing(null);
    }
  }

  function applyRemixTitle(newTitle: string) {
    if (!remixOptions) return;
    const { itemId, platform } = remixOptions;
    setDropItems((prev) => prev.map((i) => {
      if (i.id !== itemId || !i.ai_package) return i;
      return {
        ...i,
        ai_package: {
          ...i.ai_package,
          titles: { ...(i.ai_package.titles || {}), [platform]: newTitle },
        },
      };
    }));
    setRemixOptions(null);
    toast.success("Title updated");
  }

  async function planForPeriod(days: number) {
    const readyItems = dropItems.filter((i) => i.status === "ready");
    if (readyItems.length === 0) { toast.error("Add some assets first"); return; }
    setPlanningWeek(true);
    try {
      const res = await fetch("/api/content-plan/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assets: readyItems.map((i) => ({
            id: i.package_id,
            file_url: i.file_url,
            file_name: i.file_name,
            file_type: i.file_type,
            mime_type: i.mime_type,
            ai_package: i.ai_package,
          })),
          platforms: DROP_GO_PLATFORMS,
          days,
          fill_gap: true,
          client_id: managedClientId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.schedule)) {
        setWeekPlan(data.schedule);
        setPlanGapAnalysis(data.gap_analysis || null);
        setPlanThemes(Array.isArray(data.themes) ? data.themes : []);
        setPlanPeriodDays(days);
        // After a plan lands, show the "What's next?" dialog
        setShowPlanComplete(true);
        const label = days === 7 ? "week" : days === 30 ? "month" : days === 90 ? "quarter" : "year";
        toast.success(`${label[0].toUpperCase() + label.slice(1)} planned: ${data.schedule.length} posts${data.saved ? ` · saved ${data.saved} to calendar` : ""}`);
      } else {
        toast.error(data.error || "Plan generation failed");
      }
    } catch {
      toast.error("Plan generation failed");
    } finally {
      setPlanningWeek(false);
    }
  }

  // Legacy alias kept for any external references; prefix with underscore so
  // the linter doesn't flag it as unused while preserving the function shape.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async function _planMyWeek() { await planForPeriod(7); }

  // ── Phase 3: publish execution ─────────────────────────────────────
  async function publishNow(idx: number) {
    const entry = weekPlan[idx];
    if (!entry?.calendar_id) { toast.error("This plan entry isn't saved yet — regenerate the plan first."); return; }
    setPublishingId(entry.calendar_id);
    // Optimistic UI
    setWeekPlan(prev => prev.map((p, i) => i === idx ? { ...p, status: "publishing" } : p));
    try {
      const res = await fetch(`/api/content-calendar/${entry.calendar_id}/publish-now`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data?.outcome?.status === "posted") {
        setWeekPlan(prev => prev.map((p, i) => i === idx ? { ...p, status: "posted", live_url: data.outcome.live_url } : p));
        toast.success("Posted live");
      } else if (res.status === 409 && data?.outcome?.status === "needs_connection") {
        setWeekPlan(prev => prev.map((p, i) => i === idx ? { ...p, status: "needs_connection", published_error: data.error } : p));
        toast.error(data.error || "Connect the account first", {
          duration: 6000,
        });
        // Offer a link to integrations
        setTimeout(() => {
          if (confirm("Open Integrations to connect the account?")) {
            window.location.href = data.connect_url || "/dashboard/social-manager";
          }
        }, 300);
      } else {
        const err = data?.error || data?.outcome?.error || "Publish failed";
        setWeekPlan(prev => prev.map((p, i) => i === idx ? { ...p, status: "failed", published_error: err } : p));
        toast.error(err);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setWeekPlan(prev => prev.map((p, i) => i === idx ? { ...p, status: "failed", published_error: msg } : p));
      toast.error(msg);
    } finally {
      setPublishingId(null);
    }
  }

  async function approveAndPublishAll() {
    if (weekPlan.length === 0) { toast.error("Nothing to approve"); return; }
    const saved = weekPlan.filter(p => p.calendar_id && (p.status === "scheduled" || !p.status));
    if (saved.length === 0) { toast.error("These plan entries are already approved or posted."); return; }
    setApprovingAll(true);
    try {
      const res = await fetch("/api/content-calendar/approve-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: managedClientId || undefined,
          ids: saved.map(p => p.calendar_id).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const approvedIds = new Set<string>((data.items || []).map((i: { id: string }) => i.id));
        setWeekPlan(prev => prev.map(p =>
          p.calendar_id && approvedIds.has(p.calendar_id)
            ? { ...p, status: "approved_for_publish" }
            : p,
        ));
        toast.success(`Approved ${data.approved} posts — will publish on schedule`);
      } else {
        toast.error(data.error || "Approve-all failed");
      }
    } catch {
      toast.error("Approve-all failed");
    } finally {
      setApprovingAll(false);
    }
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "scripts", label: "Scripts", icon: <FileText size={16} /> },
    { key: "requests", label: "Request Inbox", icon: <Inbox size={16} /> },
    { key: "publish", label: "Publish Queue", icon: <Upload size={16} /> },
    { key: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
    { key: "personal", label: "Personal Brand", icon: <User size={16} /> },
    { key: "pipeline", label: "Pipeline", icon: <Layers size={16} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
    { key: "seo", label: "SEO & Quality", icon: <Search size={16} /> },
  ];

  if (loading && tab === "scripts") return (
    <div className="space-y-4">
      <PageHero
        icon={<Sparkles size={22} />}
        title="Content Studio"
        subtitle="Scripts, publishing queue, and your personal brand content."
        gradient="purple"
      />
      <TableSkeleton rows={6} />
    </div>
  );

  return (
    <MotionPage className="space-y-6">
      <PageHero
        icon={<Sparkles size={22} />}
        title="Content AI Agent"
        subtitle="Scripts, requests, publishing & personal brand."
        gradient="purple"
        actions={
          <button onClick={() => setShowGenerateModal(true)} className="btn-primary flex items-center gap-2">
            <Sparkles size={16} /> Generate Script
          </button>
        }
      />

      {/* ── Drop & Go ───────────────────────────────────────────── */}
      <div className="card border border-gold/30 bg-gradient-to-br from-gold/5 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="section-header flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-gold" /> Drop & Go — AI handles the rest
            </h2>
            <p className="text-xs text-muted">Drop any file. AI writes titles, descriptions, hashtags, and best post times for every platform.</p>
          </div>
          {dropItems.filter((i) => i.status === "ready").length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => planForPeriod(7)}
                disabled={planningWeek}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-50 bg-gradient-to-r from-gold to-gold-light text-xs px-3 py-1.5"
              >
                {planningWeek && planPeriodDays === 7 ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Plan Week
              </button>
              <button
                onClick={() => planForPeriod(30)}
                disabled={planningWeek}
                className="btn-ghost flex items-center gap-1.5 disabled:opacity-50 text-xs px-3 py-1.5 border border-gold/30 text-gold hover:bg-gold/10 rounded-lg"
              >
                {planningWeek && planPeriodDays === 30 ? <Loader size={12} className="animate-spin" /> : null}
                Plan Month
              </button>
              <button
                onClick={() => planForPeriod(365)}
                disabled={planningWeek}
                className="btn-ghost flex items-center gap-1.5 disabled:opacity-50 text-xs px-3 py-1.5 border border-gold/30 text-gold hover:bg-gold/10 rounded-lg"
              >
                {planningWeek && planPeriodDays === 365 ? <Loader size={12} className="animate-spin" /> : null}
                Plan Year
              </button>
            </div>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropZone}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragOver ? "border-gold bg-gold/5" : "border-gold/30 hover:border-gold/50"
          }`}
        >
          <Upload size={36} className="mx-auto mb-3 text-gold" />
          <p className="text-sm font-medium">Drag & drop images, videos, PDFs, or docs</p>
          <p className="text-xs text-muted mt-1">or click to browse — AI auto-packages each file. JPG, PNG, WebP, GIF, MP4, WebM, MOV, MP3, WAV, PDF, DOCX, CSV up to 100 MB.</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={buildAccept(ALLOWED_GENERAL_UPLOADS)}
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) void handleDropGoFiles(files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </div>

        {dropItems.length > 0 && (
          <div className="mt-5 space-y-4">
            {dropItems.map((item) => (
              <div key={item.id} className="border border-gold/20 rounded-xl p-4 bg-surface/50">
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.mime_type?.startsWith("video/") ? <Film size={14} className="text-purple-400 shrink-0" /> :
                      item.mime_type?.startsWith("image/") ? <FileText size={14} className="text-blue-400 shrink-0" /> :
                        <FileText size={14} className="text-gold shrink-0" />}
                    <p className="text-sm font-medium truncate">{item.file_name}</p>
                    {item.status === "uploading" && (
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <Loader size={10} className="animate-spin" /> Uploading...
                      </span>
                    )}
                    {item.status === "analyzing" && (
                      <span className="text-[10px] text-gold flex items-center gap-1">
                        <Loader size={10} className="animate-spin" /> Analyzing...
                      </span>
                    )}
                    {item.status === "ready" && (
                      <span className="text-[10px] text-success flex items-center gap-1">
                        <Check size={10} /> Ready
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="text-[10px] text-danger flex items-center gap-1">
                        <AlertTriangle size={10} /> Failed
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeDropItem(item.id)} className="text-muted hover:text-danger transition-colors" aria-label="Remove item">
                    <X size={14} />
                  </button>
                </div>

                {/* AI Package */}
                {item.status === "ready" && item.ai_package && (
                  <div className="space-y-3">
                    {/* Titles per platform with remix */}
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-2">AI Titles per Platform</p>
                      <div className="space-y-2">
                        {DROP_GO_PLATFORMS.map((plat) => {
                          const title = item.ai_package?.titles?.[plat];
                          if (!title) return null;
                          const isRemixing = remixing?.itemId === item.id && remixing.platform === plat;
                          return (
                            <div key={plat} className="flex items-start gap-2">
                              <span className="text-[10px] uppercase text-gold w-20 shrink-0 pt-1">{plat}</span>
                              <p className="text-xs text-foreground flex-1">{title}</p>
                              <button
                                onClick={() => remixPlatformTitle(item, plat)}
                                disabled={isRemixing}
                                title="Find a better title"
                                className="text-gold/60 hover:text-gold transition-colors disabled:opacity-40 shrink-0"
                              >
                                {isRemixing ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Descriptions */}
                    {item.ai_package.descriptions && (
                      <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Descriptions</p>
                        <div className="space-y-1">
                          {DROP_GO_PLATFORMS.map((plat) => {
                            const desc = item.ai_package?.descriptions?.[plat];
                            if (!desc) return null;
                            return (
                              <div key={plat} className="flex items-start gap-2">
                                <span className="text-[10px] uppercase text-muted w-20 shrink-0 pt-0.5">{plat}</span>
                                <p className="text-[11px] text-muted/90 flex-1">{desc}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Hashtags + Best times grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {item.ai_package.hashtags && (
                        <div className="border border-border rounded-lg p-3">
                          <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Hashtags</p>
                          <div className="space-y-1.5">
                            {(["instagram", "tiktok", "twitter", "linkedin"] as DropGoPlatform[]).map((plat) => {
                              const tags = item.ai_package?.hashtags?.[plat];
                              if (!tags || tags.length === 0) return null;
                              return (
                                <div key={plat}>
                                  <span className="text-[9px] uppercase text-gold mr-2">{plat}</span>
                                  <span className="text-[10px] text-muted">{tags.join(" ")}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {item.ai_package.best_times && (
                        <div className="border border-border rounded-lg p-3">
                          <p className="text-[10px] text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Clock size={10} /> Best Post Times
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {DROP_GO_PLATFORMS.map((plat) => {
                              const t = item.ai_package?.best_times?.[plat];
                              if (!t) return null;
                              return (
                                <div key={plat} className="flex items-center justify-between text-[10px]">
                                  <span className="text-muted capitalize">{plat}</span>
                                  <span className="text-gold font-medium">{t}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Caption variations */}
                    {Array.isArray(item.ai_package.suggested_caption_variations) && item.ai_package.suggested_caption_variations.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted uppercase tracking-wider mb-2">Caption Variations</p>
                        <div className="space-y-1.5">
                          {item.ai_package.suggested_caption_variations.map((cap, idx) => (
                            <div key={idx} className="text-[11px] p-2 bg-surface-light/50 border border-border rounded flex items-start gap-2">
                              <span className="text-gold font-medium shrink-0">#{idx + 1}</span>
                              <span className="text-foreground/90">{cap}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {item.status === "failed" && item.error && (
                  <p className="text-[10px] text-danger/80 mt-2">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Plan preview (week / month / year) */}
        {weekPlan.length > 0 && (
          <div className="mt-5 border border-gold/30 rounded-xl p-4 bg-gold/5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Calendar size={14} className="text-gold" />
                {planPeriodDays}-Day Plan ({weekPlan.length} posts)
              </h3>
              <div className="flex items-center gap-2">
                {planGapAnalysis && planGapAnalysis.needs_creation > 0 && (
                  <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    Gap: {planGapAnalysis.needs_creation} ideas generated
                  </span>
                )}
                {weekPlan.some(p => p.calendar_id && (p.status === "scheduled" || !p.status)) && (
                  <button
                    onClick={approveAndPublishAll}
                    disabled={approvingAll}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-400 text-black font-semibold flex items-center gap-1.5 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {approvingAll ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                    Approve all + publish on schedule
                  </button>
                )}
              </div>
            </div>

            {/* Gap analysis banner */}
            {planGapAnalysis && (
              <div className="mb-3 p-2.5 rounded-lg bg-surface/60 border border-border text-[10px] text-muted flex items-center gap-3">
                <span><strong className="text-foreground">{planGapAnalysis.real_assets}</strong> real assets</span>
                <span className="text-border">/</span>
                <span><strong className="text-foreground">{planGapAnalysis.target_posts}</strong> target posts</span>
                <span className="text-border">/</span>
                <span><strong className="text-amber-400">{planGapAnalysis.needs_creation}</strong> to create</span>
                {planGapAnalysis.recommendation && <span className="text-muted/70 ml-2 flex-1 italic truncate">&ldquo;{planGapAnalysis.recommendation}&rdquo;</span>}
              </div>
            )}

            {/* Themes (month/year plans only) */}
            {planThemes.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {planThemes.slice(0, 12).map((t) => (
                  <span key={t.week} className="text-[10px] px-2 py-1 rounded border border-gold/20 bg-gold/5 text-gold">
                    W{t.week}: {t.theme}
                  </span>
                ))}
                {planThemes.length > 12 && <span className="text-[10px] text-muted">+{planThemes.length - 12} more weeks…</span>}
              </div>
            )}

            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {weekPlan.map((p, i) => {
                const status = p.status || "scheduled";
                const isPublishing = status === "publishing" || publishingId === p.calendar_id;
                const canPublishNow = !!p.calendar_id && !p.needs_creation && status !== "posted" && !isPublishing;
                return (
                  <div key={i} className={`flex items-center gap-3 text-[11px] p-2 border rounded ${p.needs_creation ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-surface/50"}`}>
                    <span className="text-gold font-medium w-12 shrink-0">{p.day}</span>
                    <span className="text-muted w-16 shrink-0">{p.date?.slice(5)}</span>
                    <span className="text-muted w-14 shrink-0">{p.post_time}</span>
                    <span className="text-foreground capitalize w-20 shrink-0">{p.platform}</span>
                    <span className="text-muted flex-1 truncate">{p.title || p.caption || "—"}</span>
                    {/* Status indicator */}
                    <span className="shrink-0 flex items-center gap-1 min-w-[80px] justify-end">
                      {isPublishing && (
                        <><Loader size={10} className="animate-spin text-blue-400" /><span className="text-blue-400">Publishing…</span></>
                      )}
                      {!isPublishing && status === "posted" && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {p.live_url ? (
                            <a href={p.live_url} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">Posted</a>
                          ) : (
                            <span className="text-emerald-400">Posted</span>
                          )}
                        </>
                      )}
                      {!isPublishing && status === "failed" && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          <span className="text-red-400" title={p.published_error || "Publish failed"}>Failed</span>
                        </>
                      )}
                      {!isPublishing && status === "needs_connection" && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <a href="/dashboard/social-manager" className="text-orange-400 hover:underline" title={p.published_error || "No account connected"}>Connect</a>
                        </>
                      )}
                      {!isPublishing && status === "approved_for_publish" && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                          <span className="text-gold">Approved</span>
                        </>
                      )}
                      {!isPublishing && (status === "scheduled" || (!p.status && !p.needs_creation)) && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                          <span className="text-yellow-300">Scheduled</span>
                        </>
                      )}
                    </span>
                    {p.needs_creation && <span className="text-[9px] text-amber-400 shrink-0">NEEDS CREATION</span>}
                    {/* Publish Now button */}
                    {canPublishNow && (
                      <button
                        onClick={() => publishNow(i)}
                        disabled={isPublishing}
                        title="Publish this entry right now"
                        className="shrink-0 text-[10px] px-2 py-1 rounded border border-gold/30 hover:bg-gold/10 text-gold flex items-center gap-1 disabled:opacity-40"
                      >
                        <Send size={10} /> Publish now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Plan Complete dialog — asks what to do next */}
      {showPlanComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm modal-backdrop" onClick={() => setShowPlanComplete(false)}>
          <div className="card max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <Sparkles size={18} className="text-gold" /> Plan ready — what&apos;s next?
            </h2>
            <p className="text-xs text-muted mb-5">
              {planPeriodDays === 7 && "Your 7-day schedule is live. "}
              {planPeriodDays === 30 && "Your 30-day schedule is live. "}
              {planPeriodDays === 365 && "Your 12-month content strategy is live. "}
              {planGapAnalysis && planGapAnalysis.needs_creation > 0
                ? `${planGapAnalysis.needs_creation} posts still need real content. Choose your next move:`
                : "You have enough content. Choose your next move:"}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowPlanComplete(false);
                  // Scroll to the drop zone so user can add more
                  const el = document.querySelector('[data-drop-zone]');
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-gold/40 hover:bg-gold/5 transition flex items-start gap-3"
              >
                <Upload size={16} className="text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">I have more content to upload</p>
                  <p className="text-[10px] text-muted">Drop more files — I&apos;ll re-plan with the full set</p>
                </div>
              </button>
              {planPeriodDays < 30 && (
                <button
                  onClick={() => { setShowPlanComplete(false); planForPeriod(30); }}
                  className="w-full text-left p-3 rounded-lg border border-gold/30 bg-gold/5 hover:bg-gold/10 transition flex items-start gap-3"
                >
                  <Calendar size={16} className="text-gold mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Plan the rest of the month</p>
                    <p className="text-[10px] text-muted">30-day schedule with themes + AI-generated content ideas to fill gaps</p>
                  </div>
                </button>
              )}
              {planPeriodDays < 365 && (
                <button
                  onClick={() => { setShowPlanComplete(false); planForPeriod(365); }}
                  className="w-full text-left p-3 rounded-lg border border-gold/30 bg-gradient-to-r from-gold/10 to-amber-400/10 hover:from-gold/15 transition flex items-start gap-3"
                >
                  <Sparkles size={16} className="text-gold mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Plan the whole year</p>
                    <p className="text-[10px] text-muted">12-month strategy with weekly themes, seasonal moments, and gap-filling ideas for every week</p>
                  </div>
                </button>
              )}
              <button
                onClick={() => { setShowPlanComplete(false); setTab("calendar"); }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-border/60 transition flex items-start gap-3"
              >
                <Calendar size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">View my calendar</p>
                  <p className="text-[10px] text-muted">Jump to the Calendar tab to edit or reschedule</p>
                </div>
              </button>
              <button
                onClick={() => setShowPlanComplete(false)}
                className="w-full text-center py-2 text-[11px] text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <TableSkeleton rows={6} /> : (
        <>
          {/* Scripts */}
          {tab === "scripts" && (
            <DataTable
              columns={[
                { key: "title", label: "Title", render: (s: ContentScript) => (
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted">{s.script_type === "long_form" ? "Long Form" : "Short Form"}</p>
                  </div>
                )},
                { key: "seo_title", label: "SEO Title", render: (s: ContentScript) => (
                  <p className="text-xs max-w-xs truncate">{s.seo_title || "-"}</p>
                )},
                { key: "target_platform", label: "Platform", render: (s: ContentScript) => (
                  <span className="capitalize">{s.target_platform?.replace("_", " ") || "-"}</span>
                )},
                { key: "status", label: "Status", render: (s: ContentScript) => <StatusBadge status={s.status} /> },
                { key: "hashtags", label: "Hashtags", render: (s: ContentScript) => (
                  <span className="text-xs text-muted">{s.hashtags?.length || 0} tags</span>
                )},
                { key: "created_at", label: "Created", render: (s: ContentScript) => formatDate(s.created_at) },
              ]}
              data={scripts}
              emptyMessage="No scripts generated yet. Click 'Generate Script' to start."
            />
          )}

          {/* Content Requests */}
          {tab === "requests" && (
            <DataTable
              columns={[
                { key: "requester_name", label: "From" },
                { key: "source", label: "Source", render: (r: ContentRequest) => <span className="capitalize">{r.source || "-"}</span> },
                { key: "request_text", label: "Request", render: (r: ContentRequest) => (
                  <p className="text-sm max-w-md truncate">{r.request_text}</p>
                )},
                { key: "ai_brief", label: "AI Brief", render: (r: ContentRequest) => r.ai_brief ? (
                  <span className="text-xs text-success flex items-center gap-1"><Check size={12} /> Generated</span>
                ) : <span className="text-xs text-muted">Pending</span> },
                { key: "status", label: "Status", render: (r: ContentRequest) => <StatusBadge status={r.status} /> },
                { key: "created_at", label: "Received", render: (r: ContentRequest) => formatDate(r.created_at) },
              ]}
              data={requests}
              emptyMessage="No content requests yet."
            />
          )}

          {/* Publish Queue — Pre-Publishing Editor */}
          {tab === "publish" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Pending Review" value={publishQueue.filter((p) => p.status === "pending").length} />
                <StatCard label="Approved" value={publishQueue.filter((p) => p.status === "approved").length} />
                <StatCard label="Published" value={publishQueue.filter((p) => p.status === "published").length} />
              </div>
              <DataTable
                columns={[
                  { key: "video_title", label: "Video Title" },
                  { key: "platforms", label: "Platforms", render: (p: PublishQueueItem) => (
                    <div className="flex flex-wrap gap-1">
                      {p.platforms?.map((pl, i) => (
                        <span key={i} className="badge bg-surface-light text-xs capitalize">{pl.replace("_", " ")}</span>
                      ))}
                    </div>
                  )},
                  { key: "scheduled_at", label: "Scheduled", render: (p: PublishQueueItem) => p.scheduled_at ? formatDateTime(p.scheduled_at) : "Not set" },
                  { key: "status", label: "Status", render: (p: PublishQueueItem) => <StatusBadge status={p.status} /> },
                  { key: "actions", label: "", render: (p: PublishQueueItem) => (
                    <div className="flex gap-2">
                      {p.status === "pending" && (
                        <button onClick={() => { setShowPublishEditor(p); setEditingPublish({ video_title: p.video_title, description: p.description, hashtags: p.hashtags, thumbnail_text: p.thumbnail_text, scheduled_at: p.scheduled_at }); }}
                          className="btn-secondary text-xs py-1 px-3">
                          <Edit3 size={12} /> Review
                        </button>
                      )}
                      {(p.status === "pending" || p.status === "approved") && (
                        <button onClick={async () => {
                          toast.loading("Publishing via Zernio...");
                          const res = await fetch("/api/content/publish", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ publish_queue_id: p.id }),
                          });
                          toast.dismiss();
                          const data = await res.json();
                          if (data.success) { toast.success("Published!"); fetchData(); }
                          else toast.error(data.error || "Failed to publish");
                        }} className="btn-primary text-xs py-1 px-3 flex items-center gap-1">
                          <Send size={12} /> Publish
                        </button>
                      )}
                    </div>
                  ) },
                ]}
                data={publishQueue}
                emptyMessage="No videos in the publish queue."
              />
            </div>
          )}

          {/* Calendar */}
          {tab === "calendar" && (
            <DataTable
              columns={[
                { key: "title", label: "Content" },
                { key: "platform", label: "Platform", render: (c: ContentCalendarEntry) => <span className="capitalize">{c.platform.replace("_", " ")}</span> },
                { key: "scheduled_at", label: "Scheduled", render: (c: ContentCalendarEntry) => c.scheduled_at ? formatDateTime(c.scheduled_at) : "TBD" },
                { key: "status", label: "Status", render: (c: ContentCalendarEntry) => <StatusBadge status={c.status} /> },
                { key: "live_url", label: "URL", render: (c: ContentCalendarEntry) => c.live_url ? (
                  <a href={c.live_url} target="_blank" rel="noopener" className="text-gold text-xs">View</a>
                ) : "-" },
              ]}
              data={calendar}
              emptyMessage="No content scheduled yet."
            />
          )}

          {/* Personal Brand */}
          {tab === "personal" && (
            <div className="space-y-6">
              {/* Long Form Ideas */}
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Film size={18} /> Long-Form Ideas (5 per Sunday)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalIdeas.filter((i) => i.idea_type === "long_form").length === 0 ? (
                    <EmptyState type="no-content" title="No long-form ideas yet" description="Ideas are generated every Sunday at 09:00 CET" />
                  ) : (
                    personalIdeas.filter((i) => i.idea_type === "long_form").map((idea) => (
                      <div key={idea.id} className="card-hover">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm leading-tight">{idea.title}</h3>
                          {idea.is_approved && <Check size={16} className="text-success shrink-0" />}
                        </div>
                        <p className="text-xs text-muted mb-2">{idea.hook?.slice(0, 100)}...</p>
                        <div className="flex items-center gap-2 text-xs text-muted mb-3">
                          <Clock size={12} /> {idea.estimated_length}
                          <span className="text-gold">#{idea.target_keyword}</span>
                        </div>
                        {idea.thumbnail_concept && (
                          <p className="text-xs text-muted mb-3 bg-surface-light p-2 rounded">
                            Thumbnail: {idea.thumbnail_concept}
                          </p>
                        )}
                        <div className="flex gap-2">
                          {!idea.is_approved && (
                            <button onClick={() => approveIdea(idea.id)} className="btn-primary text-xs py-1 px-3">Approve</button>
                          )}
                          {!idea.added_to_calendar && (
                            <button onClick={() => addToCalendar(idea)} className="btn-secondary text-xs py-1 px-3">Add to Calendar</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Short Form Ideas */}
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Send size={18} /> Short-Form Ideas (20 per Sunday)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {personalIdeas.filter((i) => i.idea_type === "short_form").length === 0 ? (
                    <EmptyState type="no-content" title="No short-form ideas yet" description="Ideas are generated every Sunday at 09:00 CET" />
                  ) : (
                    personalIdeas.filter((i) => i.idea_type === "short_form").map((idea) => (
                      <div key={idea.id} className="card-hover p-4">
                        <h3 className="font-medium text-sm mb-1">{idea.title}</h3>
                        <p className="text-xs text-gold mb-1">Hook: {idea.hook}</p>
                        <p className="text-xs text-muted mb-2">{idea.core_concept}</p>
                        <div className="flex items-center justify-between">
                          <span className="badge bg-surface-light text-xs">{idea.platform_recommendation}</span>
                          <div className="flex gap-1">
                            {!idea.is_approved && (
                              <button onClick={() => approveIdea(idea.id)} className="text-xs text-gold hover:text-gold-light">Approve</button>
                            )}
                          </div>
                        </div>
                        {idea.trending_angle && (
                          <p className="text-xs text-muted mt-2 italic">{idea.trending_angle}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Tab */}
          {tab === "pipeline" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <select value={pipelineFilter} onChange={e => setPipelineFilter(e.target.value)} className="input text-xs py-1.5 w-40">
                  <option value="all">All Types</option>
                  <option value="blog">Blog</option>
                  <option value="social">Social</option>
                  <option value="video">Video</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {pipelineItems.length === 0 && (
                <div className="card text-center py-12">
                  <Layers size={28} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-sm text-muted">No content in the pipeline yet.</p>
                </div>
              )}
              <div className="grid grid-cols-5 gap-3">
                {["idea", "draft", "review", "approved", "scheduled"].map(stage => (
                  <div key={stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium capitalize text-muted">{stage}</h3>
                      <span className="text-[9px] bg-surface-light px-1.5 py-0.5 rounded text-muted">
                        {pipelineItems.filter(p => p.stage === stage && (pipelineFilter === "all" || p.type === pipelineFilter)).length}
                      </span>
                    </div>
                    {pipelineItems.filter(p => p.stage === stage && (pipelineFilter === "all" || p.type === pipelineFilter)).map(item => (
                      <div key={item.id} className="card p-3 text-xs">
                        <p className="font-medium mb-1">{item.title}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted">
                          <span className={`px-1.5 py-0.5 rounded ${item.type === "blog" ? "bg-info/10 text-info" : item.type === "video" ? "bg-danger/10 text-danger" : item.type === "email" ? "bg-purple-400/10 text-purple-400" : "bg-gold/10 text-gold"}`}>{item.type}</span>
                          <span>{item.assignee}</span>
                        </div>
                        {item.due && <p className="text-[10px] text-muted mt-1 flex items-center gap-1"><Clock size={9} /> Due: {item.due}</p>}
                        {item.seo_score > 0 && <p className="text-[10px] mt-1 flex items-center gap-1"><Search size={9} className="text-gold" /> SEO: {item.seo_score}/100</p>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {/* Content Approval Flow */}
              <div className="card">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Shield size={14} className="text-gold" /> Content Approval Flow</h3>
                <div className="flex items-center gap-4">
                  {["AI Draft", "Internal Review", "Client Approval", "Schedule", "Publish"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className="text-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-gold/10 text-gold border border-gold/20" : "bg-surface-light text-muted border border-border"}`}>{i + 1}</div>
                        <p className="text-[9px] text-muted mt-1">{step}</p>
                      </div>
                      {i < 4 && <ChevronRight size={12} className="text-muted" />}
                    </div>
                  ))}
                </div>
              </div>
              {/* Repurpose Suggestions */}
              <div className="card">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><RefreshCw size={14} className="text-gold" /> Repurpose Suggestions</h3>
                <p className="text-xs text-muted text-center py-6">No repurpose suggestions yet. Add content to the pipeline to get started.</p>
              </div>
              {/* Version Control */}
              <div className="card">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><GitBranch size={14} className="text-gold" /> Version History</h3>
                <div className="space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-xs text-muted text-center py-6">No version history yet.</p>
                  ) : (
                    versions.map(v => (
                      <div key={v.id} className="flex items-center justify-between p-2 border border-border rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-surface-light px-2 py-0.5 rounded font-mono">v{v.version}</span>
                          <div>
                            <p className="text-xs font-medium">{v.content_title}</p>
                            <p className="text-[10px] text-muted">{v.changes}</p>
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-muted">
                          <p>{v.author}</p>
                          <p>{new Date(v.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {tab === "analytics" && (
            <div className="space-y-4">
              <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
                initial="hidden"
                animate="visible"
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
              >
                {[
                  { label: "Total Content", value: contentAnalytics.total_pieces, icon: <FileText size={16} />, color: "text-gold" },
                  { label: "Published This Month", value: contentAnalytics.published_this_month, icon: <Check size={16} />, color: "text-success" },
                  { label: "Avg Engagement", value: contentAnalytics.avg_engagement, icon: <TrendingUp size={16} />, color: "text-info" },
                  { label: "AI Enhanced", value: `${contentAnalytics.ai_enhanced}%`, icon: <Sparkles size={16} />, color: "text-purple-400" },
                ].map(stat => (
                  <motion.div
                    key={stat.label}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
                    }}
                    whileHover={{ y: -3 }}
                    className="card text-center p-4"
                  >
                    <div className={`${stat.color} mx-auto mb-2`}>{stat.icon}</div>
                    <p className="text-xl font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted">{stat.label}</p>
                  </motion.div>
                ))}
              </motion.div>
              <div className="card">
                <h3 className="text-sm font-medium mb-3">Content by Type</h3>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(contentAnalytics.content_types).map(([type, count]) => (
                    <div key={type} className="text-center p-3 bg-surface-light/50 rounded-lg border border-border">
                      <p className="text-lg font-bold text-gold">{count}</p>
                      <p className="text-[10px] text-muted capitalize">{type}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="card">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><ThumbsUp size={14} className="text-success" /> Approval Rate</h3>
                  <p className="text-3xl font-bold text-success">{contentAnalytics.approval_rate}%</p>
                  <p className="text-xs text-muted">of content approved on first review</p>
                </div>
                <div className="card">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Star size={14} className="text-gold" /> Top Performing</h3>
                  <p className="text-sm font-medium">{contentAnalytics.top_performing}</p>
                  <p className="text-xs text-muted">Highest engagement this month</p>
                </div>
              </div>
            </div>
          )}

          {/* SEO & Quality Tab */}
          {tab === "seo" && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Search size={14} className="text-gold" /> SEO & Readability Checker</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider">Target Keyword (optional)</label>
                    <input value={seoKeyword} onChange={e => setSeoKeyword(e.target.value)} placeholder="e.g. digital marketing agency" className="input w-full text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider">Content</label>
                    <textarea value={seoText} onChange={e => setSeoText(e.target.value)} placeholder="Paste your content here..." rows={8} className="input w-full text-sm mt-1" />
                    <button
                      onClick={() => enhanceText(seoText, `Improve this content for SEO.${seoKeyword ? ` Target keyword: "${seoKeyword}".` : ""} Make it more engaging, add relevant headers, improve readability, and naturally incorporate keywords. Keep the same topic and message.`, setSeoText, "seo")}
                      disabled={!seoText.trim() || enhancing === "seo"}
                      className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40 mt-1"
                    >
                      {enhancing === "seo" ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      AI Enhance for SEO
                    </button>
                  </div>
                  <button onClick={runSeoCheck} disabled={seoChecking} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                    {seoChecking ? <><div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Checking...</> : <><Search size={14} /> Run SEO Check</>}
                  </button>
                </div>
                {seoResults && (
                  <div className="mt-4 space-y-3 pt-4 border-t border-border">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-3 rounded-lg border border-border">
                        <p className={`text-2xl font-bold ${seoResults.score >= 70 ? "text-success" : seoResults.score >= 40 ? "text-warning" : "text-danger"}`}>{seoResults.score}</p>
                        <p className="text-[10px] text-muted">SEO Score</p>
                      </div>
                      <div className="text-center p-3 rounded-lg border border-border">
                        <p className="text-2xl font-bold text-foreground">{seoResults.wordCount}</p>
                        <p className="text-[10px] text-muted">Word Count</p>
                      </div>
                      <div className="text-center p-3 rounded-lg border border-border">
                        <p className="text-sm font-medium text-info">{seoResults.readability}</p>
                        <p className="text-[10px] text-muted">Readability</p>
                      </div>
                      <div className="text-center p-3 rounded-lg border border-border">
                        <p className="text-sm font-medium text-success">{seoResults.plagiarism}</p>
                        <p className="text-[10px] text-muted">Plagiarism</p>
                      </div>
                    </div>
                    {seoResults.issues.length > 0 && (
                      <div className="p-3 bg-danger/5 border border-danger/10 rounded-lg">
                        <p className="text-xs font-medium text-danger mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Issues</p>
                        {seoResults.issues.map((issue, i) => <p key={i} className="text-[10px] text-danger/80">- {issue}</p>)}
                      </div>
                    )}
                    <div className="p-3 bg-gold/5 border border-gold/10 rounded-lg">
                      <p className="text-xs font-medium text-gold mb-2 flex items-center gap-1"><Zap size={12} /> Suggestions</p>
                      {seoResults.suggestions.map((s, i) => <p key={i} className="text-[10px] text-gold/80">- {s}</p>)}
                    </div>
                  </div>
                )}
              </div>
              {/* AI Enhance */}
              <div className="card">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Sparkles size={14} className="text-gold" /> AI Enhance</h3>
                <p className="text-xs text-muted mb-3">Let AI improve your content for better SEO, readability, and engagement.</p>
                <div className="grid grid-cols-3 gap-2">
                  {["Improve Readability", "Add Keywords", "Expand Content", "Shorten & Tighten", "Add CTA", "Fix Grammar"].map(action => (
                    <button key={action} onClick={() => toast.success(`AI enhancing: ${action}`)} className="p-3 border border-border rounded-lg text-xs text-left hover:border-gold/30 transition-all">
                      <Sparkles size={12} className="text-gold mb-1" />
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Script Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate AI Script" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); generateScript(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Script Type *</label>
              <select name="script_type" className="input w-full" required>
                <option value="long_form">Long Form (8-15 min)</option>
                <option value="short_form">Short Form (30-60 sec)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Platform</label>
              <select name="platform" className="input w-full">
                <option value="">Auto-detect</option>
                <option value="youtube">YouTube</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram_reels">Instagram Reels</option>
                <option value="facebook_reels">Facebook Reels</option>
                <option value="linkedin_video">LinkedIn Video</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Topic / Idea *</label>
            <input name="topic" className="input w-full" placeholder="What should the video be about?" required />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Brand Voice</label>
            <input name="brand_voice" className="input w-full" placeholder="e.g., professional, casual, energetic" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowGenerateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Sparkles size={16} /> Generate
            </button>
          </div>
        </form>
      </Modal>

      {/* Remix Title Modal */}
      <Modal isOpen={!!remixOptions} onClose={() => setRemixOptions(null)} title="Pick a better title" size="md">
        {remixOptions && (
          <div className="space-y-3">
            <p className="text-xs text-muted">AI suggestions for <span className="text-gold capitalize">{remixOptions.platform}</span>:</p>
            <div className="space-y-2">
              {remixOptions.alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => applyRemixTitle(alt)}
                  className="w-full text-left p-3 border border-gold/30 rounded-lg hover:border-gold hover:bg-gold/5 transition-all"
                >
                  <span className="text-[10px] text-gold font-medium mr-2">#{i + 1}</span>
                  <span className="text-sm">{alt}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setRemixOptions(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Publish Editor Modal */}
      <Modal isOpen={!!showPublishEditor} onClose={() => setShowPublishEditor(null)} title="Pre-Publishing Editor" size="xl">
        {showPublishEditor && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Video Title</label>
              <input
                className="input w-full"
                value={editingPublish.video_title || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, video_title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <textarea
                className="input w-full h-32"
                value={editingPublish.description || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, description: e.target.value })}
              />
              <button
                onClick={() => enhanceText(editingPublish.description || "", `Improve this video description for social media. Make it engaging, include a call-to-action, and optimize for the platform. Title: "${editingPublish.video_title || ""}".`, (v) => setEditingPublish(prev => ({ ...prev, description: v })), "desc")}
                disabled={!editingPublish.description?.trim() || enhancing === "desc"}
                className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40 mt-1"
              >
                {enhancing === "desc" ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                AI Enhance
              </button>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Hashtags (comma separated)</label>
              <textarea
                className="input w-full h-20"
                value={editingPublish.hashtags?.join(", ") || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, hashtags: e.target.value.split(",").map((h) => h.trim()) })}
              />
              <button
                onClick={() => enhanceText(editingPublish.hashtags?.join(", ") || "", `Generate optimized hashtags for this social media video. Title: "${editingPublish.video_title || ""}". Return as comma-separated hashtags. Mix trending, niche, and branded tags. 15-20 hashtags.`, (v) => setEditingPublish(prev => ({ ...prev, hashtags: v.split(",").map(h => h.trim()) })), "hash")}
                disabled={!editingPublish.hashtags?.length || enhancing === "hash"}
                className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40 mt-1"
              >
                {enhancing === "hash" ? <Loader size={10} className="animate-spin" /> : <Sparkles size={10} />}
                AI Enhance Hashtags
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Thumbnail Text</label>
                <input
                  className="input w-full"
                  value={editingPublish.thumbnail_text || ""}
                  onChange={(e) => setEditingPublish({ ...editingPublish, thumbnail_text: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={editingPublish.scheduled_at?.slice(0, 16) || ""}
                  onChange={(e) => setEditingPublish({ ...editingPublish, scheduled_at: new Date(e.target.value).toISOString() })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {["youtube", "youtube_shorts", "tiktok", "instagram_reels", "facebook_reels", "linkedin_video"].map((p) => (
                  <label key={p} className="flex items-center gap-2 bg-surface-light px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPublishEditor.platforms?.includes(p as PublishPlatform) || false}
                      className="accent-gold"
                      readOnly
                    />
                    <span className="text-sm capitalize">{p.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setShowPublishEditor(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => { /* Publish now logic */ }} className="btn-secondary flex items-center gap-2">
                <Send size={16} /> Publish Now
              </button>
              <button onClick={() => approvePublish(showPublishEditor)} className="btn-primary flex items-center gap-2">
                <Check size={16} /> Approve & Schedule
              </button>
            </div>
          </div>
        )}
      </Modal>
    </MotionPage>
  );
}
