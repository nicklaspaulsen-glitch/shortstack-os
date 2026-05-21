"use client";

import Link from "next/link";
import { MotionPage } from "@/components/motion/motion-page";

export default function CoursesPage() {
  return (
    <MotionPage className="min-h-screen bg-bg-surface-1 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-brand-accent mb-4">
          Courses
        </p>
        <h1 className="font-display text-4xl font-bold text-text-primary mb-4 leading-tight">
          Coming Soon
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-8">
          The Courses module is being built. Create, sell, and manage online
          courses directly from your agency OS — launching shortly.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-sm font-medium hover:bg-brand-accent/20 transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </MotionPage>
  );
}
