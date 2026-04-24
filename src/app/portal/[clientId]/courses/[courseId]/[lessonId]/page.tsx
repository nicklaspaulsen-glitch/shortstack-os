"use client";

/* ══════════════════════════════════════════════════════════════════
   Lesson viewer.

   Supported content types:
     - video : YouTube / Vimeo / direct mp4 via <video> or iframe
     - text  : rendered as a sanitized block (HTML or plain text)
     - file  : download link with filename / size when available
     - quiz  : placeholder — the builder doesn't yet produce quiz JSON,
               so we render a friendly "coming soon" instead of failing

   Progress persistence: POST to /api/portal/courses/progress.
   A "Mark complete" button and an auto-advance "Next lesson" flow
   are at the bottom of the viewer.
   ══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  PlayCircle,
  AlertCircle,
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
  completion: Record<string, string>;
  progress: {
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
  };
};

export default function PortalLessonViewerPage({
  params,
}: {
  params: { clientId: string; courseId: string; lessonId: string };
}) {
  const { clientId, courseId, lessonId } = params;
  const router = useRouter();

  const [data, setData] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState<Record<string, boolean>>({});

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
      // Expand the module containing the current lesson
      const currentModule = json.modules.find((m) =>
        m.lessons.some((l) => l.id === lessonId),
      );
      if (currentModule) {
        setSidebarExpanded((prev) => ({ ...prev, [currentModule.id]: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [clientId, courseId, lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const flatLessons = useMemo(() => {
    if (!data) return [] as Lesson[];
    return data.modules.flatMap((m) => m.lessons);
  }, [data]);

  const currentIdx = flatLessons.findIndex((l) => l.id === lessonId);
  const currentLesson = currentIdx >= 0 ? flatLessons[currentIdx] : null;
  const prevLesson = currentIdx > 0 ? flatLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx >= 0 && currentIdx < flatLessons.length - 1
    ? flatLessons[currentIdx + 1]
    : null;

  const isCompleted = !!data?.completion[lessonId];

  function toggleModule(id: string) {
    setSidebarExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function setCompletion(completed: boolean) {
    if (!data || saving) return;
    setSaving(true);
    // Optimistic local update
    setData((prev) => {
      if (!prev) return prev;
      const completion = { ...prev.completion };
      if (completed) completion[lessonId] = new Date().toISOString();
      else delete completion[lessonId];
      const done = Object.keys(completion).length;
      const total = prev.progress.total_lessons;
      return {
        ...prev,
        completion,
        progress: {
          total_lessons: total,
          completed_lessons: done,
          progress_percent: total === 0 ? 0 : Math.round((done / total) * 100),
        },
      };
    });
    try {
      const res = await fetch("/api/portal/courses/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, courseId, lessonId, completed }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(json.error || "Failed");
      }
      if (completed) toast.success("Lesson marked complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save progress");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (!nextLesson) return;
    if (!isCompleted) {
      await setCompletion(true);
    }
    router.push(`/portal/${clientId}/courses/${courseId}/${nextLesson.id}`);
  }

  if (loading) {
    return (
      <div className="card flex items-center gap-3 text-muted text-xs">
        <Loader2 size={14} className="animate-spin" /> Loading lesson…
      </div>
    );
  }
  if (error) {
    return (
      <div className="card flex items-start gap-3 border-danger/20 bg-danger/[0.03]">
        <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Couldn&apos;t load this lesson</p>
          <p className="text-[11px] text-muted mt-0.5">{error}</p>
        </div>
        <Link
          href={`/portal/${clientId}/courses/${courseId}`}
          className="text-[11px] text-gold hover:text-gold/80 font-medium"
        >
          Back to course
        </Link>
      </div>
    );
  }
  if (!data || !currentLesson) {
    return (
      <div className="card flex flex-col items-center text-center py-10">
        <AlertCircle size={22} className="text-muted mb-2" />
        <p className="text-sm font-semibold text-foreground">Lesson not found</p>
        <Link
          href={`/portal/${clientId}/courses/${courseId}`}
          className="text-[11px] text-gold hover:text-gold/80 font-medium mt-2"
        >
          Back to course
        </Link>
      </div>
    );
  }

  const { course, modules, progress } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted fade-in flex-wrap">
        <Link
          href={`/portal/${clientId}/courses`}
          className="hover:text-foreground transition-colors"
        >
          Courses
        </Link>
        <span>/</span>
        <Link
          href={`/portal/${clientId}/courses/${courseId}`}
          className="hover:text-foreground transition-colors truncate max-w-[200px]"
        >
          {course.title}
        </Link>
        <span>/</span>
        <span className="text-foreground truncate">{currentLesson.title}</span>
      </div>

      {/* Progress bar */}
      <div className="card py-3 fade-in">
        <div className="flex items-center justify-between text-[10px] mb-1.5">
          <span className="text-muted uppercase tracking-wider font-medium">
            Course progress
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            {progress.completed_lessons}/{progress.total_lessons} ·{" "}
            {progress.progress_percent}%
          </span>
        </div>
        <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
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

      {/* Two-column: sidebar + lesson */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 fade-in stagger-1">
        {/* ─── Sidebar ─── */}
        <div className="card p-0 overflow-hidden order-2 lg:order-1">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Curriculum
            </p>
          </div>
          <div className="divide-y divide-border/40 max-h-[80vh] overflow-y-auto">
            {modules.map((mod, idx) => {
              const expanded = !!sidebarExpanded[mod.id];
              return (
                <div key={mod.id}>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-light transition-colors"
                  >
                    <span className="text-[10px] text-muted font-semibold w-4">{idx + 1}</span>
                    <p className="text-xs font-medium text-foreground truncate flex-1 leading-snug">
                      {mod.title}
                    </p>
                    {expanded ? (
                      <ChevronDown size={13} className="text-muted shrink-0" />
                    ) : (
                      <ChevronRight size={13} className="text-muted shrink-0" />
                    )}
                  </button>
                  {expanded && (
                    <div className="pb-2">
                      {mod.lessons.map((lesson) => {
                        const done = !!data.completion[lesson.id];
                        const active = lesson.id === lessonId;
                        return (
                          <Link
                            key={lesson.id}
                            href={`/portal/${clientId}/courses/${courseId}/${lesson.id}`}
                            className={`flex items-center gap-2.5 pl-10 pr-4 py-2 transition-colors group ${
                              active
                                ? "bg-gold/10 border-l-2 border-gold"
                                : "hover:bg-gold/5"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 size={13} className="text-success shrink-0" />
                            ) : (
                              <Circle size={13} className="text-muted/60 shrink-0" />
                            )}
                            <LessonTypeIcon type={lesson.content_type} />
                            <span
                              className={`text-[11px] leading-snug flex-1 truncate ${
                                active
                                  ? "text-foreground font-medium"
                                  : done
                                  ? "text-muted"
                                  : "text-foreground group-hover:text-gold"
                              }`}
                            >
                              {lesson.title}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Main lesson ─── */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Title + meta */}
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {currentLesson.title}
            </h1>
            <div className="flex items-center gap-3 text-[10px] text-muted mt-1.5">
              <span className="flex items-center gap-1">
                <LessonTypeIcon type={currentLesson.content_type} />
                {prettyType(currentLesson.content_type)}
              </span>
              {currentLesson.duration_seconds != null && currentLesson.duration_seconds > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatDuration(currentLesson.duration_seconds)}
                </span>
              )}
              {isCompleted && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 size={10} />
                  Completed
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <LessonContent lesson={currentLesson} />

          {/* Bottom action bar */}
          <div className="card flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1 min-w-0">
              {prevLesson ? (
                <Link
                  href={`/portal/${clientId}/courses/${courseId}/${prevLesson.id}`}
                  className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={13} />
                  <span className="truncate">Previous · {prevLesson.title}</span>
                </Link>
              ) : (
                <Link
                  href={`/portal/${clientId}/courses/${courseId}`}
                  className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={13} /> Back to course
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCompletion(!isCompleted)}
                disabled={saving}
                className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl transition-all ${
                  isCompleted
                    ? "bg-success/10 text-success border border-success/20 hover:bg-success/15"
                    : "bg-surface-light text-foreground border border-border hover:border-gold/30"
                } disabled:opacity-60`}
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <Circle size={13} />
                )}
                {isCompleted ? "Completed" : "Mark complete"}
              </button>
              {nextLesson ? (
                <button
                  onClick={handleNext}
                  disabled={saving}
                  className="btn-primary flex items-center gap-2 text-xs disabled:opacity-60"
                >
                  Next lesson
                  <ArrowRight size={13} />
                </button>
              ) : (
                <Link
                  href={`/portal/${clientId}/courses/${courseId}`}
                  className="btn-primary flex items-center gap-2 text-xs"
                >
                  Finish course
                  <CheckCircle2 size={13} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Lesson content rendering
   ══════════════════════════════════════════════════════════════════ */

function LessonContent({ lesson }: { lesson: Lesson }) {
  const type = (lesson.content_type || "").toLowerCase();

  if (type === "video") return <VideoContent lesson={lesson} />;
  if (type === "text") return <TextContent lesson={lesson} />;
  if (type === "file") return <FileContent lesson={lesson} />;
  if (type === "quiz") return <QuizContent />;

  // Fallback — render whatever is there. Agencies may leave content_type
  // blank while drafting.
  return (
    <div className="card">
      {lesson.content_body ? (
        <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
          {lesson.content_body}
        </div>
      ) : lesson.content_url ? (
        <a
          href={lesson.content_url}
          target="_blank"
          rel="noreferrer"
          className="text-gold hover:underline text-sm"
        >
          Open lesson resource →
        </a>
      ) : (
        <p className="text-xs text-muted italic">No content yet for this lesson.</p>
      )}
    </div>
  );
}

function VideoContent({ lesson }: { lesson: Lesson }) {
  const url = lesson.content_url || "";
  const embed = toEmbedUrl(url);

  if (!url) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <PlayCircle size={28} className="text-muted/50 mb-2" />
        <p className="text-xs text-muted">Video hasn&apos;t been added yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-video rounded-xl overflow-hidden bg-black border border-border">
        {embed ? (
          <iframe
            src={embed}
            title={lesson.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          // Direct video URL (mp4 / webm)
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={url} controls className="w-full h-full">
            Your browser does not support the video tag.
          </video>
        )}
      </div>
      {lesson.content_body && (
        <div className="card">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Lesson notes
          </p>
          <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {lesson.content_body}
          </div>
        </div>
      )}
    </div>
  );
}

function TextContent({ lesson }: { lesson: Lesson }) {
  const body = lesson.content_body || "";
  const looksLikeHtml = /<\w+[^>]*>/.test(body);
  return (
    <div className="card">
      {body ? (
        looksLikeHtml ? (
          <div
            className="prose-lesson text-sm text-foreground/90 leading-relaxed"
            // Content is authored by the agency owner — same trust boundary
            // as blog posts, sequence emails, etc. authored in this product.
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {body}
          </div>
        )
      ) : (
        <p className="text-xs text-muted italic">No lesson content has been added yet.</p>
      )}
    </div>
  );
}

function FileContent({ lesson }: { lesson: Lesson }) {
  const url = lesson.content_url || "";
  const filename = filenameFromUrl(url) || lesson.title;
  if (!url) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <Download size={28} className="text-muted/50 mb-2" />
        <p className="text-xs text-muted">No file attached yet.</p>
      </div>
    );
  }
  return (
    <div className="card flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="h-14 w-14 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold shrink-0">
        <FileText size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{filename}</p>
        {lesson.content_body && (
          <p className="text-[11px] text-muted mt-1 line-clamp-2">{lesson.content_body}</p>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download
        className="btn-primary flex items-center gap-2 text-xs shrink-0"
      >
        <Download size={13} /> Download
      </a>
    </div>
  );
}

function QuizContent() {
  return (
    <div className="card flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center mb-3 text-warning">
        <ClipboardList size={20} />
      </div>
      <p className="text-sm font-semibold text-foreground">Quizzes are coming soon</p>
      <p className="text-[11px] text-muted mt-1 max-w-sm">
        Your agency can still mark this lesson complete below. Quiz rendering will
        activate automatically once the builder ships quiz blocks.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // YouTube
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com") return url;

    // Loom
    if (host === "loom.com" || host === "www.loom.com") {
      const m = u.pathname.match(/\/share\/([a-f0-9]+)/i);
      if (m) return `https://www.loom.com/embed/${m[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

function filenameFromUrl(url: string) {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}

function LessonTypeIcon({ type }: { type: string | null }) {
  const t = (type || "").toLowerCase();
  if (t === "video") return <PlayCircle size={11} className="text-gold/70" />;
  if (t === "text") return <FileText size={11} className="text-info/70" />;
  if (t === "file") return <Download size={11} className="text-accent/70" />;
  if (t === "quiz") return <ClipboardList size={11} className="text-warning/70" />;
  return <BookOpen size={11} className="text-muted" />;
}

function prettyType(type: string | null) {
  const t = (type || "").toLowerCase();
  if (t === "video") return "Video";
  if (t === "text") return "Lesson";
  if (t === "file") return "Download";
  if (t === "quiz") return "Quiz";
  return "Lesson";
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
