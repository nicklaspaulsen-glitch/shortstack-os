"use client";
import { Archive, BookOpen, CheckCircle, CircleNotch, Clock, CurrencyDollar, Eye, EyeSlash, MagnifyingGlass, Plus, Users } from "@phosphor-icons/react";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

type CourseStatus = "draft" | "published" | "archived";

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: CourseStatus;
  price: number;
  is_free: boolean;
  access_type: string;
  student_count: number;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<CourseStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: "Draft",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    icon: <Clock size={11} />,
  },
  published: {
    label: "Published",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    icon: <CheckCircle size={11} />,
  },
  archived: {
    label: "Archived",
    color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    icon: <Archive size={11} />,
  },
};

type FilterTab = "all" | CourseStatus;

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/api/courses?${params}`);
      const json = await res.json() as { courses?: Course[] };
      setCourses(json.courses ?? []);
    } catch {
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const filtered = courses.filter((c) =>
    search ? c.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled Course", status: "draft" }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const json = await res.json() as { course: { id: string } };
      router.push(`/dashboard/courses/${json.course.id}`);
    } catch {
      toast.error("Failed to create course");
      setCreating(false);
    }
  }

  const TABS: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "published", label: "Published" },
    { id: "draft", label: "Drafts" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <MotionPage className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Course Creator</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Courses</h1>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="btn-pill flex items-center gap-2"
        >
          {creating ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={15} />}
          New Course
        </button>
      </div>

      {/* Tabs + MagnifyingGlass */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === tab.id
                  ? "bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.25)]"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="glass rounded-lg pl-9 pr-4 py-2 text-sm placeholder-text-text-muted outline-none focus:border-brand-accent w-56"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-white/4 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.15)] rounded-xl flex items-center justify-center">
            <BookOpen size={28} className="text-brand-accent" />
          </div>
          <div className="text-center">
            <p className="text-text-primary font-semibold text-lg">No courses yet</p>
            <p className="text-text-muted text-sm mt-1">Create your first course to educate and onboard clients.</p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-accent hover:bg-[#E8FF4D] text-[#020711] text-sm font-semibold transition-colors"
          >
            {creating ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={15} />}
            Create Course
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course, index) => {
            const sc = STATUS_CONFIG[course.status];
            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: index * 0.06 }}
                whileHover={{ y: -4, scale: 1.01 }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
                className="group relative glass rounded-xl p-5 cursor-pointer spotlight-card"
                onClick={() => router.push(`/dashboard/courses/${course.id}`)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-text-primary font-semibold text-base truncate">{course.title}</h3>
                    {course.description && (
                      <p className="text-text-muted text-xs mt-0.5 line-clamp-1">{course.description}</p>
                    )}
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sc.color} shrink-0`}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className="text-text-primary font-bold text-lg leading-none flex items-center justify-center gap-1">
                      <Users size={12} className="text-text-muted" />
                      {course.student_count}
                    </div>
                    <div className="text-text-muted text-[10px] mt-0.5">Students</div>
                  </div>
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className="text-text-primary font-bold text-lg leading-none flex items-center justify-center gap-1">
                      {course.is_free
                        ? <span className="text-emerald-400 text-sm font-bold">Free</span>
                        : (
                          <>
                            <CurrencyDollar size={12} className="text-text-muted" />
                            {course.price}
                          </>
                        )}
                    </div>
                    <div className="text-text-muted text-[10px] mt-0.5">Price</div>
                  </div>
                  <div className="bg-white/4 rounded-lg p-2 text-center">
                    <div className="text-text-muted text-sm leading-none flex items-center justify-center mt-0.5">
                      {course.access_type === "lifetime" ? (
                        <Eye size={13} />
                      ) : course.access_type === "drip" ? (
                        <Clock size={13} />
                      ) : (
                        <EyeSlash size={13} />
                      )}
                    </div>
                    <div className="text-text-muted text-[10px] mt-0.5 capitalize">{course.access_type}</div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-text-muted text-xs">
                    {new Date(course.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-[11px] text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Open editor →
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Summary strip */}
      {courses.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {[
            { label: "Total Courses", value: courses.length },
            { label: "Published", value: courses.filter((c) => c.status === "published").length },
            { label: "Total Students", value: courses.reduce((a, c) => a + c.student_count, 0).toLocaleString() },
            {
              label: "Avg Price",
              value: courses.filter((c) => !c.is_free).length
                ? `$${Math.round(courses.filter((c) => !c.is_free).reduce((a, c) => a + c.price, 0) / courses.filter((c) => !c.is_free).length)}`
                : "—",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 + i * 0.04, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-2xl p-5"
            >
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">{stat.label}</p>
              <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">{stat.value}</p>
            </motion.div>
          ))}
        </div>
      )}
    </MotionPage>
  );
}
