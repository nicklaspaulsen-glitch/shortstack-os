"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  PlayCircle,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  Lock,
  Sparkles,
} from "lucide-react";

type PortalCourse = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: string | null;
  price: number | null;
  is_free: boolean | null;
  access_type: string | null;
  module_count: number;
  lesson_count: number;
  completed_count: number;
  progress_percent: number;
  is_enrolled: boolean;
  enrolled_at: string | null;
  last_accessed_at: string | null;
  expires_at: string | null;
};

type Filter = "all" | "enrolled" | "in_progress" | "completed";

export default function PortalCoursesPage({
  params,
}: {
  params: { clientId: string };
}) {
  const { clientId } = params;
  const [courses, setCourses] = useState<PortalCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/portal/${clientId}/courses`, { cache: "no-store" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(json.error || `Error ${res.status}`);
      }
      const json = await res.json();
      setCourses(json.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = courses.filter((c) => {
    if (filter === "enrolled") return c.is_enrolled;
    if (filter === "in_progress") return c.is_enrolled && c.progress_percent > 0 && c.progress_percent < 100;
    if (filter === "completed") return c.is_enrolled && c.progress_percent >= 100;
    return true;
  });

  const enrolledCount = courses.filter((c) => c.is_enrolled).length;
  const completedCount = courses.filter((c) => c.is_enrolled && c.progress_percent >= 100).length;
  const totalHours = Math.round(
    courses.reduce((sum, c) => sum + c.lesson_count * 10, 0) / 60,
  ); // rough 10min/lesson estimate

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen size={22} className="text-gold" /> Courses
          </h1>
          <p className="text-sm text-muted mt-1">
            Continue learning — your progress is saved automatically.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "enrolled", "in_progress", "completed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === f
                  ? "bg-gold/15 text-gold border-gold/30"
                  : "bg-surface border-border text-muted hover:text-foreground"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "enrolled"
                ? "Enrolled"
                : f === "in_progress"
                ? "In Progress"
                : "Completed"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-3 gap-3 fade-in stagger-1">
          <SummaryCard
            icon={<BookOpen size={16} />}
            label="Enrolled"
            value={enrolledCount}
            color="gold"
          />
          <SummaryCard
            icon={<CheckCircle size={16} />}
            label="Completed"
            value={completedCount}
            color="success"
          />
          <SummaryCard
            icon={<Clock size={16} />}
            label="Approx Hours"
            value={totalHours}
            color="info"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card flex items-center gap-3 text-muted text-xs">
          <Loader2 size={14} className="animate-spin" /> Loading courses…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card flex items-start gap-3 border-danger/20 bg-danger/[0.03]">
          <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Couldn&apos;t load courses</p>
            <p className="text-[11px] text-muted mt-0.5">{error}</p>
          </div>
          <button
            onClick={load}
            className="text-[11px] text-gold hover:text-gold/80 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="card flex flex-col items-center justify-center text-center py-12">
          <div className="h-12 w-12 rounded-xl bg-muted/10 border border-muted/20 flex items-center justify-center mb-3 text-muted">
            <BookOpen size={20} />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {filter === "all" ? "No courses available yet" : "No courses in this view"}
          </p>
          <p className="text-[11px] text-muted mt-1 max-w-sm">
            {filter === "all"
              ? "Your agency hasn't published any courses for you yet. They'll appear here once they do."
              : "Try the All tab to see everything available."}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 fade-in stagger-2">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} clientId={clientId} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Components
   ══════════════════════════════════════════════════════════════════ */

function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "gold" | "success" | "info";
}) {
  const colorMap: Record<string, string> = {
    gold: "bg-gold/10 text-gold border-gold/20",
    success: "bg-success/10 text-success border-success/20",
    info: "bg-info/10 text-info border-info/20",
  };
  return (
    <div className="card flex items-center gap-3">
      <div className={`p-2 rounded-xl border shrink-0 ${colorMap[color]}`}>{icon}</div>
      <div>
        <p className="text-xl font-bold text-foreground tracking-tight tabular-nums">{value}</p>
        <p className="text-[10px] text-muted font-medium uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function CourseCard({
  course,
  clientId,
}: {
  course: PortalCourse;
  clientId: string;
}) {
  const href = `/portal/${clientId}/courses/${course.id}`;
  const canAccess = course.is_enrolled || course.status === "published";
  const isCompleted = course.is_enrolled && course.progress_percent >= 100;
  const isInProgress = course.is_enrolled && course.progress_percent > 0 && course.progress_percent < 100;

  return (
    <Link
      href={href}
      className={`card group cursor-pointer hover:border-gold/30 transition-all overflow-hidden p-0 flex flex-col ${
        !canAccess ? "opacity-70" : ""
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-light overflow-hidden">
        {course.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/10 via-surface-light to-accent/10">
            <BookOpen size={32} className="text-gold/40" />
          </div>
        )}
        {/* Status chips */}
        <div className="absolute top-2 right-2 flex gap-1.5">
          {isCompleted && (
            <span className="inline-flex items-center gap-1 bg-success/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <CheckCircle size={10} /> Completed
            </span>
          )}
          {isInProgress && (
            <span className="inline-flex items-center gap-1 bg-gold/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <PlayCircle size={10} /> In Progress
            </span>
          )}
          {!course.is_enrolled && course.status === "published" && (
            <span className="inline-flex items-center gap-1 bg-info/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Sparkles size={10} /> New
            </span>
          )}
          {!canAccess && (
            <span className="inline-flex items-center gap-1 bg-muted/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Lock size={10} /> Locked
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-sm font-semibold text-foreground leading-snug group-hover:text-gold transition-colors line-clamp-2">
          {course.title}
        </p>
        {course.description && (
          <p className="text-[11px] text-muted mt-1.5 line-clamp-2">{course.description}</p>
        )}

        <div className="flex items-center gap-3 text-[10px] text-muted mt-3">
          <span className="flex items-center gap-1">
            <BookOpen size={10} /> {course.module_count} module{course.module_count === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle size={10} /> {course.lesson_count} lesson
            {course.lesson_count === 1 ? "" : "s"}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-auto pt-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-muted">
              {course.completed_count} / {course.lesson_count} complete
            </span>
            <span className="text-foreground font-medium tabular-nums">
              {course.progress_percent}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                course.progress_percent >= 100
                  ? "bg-success"
                  : course.progress_percent >= 50
                  ? "bg-gold"
                  : "bg-info"
              }`}
              style={{ width: `${Math.max(course.progress_percent, 2)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
