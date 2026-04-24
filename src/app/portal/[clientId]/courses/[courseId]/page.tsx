"use client";

/* ══════════════════════════════════════════════════════════════════
   Student-facing course viewer.

   Layout:
     - Left sidebar: module/lesson tree with completion checkmarks
     - Right main: current lesson viewer OR course landing if no lesson
       is selected
     - Top: progress bar + breadcrumb
     - Bottom: Mark Complete + Next Lesson buttons

   When a lesson is open in the route (/courses/[courseId]/[lessonId])
   the lesson page handles its own rendering — this shell stays visible
   via the parent layout shares state via localStorage/sessionStorage
   isn't used; each page self-loads. For the index route we show a
   course overview with a "Start learning" button that jumps to the
   first lesson.
   ══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  PlayCircle,
  FileText,
  Download,
  ClipboardList,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Clock,
} from "lucide-react";

type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content_type: string | null;
  content_url: string | null;
  content_body: string | null;
  duration_seconds: number | null;
  sort_order: number | null;
  is_free_preview: boolean | null;
  drip_delay_days: number | null;
};

type ModuleWithLessons = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number | null;
  is_free_preview: boolean | null;
  lessons: Lesson[];
};

type CourseDetail = {
  course: {
    id: string;
    title: string;
    description: string | null;
    thumbnail_url: string | null;
    status: string | null;
    price: number | null;
    is_free: boolean | null;
    access_type: string | null;
  };
  modules: ModuleWithLessons[];
  enrolment: {
    progress_percent: number;
    enrolled_at: string | null;
    expires_at: string | null;
    last_accessed_at: string | null;
  } | null;
  completion: Record<string, string>;
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
};

export default function PortalCourseDetailPage({
  params,
}: {
  params: { clientId: string; courseId: string };
}) {
  const { clientId, courseId } = params;

  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/portal/${clientId}/courses/${courseId}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(json.error || `Error ${res.status}`);
      }
      const json = (await res.json()) as CourseDetail;
      setData(json);
      // Auto-expand the first module
      if (json.modules.length > 0) {
        setExpandedModules((prev) => ({ ...prev, [json.modules[0].id]: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [clientId, courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const flatLessons = useMemo(() => {
    if (!data) return [] as Lesson[];
    return data.modules.flatMap((m) => m.lessons);
  }, [data]);

  const firstIncomplete = useMemo(() => {
    if (!data) return null;
    return flatLessons.find((l) => !data.completion[l.id]) ?? flatLessons[0] ?? null;
  }, [data, flatLessons]);

  function toggleModule(id: string) {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <div className="card flex items-center gap-3 text-muted text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading course…
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex items-start gap-3 border-danger/20 bg-danger/[0.03]">
        <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Couldn&apos;t load this course</p>
          <p className="text-[11px] text-muted mt-0.5">{error}</p>
        </div>
        <Link
          href={`/portal/${clientId}/courses`}
          className="text-[11px] text-gold hover:text-gold/80 font-medium"
        >
          Back
        </Link>
      </div>
    );
  }

  if (!data) return null;
  const { course, modules, progress } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted fade-in">
        <Link
          href={`/portal/${clientId}/courses`}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={12} /> All courses
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{course.title}</span>
      </div>

      {/* Hero + progress */}
      <div className="card fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-gold/[0.04] -translate-y-1/2 translate-x-1/3" />
        <div className="relative flex flex-col sm:flex-row gap-4 items-start">
          <div className="h-20 w-32 shrink-0 rounded-xl overflow-hidden bg-surface-light border border-border">
            {course.thumbnail_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/10 to-accent/10">
                <BookOpen size={24} className="text-gold/40" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {course.title}
            </h1>
            {course.description && (
              <p className="text-xs text-muted mt-1 line-clamp-2">{course.description}</p>
            )}
            <div className="flex items-center gap-4 text-[10px] text-muted mt-2">
              <span className="flex items-center gap-1">
                <BookOpen size={11} /> {modules.length} module{modules.length === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1">
                <PlayCircle size={11} /> {progress.total_lessons} lesson
                {progress.total_lessons === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 size={11} className="text-success" />
                {progress.completed_lessons} complete
              </span>
            </div>
          </div>
          {firstIncomplete && (
            <Link
              href={`/portal/${clientId}/courses/${courseId}/${firstIncomplete.id}`}
              className="btn-primary flex items-center gap-2 text-xs shrink-0"
            >
              <PlayCircle size={14} />
              {progress.completed_lessons > 0 ? "Continue" : "Start"} learning
            </Link>
          )}
          {!firstIncomplete && progress.total_lessons > 0 && (
            <div className="inline-flex items-center gap-2 text-xs text-success font-medium bg-success/10 border border-success/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={14} /> Course complete
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 pt-4 border-t border-border/40 relative">
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-muted uppercase tracking-wider font-medium">Your progress</span>
            <span className="text-foreground font-semibold tabular-nums">
              {progress.progress_percent}%
            </span>
          </div>
          <div className="h-2 bg-surface-light rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                progress.progress_percent >= 100
                  ? "bg-success"
                  : progress.progress_percent >= 50
                  ? "bg-gold"
                  : "bg-info"
              }`}
              style={{ width: `${Math.max(progress.progress_percent, 2)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Two-column: module tree + overview pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 fade-in stagger-1">
        {/* ─── Sidebar: module/lesson tree ─── */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Curriculum
            </p>
            <span className="text-[10px] text-muted">
              {progress.completed_lessons}/{progress.total_lessons}
            </span>
          </div>
          {modules.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] text-muted">
              No modules yet.
            </div>
          ) : (
            <div className="divide-y divide-border/40 max-h-[70vh] overflow-y-auto">
              {modules.map((mod, idx) => {
                const expanded = !!expandedModules[mod.id];
                const moduleCompleted = mod.lessons.length > 0 && mod.lessons.every((l) => !!data.completion[l.id]);
                return (
                  <div key={mod.id}>
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-light transition-colors"
                    >
                      <span className="text-[10px] text-muted font-semibold w-4">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate leading-snug">
                          {mod.title}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5">
                          {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      {moduleCompleted && (
                        <CheckCircle2 size={14} className="text-success shrink-0" />
                      )}
                      {expanded ? (
                        <ChevronDown size={14} className="text-muted shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-muted shrink-0" />
                      )}
                    </button>
                    {expanded && (
                      <div className="pb-2">
                        {mod.lessons.length === 0 ? (
                          <p className="text-[10px] text-muted px-10 py-2">No lessons yet.</p>
                        ) : (
                          mod.lessons.map((lesson) => {
                            const done = !!data.completion[lesson.id];
                            return (
                              <Link
                                key={lesson.id}
                                href={`/portal/${clientId}/courses/${courseId}/${lesson.id}`}
                                className="flex items-center gap-2.5 pl-10 pr-4 py-2 hover:bg-gold/5 transition-colors group"
                              >
                                {done ? (
                                  <CheckCircle2
                                    size={13}
                                    className="text-success shrink-0"
                                  />
                                ) : (
                                  <Circle size={13} className="text-muted/60 shrink-0" />
                                )}
                                <LessonTypeIcon type={lesson.content_type} />
                                <span
                                  className={`text-[11px] leading-snug flex-1 truncate ${
                                    done
                                      ? "text-muted"
                                      : "text-foreground group-hover:text-gold"
                                  }`}
                                >
                                  {lesson.title}
                                </span>
                                {lesson.duration_seconds != null && lesson.duration_seconds > 0 && (
                                  <span className="text-[9px] text-muted tabular-nums shrink-0">
                                    {formatDuration(lesson.duration_seconds)}
                                  </span>
                                )}
                              </Link>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Main: overview + next lesson CTA ─── */}
        <div className="space-y-4">
          {progress.total_lessons === 0 ? (
            <div className="card flex flex-col items-center justify-center text-center py-12">
              <div className="h-12 w-12 rounded-xl bg-muted/10 border border-muted/20 flex items-center justify-center mb-3 text-muted">
                <BookOpen size={20} />
              </div>
              <p className="text-sm font-semibold text-foreground">No lessons yet</p>
              <p className="text-[11px] text-muted mt-1 max-w-sm">
                Your agency is still putting this course together. Check back soon.
              </p>
            </div>
          ) : (
            <>
              {/* Overview card */}
              <div className="card">
                <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                  About this course
                </h2>
                {course.description ? (
                  <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {course.description}
                  </p>
                ) : (
                  <p className="text-xs text-muted italic">No description provided yet.</p>
                )}
              </div>

              {/* Next up card */}
              {firstIncomplete && (
                <Link
                  href={`/portal/${clientId}/courses/${courseId}/${firstIncomplete.id}`}
                  className="card group cursor-pointer hover:border-gold/30 transition-all flex items-center gap-4"
                >
                  <div className="h-12 w-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
                    <PlayCircle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted font-medium uppercase tracking-wider">
                      {progress.completed_lessons === 0 ? "Start here" : "Continue with"}
                    </p>
                    <p className="text-sm font-semibold text-foreground leading-snug mt-0.5 group-hover:text-gold transition-colors truncate">
                      {firstIncomplete.title}
                    </p>
                    {firstIncomplete.duration_seconds != null &&
                      firstIncomplete.duration_seconds > 0 && (
                        <p className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDuration(firstIncomplete.duration_seconds)}
                        </p>
                      )}
                  </div>
                  <ChevronRight size={16} className="text-muted shrink-0" />
                </Link>
              )}

              {/* Quick jump grid — mini lesson cards */}
              {progress.completed_lessons > 0 && progress.completed_lessons < progress.total_lessons && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Recently accessed
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(data.completion)
                      .sort(([, a], [, b]) => (b > a ? 1 : -1))
                      .slice(0, 4)
                      .map(([lessonId, completedAt]) => {
                        const lesson = flatLessons.find((l) => l.id === lessonId);
                        if (!lesson) return null;
                        return (
                          <Link
                            key={lesson.id}
                            href={`/portal/${clientId}/courses/${courseId}/${lesson.id}`}
                            className="card flex items-center gap-3 hover:border-gold/30 transition-all group p-3"
                          >
                            <CheckCircle2 size={14} className="text-success shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate group-hover:text-gold transition-colors">
                                {lesson.title}
                              </p>
                              <p className="text-[10px] text-muted mt-0.5">
                                Completed {formatRelative(completedAt)}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              )}

              {progress.completed_lessons >= progress.total_lessons && (
                <div className="card flex items-start gap-3 border-success/20 bg-success/[0.03]">
                  <div className="h-10 w-10 rounded-xl bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                    <Sparkles size={16} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      You finished the course
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Nice work. Revisit any lesson from the curriculum on the left.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

function LessonTypeIcon({ type }: { type: string | null }) {
  if (type === "video") return <PlayCircle size={11} className="text-gold/70" />;
  if (type === "text") return <FileText size={11} className="text-info/70" />;
  if (type === "file") return <Download size={11} className="text-accent/70" />;
  if (type === "quiz") return <ClipboardList size={11} className="text-warning/70" />;
  return <BookOpen size={11} className="text-muted" />;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m${s > 0 ? ` ${s}s` : ""}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h${mm > 0 ? ` ${mm}m` : ""}`;
}

function formatRelative(iso: string) {
  try {
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}
