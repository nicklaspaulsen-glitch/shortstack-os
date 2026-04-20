"use client";

import { useAuth } from "@/lib/auth-context";
import SectionHub from "@/components/dashboard/section-hub";
import type { RollingPreviewItem } from "@/components/RollingPreview";
import {
  Image as ImageIcon, Film, Sparkles, PenTool,
  Palette, Video,
} from "lucide-react";

// Example outputs spanning the Visual section — thumbnails, ads, AI
// images, design. Wide (16:9) so the marquee reads as "creative".
const VISUAL_HUB_PREVIEW: RollingPreviewItem[] = [
  { id: "vh1", src: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=640&h=360&fit=crop", alt: "YouTube thumbnail", tag: "Thumbnail" },
  { id: "vh2", src: "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=640&h=360&fit=crop", alt: "Product shot", tag: "Product" },
  { id: "vh3", src: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640&h=360&fit=crop", alt: "Cinematic", tag: "Cinematic" },
  { id: "vh4", src: "https://images.unsplash.com/photo-1520390138845-fd2d229dd553?w=640&h=360&fit=crop", alt: "Automotive ad", tag: "Ad" },
  { id: "vh5", src: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=640&h=360&fit=crop", alt: "Design poster", tag: "Poster" },
  { id: "vh6", src: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=640&h=360&fit=crop", alt: "Neon", tag: "AI Gen" },
  { id: "vh7", src: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=640&h=360&fit=crop", alt: "Tutorial thumbnail", tag: "Creator" },
  { id: "vh8", src: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=640&h=360&fit=crop", alt: "Sunset", tag: "Dreamy" },
  { id: "vh9", src: "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=640&h=360&fit=crop", alt: "Drone", tag: "Drone" },
  { id: "vh10", src: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=640&h=360&fit=crop", alt: "Epic landscape", tag: "Epic" },
  { id: "vh11", src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=640&h=360&fit=crop", alt: "Beauty", tag: "Beauty" },
  { id: "vh12", src: "https://images.unsplash.com/photo-1542744095-291d1f67b221?w=640&h=360&fit=crop", alt: "Pitch deck", tag: "Deck" },
];

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
      preview={{
        items: VISUAL_HUB_PREVIEW,
        aspectRatio: "16:9",
        opacity: 0.3,
        caption: "Thumbnails, ads, AI images, design — all visual",
      }}
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
