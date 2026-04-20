"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import {
  PenTool, Pen, Sparkles, Mail, Layers, Newspaper,
  Calendar, FolderOpen, Users, FileText, Film,
} from "lucide-react";

export default function CreateHubPage() {
  useAuth();

  return (
    <SectionHub
      section="create"
      title="Create"
      eyebrow="Section · Content production"
      subtitle="Write, script, and produce content your audience actually cares about."
      heroIcon={<PenTool size={22} />}
      heroGradient="purple"
      quickActions={[
        { label: "Write Blog Post", href: "/dashboard/copywriter", icon: Pen },
        { label: "Draft Email", href: "/dashboard/email-composer", icon: Mail },
        { label: "Create Script", href: "/dashboard/script-lab", icon: Sparkles },
        { label: "Plan Content", href: "/dashboard/content-plan", icon: Calendar },
      ]}
      stats={[
        { label: "Generations (30d)", key: "generations_month", icon: Sparkles, color: "text-purple-400" },
        { label: "Scripts", key: "scripts", icon: FileText, color: "text-cyan-400" },
        { label: "Emails", key: "emails", icon: Mail, color: "text-amber-400" },
        { label: "Posts", key: "posts", icon: Film, color: "text-rose-400" },
      ]}
      tools={[
        {
          slug: "copywriter",
          label: "AI Copywriter",
          description: "Long-form blog posts, landing copy, and ads.",
          href: "/dashboard/copywriter",
          icon: Pen,
        },
        {
          slug: "script-lab",
          label: "Script Lab",
          description: "Punchy scripts for Reels, Shorts, and YouTube.",
          href: "/dashboard/script-lab",
          icon: Sparkles,
        },
        {
          slug: "email-composer",
          label: "Email Composer",
          description: "Draft high-converting outbound and nurture emails.",
          href: "/dashboard/email-composer",
          icon: Mail,
        },
        {
          slug: "carousel-generator",
          label: "Carousel Generator",
          description: "Multi-slide carousels for Instagram and LinkedIn.",
          href: "/dashboard/carousel-generator",
          icon: Layers,
        },
        {
          slug: "blog",
          label: "Blog",
          description: "Full blog post builder with SEO and publishing.",
          href: "#",
          icon: FileText,
          comingSoon: true,
        },
        {
          slug: "newsletter",
          label: "Newsletter",
          description: "Send curated newsletters to your audience.",
          href: "/dashboard/newsletter",
          icon: Newspaper,
        },
        {
          slug: "content-plan",
          label: "Content Plan",
          description: "Generate a month of content ideas in minutes.",
          href: "/dashboard/content-plan",
          icon: Calendar,
        },
        {
          slug: "content-calendar",
          label: "Content Calendar",
          description: "Schedule and track posts across channels.",
          href: "#",
          icon: Calendar,
          comingSoon: true,
        },
        {
          slug: "content-library",
          label: "Content Library",
          description: "Every asset you've created, searchable.",
          href: "/dashboard/content-library",
          icon: FolderOpen,
        },
        {
          slug: "community",
          label: "Community",
          description: "Engage with your private member community.",
          href: "/dashboard/community",
          icon: Users,
        },
      ]}
    />
  );
}
