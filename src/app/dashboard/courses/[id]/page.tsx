"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen, ChevronRight, ChevronDown, Plus, Trash2,
  Video, FileText, HelpCircle, Paperclip, Save,
  Eye, EyeOff, Users, Copy, Check, GripVertical,
  ArrowLeft, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import PageHero from "@/components/ui/page-hero";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content_type: "video" | "text" | "quiz" | "file";
  content_url: string | null;
  content_body: string | null;
  duration_seconds: number | null;
  sort_order: number;
  is_free_preview: boolean;
  drip_delay_days: number;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_free_preview: boolean;
  course_lessons: Lesson[];
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_free: boolean;
  status: "draft" | "published" | "archived";
  access_type: "lifetime" | "subscription" | "drip";
  course_modules: Module[];
}

interface Client {
  id: string;
  name: string;
  email: string | null;
}

const CONTENT_TYPE_ICON: Record<string, React.ReactNode> = {
  video: <Video size={14} />,
  text: <FileText size={14} />,
  quiz: <HelpCircle size={14} />,
  file: <Paperclip size={14} />,
};

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function CourseBuilderPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Course settings form state
  const [settingsTitle, setSettingsTitle] = useState("");
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsIsFree, setSettingsIsFree] = useState(true);
  const [settingsPrice, setSettingsPrice] = useState("");
  const [settingsAccess, setSettingsAccess] = useState<"lifetime" | "subscription" | "drip">("lifetime");
  const [settingsStatus, setSettingsStatus] = useState<"draft" | "published" | "archived">("draft");

  // Lesson editor state
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<Lesson["content_type"]>("video");
  const [lessonUrl, setLessonUrl] = useState("");
  const [lessonBody, setLessonBody] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [lessonDrip, setLessonDrip] = useState("0");
  const [lessonFreePreview, setLessonFreePreview] = useState(false);

  // Enroll panel
  const [clients, setClients] = useState<Client[]>([]);
  const [enrollClientId, setEnrollClientId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);

  // Auto-save debounce
  const lessonSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Load course ───
  const fetchCourse = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json() as { course: Course };
      const c = json.course;
      setCourse(c);
      setSettingsTitle(c.title);
      setSettingsDesc(c.description ?? "");
      setSettingsIsFree(c.is_free);
      setSettingsPrice(String(c.price ?? 0));
      setSettingsAccess(c.access_type as typeof settingsAccess);
      setSettingsStatus(c.status);
      // Expand all modules by default
      setExpandedModules(new Set((c.course_modules ?? []).map((m: Module) => m.id)));
    } catch {
      toast.error("Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchCourse(); }, [fetchCourse]);

  // ─── Load clients for enroll ───
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) return;
      const json = await res.json() as { clients: Client[] };
      setClients(json.clients ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (showEnrollPanel) void fetchClients();
  }, [showEnrollPanel, fetchClients]);

  // ─── Select lesson → populate editor ───
  const selectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonType(lesson.content_type);
    setLessonUrl(lesson.content_url ?? "");
    setLessonBody(lesson.content_body ?? "");
    setLessonDuration(lesson.duration_seconds ? String(lesson.duration_seconds) : "");
    setLessonDrip(String(lesson.drip_delay_days ?? 0));
    setLessonFreePreview(lesson.is_free_preview);
  };

  // ─── Auto-save lesson (debounced 1s) ───
  const triggerLessonSave = useCallback(() => {
    if (!selectedLesson) return;
    if (lessonSaveTimer.current) clearTimeout(lessonSaveTimer.current);
    lessonSaveTimer.current = setTimeout(() => {
      void saveLessonNow();
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson, lessonTitle, lessonType, lessonUrl, lessonBody, lessonDuration, lessonDrip, lessonFreePreview]);

  const saveLessonNow = async () => {
    if (!selectedLesson) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/courses/lessons/${selectedLesson.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: lessonTitle,
          content_type: lessonType,
          content_url: lessonUrl || null,
          content_body: lessonBody || null,
          duration_seconds: lessonDuration ? parseInt(lessonDuration) : null,
          drip_delay_days: parseInt(lessonDrip) || 0,
          is_free_preview: lessonFreePreview,
        }),
      });
      if (!res.ok) throw new Error();
      // Update local state
      const json = await res.json() as { lesson: Lesson };
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          course_modules: prev.course_modules.map(m => ({
            ...m,
            course_lessons: m.course_lessons.map(l =>
              l.id === selectedLesson.id ? json.lesson : l,
            ),
          })),
        };
      });
      setSelectedLesson(json.lesson);
    } catch {
      toast.error("Auto-save failed");
    } finally {
      setSaving(false);
    }
  };

  // ─── Save course settings ───
  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: settingsTitle,
          description: settingsDesc || null,
          is_free: settingsIsFree,
          price: settingsIsFree ? 0 : parseFloat(settingsPrice) || 0,
          access_type: settingsAccess,
          status: settingsStatus,
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { course: Course };
      setCourse(prev => prev ? { ...prev, ...json.course } : prev);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // ─── Add module ───
  const addModule = async () => {
    const title = prompt("Module title:");
    if (!title?.trim()) return;
    try {
      const res = await fetch(`/api/courses/${id}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { module: Module };
      const newMod: Module = { ...json.module, course_lessons: [] };
      setCourse(prev => prev ? { ...prev, course_modules: [...(prev.course_modules ?? []), newMod] } : prev);
      setExpandedModules(prev => new Set(Array.from(prev).concat(newMod.id)));
    } catch {
      toast.error("Failed to add module");
    }
  };

  // ─── Delete module ───
  const deleteModule = async (moduleId: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    try {
      await fetch(`/api/courses/modules/${moduleId}`, { method: "DELETE" });
      setCourse(prev => prev ? {
        ...prev,
        course_modules: prev.course_modules.filter(m => m.id !== moduleId),
      } : prev);
      if (selectedLesson?.module_id === moduleId) setSelectedLesson(null);
    } catch {
      toast.error("Failed to delete module");
    }
  };

  // ─── Add lesson ───
  const addLesson = async (moduleId: string) => {
    const title = prompt("Lesson title:");
    if (!title?.trim()) return;
    try {
      const res = await fetch(`/api/courses/modules/${moduleId}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json() as { lesson: Lesson };
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          course_modules: prev.course_modules.map(m =>
            m.id === moduleId
              ? { ...m, course_lessons: [...m.course_lessons, json.lesson] }
              : m,
          ),
        };
      });
      selectLesson(json.lesson);
    } catch {
      toast.error("Failed to add lesson");
    }
  };

  // ─── Delete lesson ───
  const deleteLesson = async (lessonId: string) => {
    if (!confirm("Delete this lesson?")) return;
    try {
      await fetch(`/api/courses/lessons/${lessonId}`, { method: "DELETE" });
      setCourse(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          course_modules: prev.course_modules.map(m => ({
            ...m,
            course_lessons: m.course_lessons.filter(l => l.id !== lessonId),
          })),
        };
      });
      if (selectedLesson?.id === lessonId) setSelectedLesson(null);
    } catch {
      toast.error("Failed to delete lesson");
    }
  };

  // ─── Enroll client ───
  const enrollClient = async () => {
    if (!enrollClientId) return toast.error("Select a client");
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: enrollClientId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Client enrolled");
      setEnrollClientId("");
      setShowEnrollPanel(false);
    } catch {
      toast.error("Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  };

  const copyPortalLink = () => {
    if (!course) return;
    const slug = course.id; // Use ID as fallback slug
    void navigator.clipboard.writeText(`${window.location.origin}/portal/${slug}/courses`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 size={32} className="text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-white/40">
        Course not found
      </div>
    );
  }

  const modules = (course.course_modules ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      <PageHero
        title={course.title}
        subtitle="Course Builder — modules, lessons, and settings"
        icon={<BookOpen size={24} />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            {saving && <Loader2 size={14} className="text-white/40 animate-spin" />}
            <Link
              href="/dashboard/courses"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </Link>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                course.status === "published"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {course.status}
            </span>
          </div>
        }
      />

      <div className="flex flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 gap-4">
        {/* ── LEFT: Module tree ── */}
        <aside className="w-72 flex-shrink-0 flex flex-col gap-3">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex-1 overflow-y-auto max-h-[calc(100vh-220px)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Curriculum</span>
              <button
                onClick={() => void addModule()}
                className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                <Plus size={12} />
                Module
              </button>
            </div>

            {modules.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-6">No modules yet</p>
            ) : (
              <div className="space-y-1">
                {modules.map((mod) => (
                  <ModuleItem
                    key={mod.id}
                    mod={mod}
                    expanded={expandedModules.has(mod.id)}
                    selectedLessonId={selectedLesson?.id ?? null}
                    onToggle={() => setExpandedModules(prev => {
                      const next = new Set(prev);
                      if (next.has(mod.id)) next.delete(mod.id);
                      else next.add(mod.id);
                      return next;
                    })}
                    onSelectLesson={selectLesson}
                    onAddLesson={() => void addLesson(mod.id)}
                    onDeleteModule={() => void deleteModule(mod.id)}
                    onDeleteLesson={(lid) => void deleteLesson(lid)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── CENTER: Lesson editor ── */}
        <main className="flex-1 min-w-0">
          {selectedLesson ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">Lesson Editor</h2>
                <button
                  onClick={() => { triggerLessonSave(); void saveLessonNow(); }}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Lesson title</label>
                  <input
                    value={lessonTitle}
                    onChange={e => { setLessonTitle(e.target.value); triggerLessonSave(); }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Content type */}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Content type</label>
                  <div className="flex gap-2">
                    {(["video","text","quiz","file"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setLessonType(t); triggerLessonSave(); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                          lessonType === t
                            ? "bg-purple-600 text-white"
                            : "bg-white/5 text-white/50 hover:bg-white/10"
                        }`}
                      >
                        {CONTENT_TYPE_ICON[t]}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* URL (for video/file) */}
                {(lessonType === "video" || lessonType === "file") && (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">
                      {lessonType === "video" ? "Video URL (YouTube, Vimeo, direct)" : "File URL"}
                    </label>
                    <input
                      value={lessonUrl}
                      onChange={e => { setLessonUrl(e.target.value); triggerLessonSave(); }}
                      placeholder="https://…"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                {/* Body (for text/quiz) */}
                {(lessonType === "text" || lessonType === "quiz") && (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">
                      {lessonType === "quiz" ? "Quiz description / instructions" : "Lesson content (markdown)"}
                    </label>
                    <textarea
                      value={lessonBody}
                      onChange={e => { setLessonBody(e.target.value); triggerLessonSave(); }}
                      rows={10}
                      placeholder={lessonType === "text" ? "Write your lesson content here…" : "Quiz instructions…"}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none font-mono"
                    />
                  </div>
                )}

                {/* Duration + drip + free preview */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Duration (seconds)</label>
                    <input
                      type="number"
                      value={lessonDuration}
                      onChange={e => { setLessonDuration(e.target.value); triggerLessonSave(); }}
                      placeholder="e.g. 300"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Drip delay (days)</label>
                    <input
                      type="number"
                      value={lessonDrip}
                      onChange={e => { setLessonDrip(e.target.value); triggerLessonSave(); }}
                      min="0"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Free preview</label>
                    <div className="flex items-center h-[38px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lessonFreePreview}
                          onChange={e => { setLessonFreePreview(e.target.checked); triggerLessonSave(); }}
                          className="accent-purple-500"
                        />
                        <span className="text-sm text-white/70">Enabled</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-xl h-full flex items-center justify-center text-white/30">
              <div className="text-center">
                <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a lesson to edit</p>
                <p className="text-xs mt-1">Or add a module to get started</p>
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT: Settings panel ── */}
        <aside className="w-72 flex-shrink-0">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-white text-sm">Course Settings</h3>

            <div>
              <label className="block text-xs text-white/50 mb-1">Title</label>
              <input
                value={settingsTitle}
                onChange={e => setSettingsTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Description</label>
              <textarea
                value={settingsDesc}
                onChange={e => setSettingsDesc(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsIsFree}
                  onChange={e => setSettingsIsFree(e.target.checked)}
                  className="accent-purple-500"
                />
                <span className="text-sm text-white/70">Free course</span>
              </label>
            </div>

            {!settingsIsFree && (
              <div>
                <label className="block text-xs text-white/50 mb-1">Price ($)</label>
                <input
                  type="number"
                  value={settingsPrice}
                  onChange={e => setSettingsPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-1">Access type</label>
              <select
                value={settingsAccess}
                onChange={e => setSettingsAccess(e.target.value as typeof settingsAccess)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                <option value="lifetime">Lifetime</option>
                <option value="subscription">Subscription</option>
                <option value="drip">Drip (time-gated)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-1">Status</label>
              <div className="flex gap-2">
                {(["draft","published"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setSettingsStatus(s)}
                    className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                      settingsStatus === s
                        ? s === "published" ? "bg-green-600 text-white" : "bg-white/15 text-white"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {s === "published" ? <Eye size={11} /> : <EyeOff size={11} />}
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => void saveSettings()}
              disabled={saving}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Save size={14} />
              Save Settings
            </button>

            <hr className="border-white/10" />

            {/* Enroll client */}
            <div>
              <button
                onClick={() => setShowEnrollPanel(!showEnrollPanel)}
                className="w-full flex items-center justify-between text-sm text-white/70 hover:text-white transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  Enroll a client
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showEnrollPanel ? "rotate-180" : ""}`}
                />
              </button>

              {showEnrollPanel && (
                <div className="mt-3 space-y-2">
                  <select
                    value={enrollClientId}
                    onChange={e => setEnrollClientId(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Select client…</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => void enrollClient()}
                    disabled={enrolling || !enrollClientId}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
                  >
                    {enrolling ? "Enrolling…" : "Enroll"}
                  </button>
                </div>
              )}
            </div>

            <hr className="border-white/10" />

            {/* Portal link note */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
              <p className="text-xs text-indigo-300 mb-2">
                Students access their courses at:
              </p>
              <code className="block text-xs text-indigo-200 bg-black/20 rounded px-2 py-1 break-all">
                /portal/[slug]/courses
              </code>
              <button
                onClick={copyPortalLink}
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────

function ModuleItem({
  mod,
  expanded,
  selectedLessonId,
  onToggle,
  onSelectLesson,
  onAddLesson,
  onDeleteModule,
  onDeleteLesson,
}: {
  mod: Module;
  expanded: boolean;
  selectedLessonId: string | null;
  onToggle: () => void;
  onSelectLesson: (l: Lesson) => void;
  onAddLesson: () => void;
  onDeleteModule: () => void;
  onDeleteLesson: (id: string) => void;
}) {
  const lessons = (mod.course_lessons ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="rounded-lg overflow-hidden">
      {/* Module header */}
      <div className="group flex items-center gap-1 px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
        <GripVertical size={12} className="text-white/20 flex-shrink-0" />
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-1 text-left min-w-0"
        >
          {expanded ? (
            <ChevronDown size={13} className="text-white/40 flex-shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-white/40 flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-white truncate">{mod.title}</span>
          <span className="ml-auto text-xs text-white/30 flex-shrink-0">
            {lessons.length}
          </span>
        </button>
        <button
          onClick={onAddLesson}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-white/40 hover:text-purple-400 transition-all"
          title="Add lesson"
        >
          <Plus size={12} />
        </button>
        <button
          onClick={onDeleteModule}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-white/30 hover:text-red-400 transition-all"
          title="Delete module"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Lessons */}
      {expanded && lessons.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {lessons.map(lesson => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              selected={selectedLessonId === lesson.id}
              onSelect={() => onSelectLesson(lesson)}
              onDelete={() => onDeleteLesson(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonItem({
  lesson,
  selected,
  onSelect,
  onDelete,
}: {
  lesson: Lesson;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
        selected ? "bg-purple-600/25 border border-purple-500/30" : "hover:bg-white/5"
      }`}
    >
      <GripVertical size={11} className="text-white/15 flex-shrink-0" />
      <button onClick={onSelect} className="flex-1 flex items-center gap-1.5 min-w-0 text-left">
        <span className={`flex-shrink-0 ${selected ? "text-purple-400" : "text-white/30"}`}>
          {CONTENT_TYPE_ICON[lesson.content_type]}
        </span>
        <span className={`text-xs truncate ${selected ? "text-white" : "text-white/70"}`}>
          {lesson.title}
        </span>
        {lesson.drip_delay_days > 0 && (
          <span className="ml-auto text-[10px] text-white/30 flex-shrink-0">+{lesson.drip_delay_days}d</span>
        )}
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-white/20 hover:text-red-400 transition-all"
        title="Delete lesson"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
