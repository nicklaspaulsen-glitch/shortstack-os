"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, Plus, Users, DollarSign, Eye, EyeOff, Trash2, Pencil, Lock } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import Link from "next/link";

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_free: boolean;
  status: "draft" | "published" | "archived";
  access_type: string;
  student_count: number;
  created_at: string;
}

type Filter = "all" | "published" | "draft";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsFree, setNewIsFree] = useState(true);
  const [newPrice, setNewPrice] = useState("");

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/courses${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json() as { courses: Course[] };
      setCourses(json.courses ?? []);
    } catch {
      toast.error("Failed to load courses");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void fetchCourses(); }, [fetchCourses]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return toast.error("Title required");
    setCreating(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          is_free: newIsFree,
          price: newIsFree ? 0 : parseFloat(newPrice) || 0,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const json = await res.json() as { course: Course };
      toast.success("Course created");
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewIsFree(true);
      setNewPrice("");
      setCourses(prev => [{ ...json.course, student_count: 0 }, ...prev]);
    } catch {
      toast.error("Failed to create course");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      setCourses(prev => prev.filter(c => c.id !== id));
      toast.success("Course deleted");
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleTogglePublish = async (course: Course) => {
    const newStatus = course.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: newStatus } : c));
      toast.success(newStatus === "published" ? "Course published" : "Course unpublished");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const filtered = courses.filter(c => filter === "all" || c.status === filter);

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <PageHero
        title="Courses"
        subtitle="Build and sell membership courses. Your students access them at their portal."
        icon={<BookOpen size={28} />}
        gradient="purple"
        actions={
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Course
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "published", "draft"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Course grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white/5 rounded-xl h-52 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-white/40">
            <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No courses yet</p>
            <p className="text-sm mt-1">Click &ldquo;New Course&rdquo; to create your first one</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                onDelete={handleDelete}
                onTogglePublish={handleTogglePublish}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">New Course</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Title *</label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. 12-Week Fitness Program"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsFree}
                    onChange={e => setNewIsFree(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span className="text-sm text-white/80">Free course</span>
                </label>
                {!newIsFree && (
                  <div className="flex items-center gap-1 ml-auto">
                    <span className="text-white/40 text-sm">$</span>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {creating ? "Creating…" : "Create Course"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseCard({
  course,
  onDelete,
  onTogglePublish,
}: {
  course: Course;
  onDelete: (id: string) => void;
  onTogglePublish: (c: Course) => void;
}) {
  return (
    <div className="group bg-white/5 hover:bg-white/8 border border-white/10 rounded-xl overflow-hidden transition-all">
      {/* Thumbnail */}
      <div className="relative h-36 bg-gradient-to-br from-purple-900/40 to-indigo-900/40 flex items-center justify-center">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <BookOpen size={36} className="text-purple-400/40" />
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${
            course.status === "published"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/10 text-white/50 border border-white/20"
          }`}
        >
          {course.status}
        </span>
        {/* Price badge */}
        <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/40 text-white/80 border border-white/10">
          {course.is_free ? "Free" : `$${Number(course.price).toFixed(2)}`}
        </span>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-white text-sm line-clamp-1 mb-1">{course.title}</h3>
        {course.description && (
          <p className="text-xs text-white/40 line-clamp-2 mb-2">{course.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span className="flex items-center gap-1">
            <Users size={11} />
            {course.student_count}
          </span>
          {!course.is_free && (
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              {Number(course.price).toFixed(2)}
            </span>
          )}
          {course.access_type === "drip" && (
            <span className="flex items-center gap-1">
              <Lock size={11} />
              Drip
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 mt-3 pt-3 border-t border-white/5">
          <Link
            href={`/dashboard/courses/${course.id}`}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs transition-colors"
          >
            <Pencil size={12} />
            Edit
          </Link>
          <button
            onClick={() => onTogglePublish(course)}
            className="flex items-center gap-1 px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-xs transition-colors"
            title={course.status === "published" ? "Unpublish" : "Publish"}
          >
            {course.status === "published" ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={() => onDelete(course.id)}
            className="flex items-center gap-1 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
