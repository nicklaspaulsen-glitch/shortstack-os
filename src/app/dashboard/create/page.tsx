"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import {
  PenTool, Pen, Sparkles, Mail, Layers, Newspaper,
  Calendar, FolderOpen, Users, FileText, Film,
} from "lucide-react";

// Example outputs spanning the Create section's toolkit — copy, scripts,
// carousels, newsletters. Mix of tagged Unsplash covers so the marquee
// feels representative of the whole section.
const CREATE_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "ch1", src: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=640&h=360&fit=crop", alt: "Blog post", tag: "Blog" },
  { id: "ch2", src: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&h=360&fit=crop", alt: "Ad copy", tag: "Ad Copy" },
  { id: "ch3", src: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=640&h=360&fit=crop", alt: "Tutorial", tag: "Tutorial" },
  { id: "ch4", src: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=640&h=360&fit=crop", alt: "Podcast", tag: "Podcast" },
  { id: "ch5", src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=640&h=360&fit=crop", alt: "Script", tag: "Script" },
  { id: "ch6", src: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=640&h=360&fit=crop", alt: "Carousel", tag: "Carousel" },
  { id: "ch7", src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&h=360&fit=crop", alt: "Design", tag: "Design" },
  { id: "ch8", src: "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=640&h=360&fit=crop", alt: "Newsletter", tag: "Newsletter" },
  { id: "ch9", src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=640&h=360&fit=crop", alt: "Content plan", tag: "Plan" },
  { id: "ch10", src: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=640&h=360&fit=crop", alt: "Launch", tag: "Launch" },
  { id: "ch11", src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&h=360&fit=crop", alt: "Email", tag: "Email" },
  { id: "ch12", src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&h=360&fit=crop", alt: "Fitness content", tag: "Vertical" },
];

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
      preview={{
        items: CREATE_HUB_PREVIEW,
        aspectRatio: "16:9",
        opacity: 0.3,
        caption: "Copy, scripts, carousels, newsletters — one section",
      }}
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
