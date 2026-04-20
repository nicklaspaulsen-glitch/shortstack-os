"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import {
  Image as ImageIcon, Film, Sparkles, PenTool,
  Palette, Video,
} from "lucide-react";

export default function VisualHubPage() {
  useAuth();

  return (
    <SectionHub
      section="visual"
      title="Visual"
      eyebrow="Section · Image & video"
      subtitle="Generate thumbnails, edit videos, and design brand assets in one place."
      heroIcon={<ImageIcon size={22} />}
      heroGradient="sunset"
      quickActions={[
        { label: "Generate Thumbnail", href: "/dashboard/thumbnail-generator", icon: ImageIcon },
        { label: "Create Ad Video", href: "/dashboard/ai-video", icon: Video },
        { label: "Run AI Studio", href: "/dashboard/ai-studio", icon: Sparkles },
        { label: "Generate Image", href: "/dashboard/ai-studio", icon: PenTool },
      ]}
      stats={[
        { label: "Thumbnails", key: "thumbnails", icon: ImageIcon, color: "text-emerald-400" },
        { label: "Videos", key: "videos", icon: Film, color: "text-blue-400" },
        { label: "Images", key: "images", icon: Sparkles, color: "text-purple-400" },
        { label: "Brand Assets", key: "brand_assets", icon: Palette, color: "text-rose-400" },
      ]}
      tools={[
        {
          slug: "thumbnail-generator",
          label: "Thumbnail Generator",
          description: "CTR-optimized YouTube/Shorts thumbnails in seconds.",
          href: "/dashboard/thumbnail-generator",
          icon: ImageIcon,
        },
        {
          slug: "video-editor",
          label: "Video Editor",
          description: "Trim, caption, and export vertical + horizontal edits.",
          href: "/dashboard/video-editor",
          icon: Film,
        },
        {
          slug: "ai-video",
          label: "AI Video",
          description: "Generate full ads and shorts from a script or prompt.",
          href: "/dashboard/ai-video",
          icon: Video,
        },
        {
          slug: "ai-studio",
          label: "AI Studio",
          description: "Image generation, upscale, remove BG, transcribe.",
          href: "/dashboard/ai-studio",
          icon: Sparkles,
        },
        {
          slug: "design",
          label: "Design",
          description: "Ad creatives, carousels, and social graphics.",
          href: "/dashboard/design",
          icon: PenTool,
        },
        {
          slug: "brand-audit",
          label: "Brand Audit",
          description: "Visual audit of your brand consistency.",
          href: "#",
          icon: Palette,
          comingSoon: true,
        },
      ]}
    />
  );
}
