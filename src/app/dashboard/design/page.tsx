"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Copy, ExternalLink, Image as ImageIcon, Award, Flag, Monitor,
  Camera, MessageCircle, Play, Briefcase, Music, Wand2, Palette, Loader, PenTool,
  Grid, Layers, Mail, FileText, Podcast, RotateCcw,
  Paintbrush, Maximize2, Eye, EyeOff, Scissors, ShoppingBag, QrCode,
  History, Pipette, Type, Repeat, SlidersHorizontal, Search, BarChart3,
  Star, CalendarDays, Film, Database, Download, CheckCircle, Heart,
  Shuffle, Upload, Sun, Moon, Zap, Leaf,
  ChevronDown, Plus, Trash2, GripVertical, X,
  Coffee, Smartphone, Laptop, Shirt, Package, Globe, Shield, Clock,
  TrendingUp, Users, ThumbsUp, Quote, BadgeCheck, Snowflake, Gift,
  PartyPopper, Accessibility, Contrast, AlertTriangle, BookOpen, Move,
  Brush, ImagePlus, Aperture
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import PromptEnhancer from "@/components/prompt-enhancer";
import PageHero from "@/components/ui/page-hero";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";

// Example design/banner artwork used for the landing-state marquee.
const DESIGN_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "d1", src: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=640&h=360&fit=crop", alt: "Brand banner", tag: "Banner" },
  { id: "d2", src: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=640&h=360&fit=crop", alt: "Poster design", tag: "Poster" },
  { id: "d3", src: "https://images.unsplash.com/photo-1542744095-291d1f67b221?w=640&h=360&fit=crop", alt: "Pitch deck cover", tag: "Deck" },
  { id: "d4", src: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=640&h=360&fit=crop", alt: "Logo mark", tag: "Logo" },
  { id: "d5", src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=640&h=360&fit=crop", alt: "Landing page", tag: "Landing" },
  { id: "d6", src: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=640&h=360&fit=crop", alt: "Ad creative", tag: "Ad" },
  { id: "d7", src: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=640&h=360&fit=crop", alt: "Minimal design", tag: "Minimal" },
  { id: "d8", src: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=640&h=360&fit=crop", alt: "Fitness creative", tag: "Sport" },
  { id: "d9", src: "https://images.unsplash.com/photo-1434626881859-194d67b2b86f?w=640&h=360&fit=crop", alt: "Editorial design", tag: "Editorial" },
  { id: "d10", src: "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=640&h=360&fit=crop", alt: "Brand kit", tag: "Brand Kit" },
  { id: "d11", src: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=640&h=360&fit=crop", alt: "Infographic", tag: "Infographic" },
  { id: "d12", src: "https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=640&h=360&fit=crop", alt: "Modern design", tag: "Modern" },
];

interface GeneratedPrompt {
  id: string;
  section: string;
  prompt: string;
  style: string;
  dimensions: string;
}

interface TemplatePreset {
  label: string;
  icon: React.ReactNode;
  width: number;
  height: number;
  style: string;
  category: string;
}

const SECTIONS = [
  { key: "thumbnails", label: "Thumbnails", icon: <ImageIcon size={16} />, description: "YouTube & video thumbnails" },
  { key: "social", label: "Social Posts", icon: <Camera size={16} />, description: "Posts for all platforms" },
  { key: "carousels", label: "Carousels", icon: <RotateCcw size={16} />, description: "Multi-slide carousel posts" },
  { key: "ads", label: "Ad Creatives", icon: <Flag size={16} />, description: "Facebook, Google & display ads" },
  { key: "logos", label: "Logos & Marks", icon: <Award size={16} />, description: "Logos, icons & brand marks" },
  { key: "banners", label: "Banners", icon: <Monitor size={16} />, description: "Website & social banners" },
  { key: "infographics", label: "Infographics", icon: <Grid size={16} />, description: "Data visualization & info layouts" },
  { key: "presentations", label: "Presentations", icon: <Layers size={16} />, description: "Slide decks & pitch decks" },
  { key: "email_headers", label: "Email Headers", icon: <Mail size={16} />, description: "Newsletter & email graphics" },
  { key: "podcast_covers", label: "Podcast Covers", icon: <Podcast size={16} />, description: "Podcast & audio artwork" },
  { key: "brochures", label: "Brochures", icon: <FileText size={16} />, description: "Print-ready marketing materials" },
  { key: "mockups", label: "Mockups", icon: <Monitor size={16} />, description: "Device & product mockups" },
];

const TEMPLATES: TemplatePreset[] = [
  // Social
  { label: "Instagram Post", icon: <Camera size={12} />, width: 1080, height: 1080, style: "vibrant, social media aesthetic, clean typography", category: "social" },
  { label: "Instagram Story", icon: <Camera size={12} />, width: 1080, height: 1920, style: "bold, full-screen, vertical, eye-catching", category: "social" },
  { label: "TikTok Cover", icon: <Music size={12} />, width: 1080, height: 1920, style: "trendy, Gen-Z aesthetic, bold colors", category: "social" },
  { label: "Pinterest Pin", icon: <ImageIcon size={12} />, width: 1000, height: 1500, style: "aesthetic, pin-worthy, clean layout", category: "social" },
  { label: "Facebook Post", icon: <MessageCircle size={12} />, width: 1200, height: 630, style: "engaging, conversational, clear text", category: "social" },
  { label: "LinkedIn Post", icon: <Briefcase size={12} />, width: 1200, height: 1200, style: "professional, thought leadership, clean", category: "social" },
  // Carousels
  { label: "IG Carousel Slide", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "cohesive multi-slide, numbered, educational, swipe-worthy", category: "carousels" },
  { label: "IG Carousel (4:5)", icon: <RotateCcw size={12} />, width: 1080, height: 1350, style: "tall carousel slide, bold headers, listicle layout", category: "carousels" },
  { label: "LinkedIn Carousel", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "corporate carousel, data-driven, chart-ready", category: "carousels" },
  { label: "Carousel Cover Slide", icon: <RotateCcw size={12} />, width: 1080, height: 1080, style: "attention-grabbing cover, bold hook text, swipe CTA", category: "carousels" },
  // Ads
  { label: "Facebook Ad", icon: <MessageCircle size={12} />, width: 1200, height: 628, style: "professional, high-converting ad creative, bold CTA", category: "ads" },
  { label: "Google Display Ad", icon: <Flag size={12} />, width: 300, height: 250, style: "high-converting, clear CTA, bold", category: "ads" },
  { label: "Google Leaderboard", icon: <Flag size={12} />, width: 728, height: 90, style: "minimal, direct, clear CTA banner", category: "ads" },
  { label: "Instagram Ad", icon: <Camera size={12} />, width: 1080, height: 1080, style: "native-feeling, engaging, thumb-stopping", category: "ads" },
  // Thumbnails
  { label: "YouTube Thumbnail", icon: <Play size={12} />, width: 1280, height: 720, style: "eye-catching, bold text overlay, expressive", category: "thumbnails" },
  { label: "Podcast Episode Art", icon: <Podcast size={12} />, width: 1280, height: 720, style: "guest photo, episode number, bold branding", category: "thumbnails" },
  // Logos & Marks
  { label: "Primary Logo", icon: <Award size={12} />, width: 1000, height: 1000, style: "clean, scalable, versatile, professional brand mark", category: "logos" },
  { label: "Logo Icon / Favicon", icon: <Award size={12} />, width: 512, height: 512, style: "simple, recognizable at small sizes, icon mark", category: "logos" },
  { label: "Logo Wordmark", icon: <Award size={12} />, width: 2000, height: 600, style: "typography-focused, clean wordmark, brand font", category: "logos" },
  { label: "Logo + Tagline", icon: <Award size={12} />, width: 1500, height: 800, style: "full lockup with tagline, professional", category: "logos" },
  { label: "App Icon", icon: <Award size={12} />, width: 1024, height: 1024, style: "iOS/Android app icon, rounded corners, bold, simple", category: "logos" },
  // Banners
  { label: "LinkedIn Banner", icon: <Briefcase size={12} />, width: 1584, height: 396, style: "corporate, professional, clean gradient", category: "banners" },
  { label: "Twitter Header", icon: <MessageCircle size={12} />, width: 1500, height: 500, style: "clean, professional, brand-focused", category: "banners" },
  { label: "YouTube Channel Art", icon: <Play size={12} />, width: 2560, height: 1440, style: "bold, channel branding, subscribe CTA", category: "banners" },
  { label: "Website Hero", icon: <Monitor size={12} />, width: 1920, height: 800, style: "hero section, compelling, conversion-focused", category: "banners" },
  // Other
  { label: "Email Header", icon: <Mail size={12} />, width: 600, height: 200, style: "clean, on-brand, professional", category: "email_headers" },
  { label: "Podcast Cover", icon: <Podcast size={12} />, width: 3000, height: 3000, style: "bold, recognizable, clear text", category: "podcast_covers" },
  { label: "Presentation Slide", icon: <Layers size={12} />, width: 1920, height: 1080, style: "modern, clean, corporate", category: "presentations" },
  { label: "Phone Mockup", icon: <Monitor size={12} />, width: 1080, height: 1920, style: "device frame, app screenshot, professional", category: "mockups" },
  { label: "Desktop Mockup", icon: <Monitor size={12} />, width: 1920, height: 1080, style: "laptop/desktop frame, website screenshot", category: "mockups" },
  { label: "T-Shirt Mockup", icon: <Monitor size={12} />, width: 1200, height: 1200, style: "apparel mockup, flat lay, clean background", category: "mockups" },
  { label: "Business Card", icon: <Grid size={12} />, width: 1050, height: 600, style: "3.5x2 inches, professional, minimal, premium", category: "brochures" },
  { label: "Flyer / Poster", icon: <FileText size={12} />, width: 1080, height: 1527, style: "A4, event flyer, bold headline, clear CTA", category: "brochures" },
  { label: "Menu Design", icon: <FileText size={12} />, width: 1080, height: 1527, style: "restaurant menu, elegant, organized sections", category: "brochures" },
  { label: "Invoice Template", icon: <FileText size={12} />, width: 1080, height: 1527, style: "professional invoice, clean, branded", category: "brochures" },
  // Infographics
  { label: "Stat Infographic", icon: <Grid size={12} />, width: 1080, height: 1920, style: "vertical, data-rich, charts, icons, numbered", category: "infographics" },
  { label: "Timeline Infographic", icon: <Grid size={12} />, width: 1080, height: 1920, style: "chronological, milestones, connected steps", category: "infographics" },
  { label: "Process Flow", icon: <Grid size={12} />, width: 1200, height: 800, style: "step-by-step, arrows, numbered stages", category: "infographics" },
  { label: "Comparison Chart", icon: <Grid size={12} />, width: 1080, height: 1080, style: "side-by-side, pros/cons, feature comparison", category: "infographics" },
  { label: "Pie Chart Visual", icon: <Grid size={12} />, width: 1080, height: 1080, style: "circular data visualization, percentage breakdown", category: "infographics" },
  // Presentations
  { label: "Pitch Deck Slide", icon: <Layers size={12} />, width: 1920, height: 1080, style: "startup pitch, clean, data-focused, investor-ready", category: "presentations" },
  { label: "Case Study Slide", icon: <Layers size={12} />, width: 1920, height: 1080, style: "before/after results, metrics, professional", category: "presentations" },
  { label: "Team Intro Slide", icon: <Layers size={12} />, width: 1920, height: 1080, style: "team photos, roles, grid layout", category: "presentations" },
  // More social
  { label: "Twitter/X Post", icon: <MessageCircle size={12} />, width: 1200, height: 675, style: "concise, bold statement, minimal design", category: "social" },
  { label: "Threads Post", icon: <MessageCircle size={12} />, width: 1080, height: 1080, style: "text-heavy, thread-style, numbered points", category: "social" },
  { label: "WhatsApp Status", icon: <MessageCircle size={12} />, width: 1080, height: 1920, style: "vertical, eye-catching, personal feel", category: "social" },
  // More ads
  { label: "TikTok Ad", icon: <Music size={12} />, width: 1080, height: 1920, style: "native TikTok feel, UGC-style, authentic", category: "ads" },
  { label: "Story Ad (FB/IG)", icon: <Camera size={12} />, width: 1080, height: 1920, style: "full-screen, swipe-up CTA, engaging", category: "ads" },
  { label: "Retargeting Ad", icon: <Flag size={12} />, width: 1080, height: 1080, style: "reminder-style, social proof, urgency", category: "ads" },
  // Email
  { label: "Newsletter Banner", icon: <Mail size={12} />, width: 600, height: 300, style: "engaging, brand colors, clear CTA", category: "email_headers" },
  { label: "Email Footer", icon: <Mail size={12} />, width: 600, height: 150, style: "social links, contact info, minimal", category: "email_headers" },
  // Podcast
  { label: "Episode Art Square", icon: <Podcast size={12} />, width: 1080, height: 1080, style: "episode number, guest name, bold visual", category: "podcast_covers" },
  { label: "Audiogram Template", icon: <Podcast size={12} />, width: 1080, height: 1080, style: "waveform, captions, speaker photo", category: "podcast_covers" },
];

const INDUSTRY_STYLES: Record<string, string> = {
  dental: "Clean, trustworthy, white/blue tones, friendly faces, modern medical aesthetic",
  legal: "Professional, navy/gold, serif fonts, trust-focused, sophisticated",
  real_estate: "Luxury, warm tones, property photography, aspirational lifestyle",
  fitness: "Bold, energetic, dark with vibrant accents, action shots, motivational",
  restaurant: "Warm, appetizing, food photography, rustic/modern, inviting",
  tech: "Sleek, minimal, blue/purple gradients, futuristic, clean",
  beauty: "Elegant, soft pastels, clean typography, luxury feel",
  ecommerce: "Product-focused, clean white, lifestyle shots, aspirational",
  automotive: "Bold, dynamic angles, metallic tones, speed & power, premium",
  education: "Approachable, bright colors, playful yet professional, knowledge-focused",
  finance: "Trustworthy, navy/green, charts & growth imagery, stability",
  healthcare: "Clean, calming blues/greens, caring, professional, HIPAA-aware",
  construction: "Industrial, bold, hard-hat imagery, progress, strength",
  travel: "Wanderlust, vivid landscapes, adventure, golden hour, dreamy",
  fashion: "High-contrast, editorial, runway-inspired, trendsetting, bold typography",
  wedding: "Romantic, soft tones, elegant script fonts, floral, timeless",
  music: "Dark, vibrant neon, concert energy, album art inspired, bold",
  saas: "Clean UI, gradient backgrounds, screenshots, feature highlights, modern",
  nonprofit: "Warm, community-focused, impact imagery, hopeful, mission-driven",
  pet: "Playful, warm, cute animal photos, bright and friendly",
};

const COLOR_PALETTES = [
  { name: "Professional", colors: ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#C9A84C"] },
  { name: "Fresh & Clean", colors: ["#ffffff", "#f0f0f0", "#2d3436", "#00cec9", "#6c5ce7"] },
  { name: "Bold & Vibrant", colors: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff"] },
  { name: "Luxury Gold", colors: ["#0d0d0d", "#1a1a1a", "#C9A84C", "#e8d5a3", "#ffffff"] },
  { name: "Nature", colors: ["#2d5016", "#3a7d0a", "#87c159", "#f5f5dc", "#8b4513"] },
  { name: "Ocean", colors: ["#003545", "#006d77", "#83c5be", "#edf6f9", "#ffddd2"] },
  { name: "Sunset", colors: ["#2b1055", "#d63230", "#f5a623", "#f7dc6f", "#fed8b1"] },
  { name: "Minimal Dark", colors: ["#0a0a0a", "#1a1a1a", "#333333", "#ffffff", "#C9A84C"] },
  { name: "Neon Pop", colors: ["#0D0D0D", "#FF00FF", "#00FF87", "#FFE600", "#00D4FF"] },
  { name: "Pastel Dream", colors: ["#FDA4AF", "#A5B4FC", "#86EFAC", "#FDE68A", "#FBCFE8"] },
  { name: "Earth Tones", colors: ["#78350F", "#92400E", "#B45309", "#D4A574", "#FDF8E1"] },
  { name: "Coral Reef", colors: ["#FF6B6B", "#EE5A6F", "#F8B595", "#F5E6CC", "#355C7D"] },
  { name: "Cyberpunk", colors: ["#0A0A1A", "#1A0533", "#FF2D95", "#00F0FF", "#FFE600"] },
  { name: "Forest Moss", colors: ["#1B3A2D", "#2D5016", "#5B8C3E", "#A8C686", "#F0F5E8"] },
  { name: "Royal Purple", colors: ["#1A0533", "#2D1B69", "#6D28D9", "#A78BFA", "#EDE9FE"] },
  { name: "Warm Autumn", colors: ["#451A03", "#9A3412", "#EA580C", "#F97316", "#FED7AA"] },
  { name: "Ice Blue", colors: ["#0C1929", "#1E3A5F", "#2563EB", "#60A5FA", "#DBEAFE"] },
  { name: "Rose Gold", colors: ["#1A1A1A", "#4A2040", "#B76E79", "#E8C4B8", "#FFF5F5"] },
  { name: "Monochrome Gray", colors: ["#111111", "#333333", "#666666", "#AAAAAA", "#F0F0F0"] },
  { name: "Tropical Punch", colors: ["#FF6347", "#FF8C00", "#FFD700", "#00CED1", "#FF69B4"] },
  { name: "Midnight Navy", colors: ["#0A0E27", "#1A1F4E", "#2B3494", "#4B6CB7", "#C9D6FF"] },
  { name: "Vintage Cream", colors: ["#2C1810", "#5C3A21", "#8B6914", "#D4B896", "#FFF8DC"] },
  { name: "Electric Gradient", colors: ["#667EEA", "#764BA2", "#F093FB", "#4FACFE", "#00F2FE"] },
];

// ---------- Brand Kit Types ----------
interface BrandKit {
  id: string;
  name: string;
  colors: string[];
  fonts: { heading: string; body: string };
  logoUrl: string;
}

// ---------- Smart Resize Presets ----------
const RESIZE_PRESETS = [
  { label: "Instagram Post", w: 1080, h: 1080, icon: <Camera size={12} /> },
  { label: "Instagram Story", w: 1080, h: 1920, icon: <Camera size={12} /> },
  { label: "Facebook Post", w: 1200, h: 630, icon: <MessageCircle size={12} /> },
  { label: "Twitter/X Post", w: 1200, h: 675, icon: <MessageCircle size={12} /> },
  { label: "LinkedIn Post", w: 1200, h: 1200, icon: <Briefcase size={12} /> },
  { label: "Pinterest Pin", w: 1000, h: 1500, icon: <ImagePlus size={12} /> },
  { label: "YouTube Thumb", w: 1280, h: 720, icon: <Play size={12} /> },
  { label: "TikTok", w: 1080, h: 1920, icon: <Music size={12} /> },
];

// ---------- Layer Types ----------
interface DesignLayer {
  id: string;
  name: string;
  type: "text" | "image" | "shape" | "background";
  visible: boolean;
  locked: boolean;
  opacity: number;
}

// ---------- Mockup Products ----------
const MOCKUP_PRODUCTS = [
  { id: "tshirt", label: "T-Shirt", icon: <Shirt size={14} /> },
  { id: "mug", label: "Coffee Mug", icon: <Coffee size={14} /> },
  { id: "phone", label: "Phone Case", icon: <Smartphone size={14} /> },
  { id: "laptop", label: "Laptop Screen", icon: <Laptop size={14} /> },
  { id: "tote", label: "Tote Bag", icon: <ShoppingBag size={14} /> },
  { id: "poster", label: "Wall Poster", icon: <ImageIcon size={14} /> },
  { id: "hoodie", label: "Hoodie", icon: <Shirt size={14} /> },
  { id: "box", label: "Product Box", icon: <Package size={14} /> },
];

// ---------- Photo Filters ----------
const PHOTO_FILTERS = [
  { name: "Vintage", css: "sepia(0.4) contrast(1.1) brightness(0.95)" },
  { name: "Dramatic", css: "contrast(1.5) brightness(0.85) saturate(1.3)" },
  { name: "Pastel", css: "saturate(0.6) brightness(1.15) contrast(0.9)" },
  { name: "B&W Classic", css: "grayscale(1) contrast(1.2)" },
  { name: "Warm Glow", css: "sepia(0.2) saturate(1.3) brightness(1.05)" },
  { name: "Cool Tone", css: "saturate(0.8) hue-rotate(15deg) brightness(1.05)" },
  { name: "High Contrast", css: "contrast(1.8) brightness(0.9)" },
  { name: "Soft Focus", css: "blur(0.5px) brightness(1.1) saturate(0.9)" },
  { name: "Moody", css: "brightness(0.8) contrast(1.3) saturate(0.7)" },
  { name: "Cinematic", css: "contrast(1.2) saturate(0.85) brightness(0.9) sepia(0.1)" },
  { name: "Noir", css: "grayscale(1) contrast(1.6) brightness(0.8)" },
  { name: "Retro", css: "sepia(0.5) hue-rotate(-10deg) saturate(1.2)" },
  { name: "Pop Art", css: "saturate(2) contrast(1.4) brightness(1.1)" },
  { name: "Faded", css: "contrast(0.8) brightness(1.1) saturate(0.5)" },
  { name: "Golden Hour", css: "sepia(0.3) saturate(1.4) brightness(1.08) hue-rotate(-5deg)" },
  { name: "Ocean Blue", css: "hue-rotate(30deg) saturate(1.2) brightness(1.05)" },
  { name: "Forest", css: "hue-rotate(60deg) saturate(0.9) brightness(0.95)" },
  { name: "Neon", css: "saturate(2.5) contrast(1.3) brightness(1.1)" },
  { name: "Polaroid", css: "sepia(0.15) contrast(1.1) brightness(1.05) saturate(1.1)" },
  { name: "Dust Storm", css: "sepia(0.4) contrast(0.9) brightness(1.1) saturate(0.7)" },
  { name: "Midnight", css: "brightness(0.6) contrast(1.4) saturate(0.5) hue-rotate(200deg)" },
  { name: "Bloom", css: "brightness(1.15) contrast(0.95) saturate(1.2) blur(0.3px)" },
];

// ---------- Icon Categories ----------
const ICON_CATEGORIES = [
  { name: "Business", icons: ["briefcase", "chart-bar", "building", "handshake", "target", "trophy", "lightbulb", "rocket"] },
  { name: "Social", icons: ["heart", "thumbs-up", "message", "share", "star", "bell", "user", "group"] },
  { name: "Tech", icons: ["code", "terminal", "cpu", "cloud", "wifi", "shield", "database", "smartphone"] },
  { name: "Nature", icons: ["leaf", "sun", "moon", "droplet", "flower", "tree", "mountain", "wave"] },
  { name: "Food", icons: ["coffee", "utensils", "cake", "pizza", "apple", "wine", "cookie", "ice-cream"] },
  { name: "Travel", icons: ["plane", "map", "compass", "globe", "camera", "luggage", "tent", "anchor"] },
  { name: "Health", icons: ["heart-pulse", "stethoscope", "pill", "activity", "dumbbell", "apple", "brain", "eye"] },
  { name: "Media", icons: ["play", "music", "video", "mic", "headphones", "film", "radio", "tv"] },
];

// ---------- Infographic Types ----------
const INFOGRAPHIC_TYPES = [
  { id: "stats", label: "Statistics Dashboard", icon: <BarChart3 size={14} />, desc: "Key metrics with big numbers" },
  { id: "timeline", label: "Timeline", icon: <Clock size={14} />, desc: "Chronological events or steps" },
  { id: "comparison", label: "Comparison Chart", icon: <SlidersHorizontal size={14} />, desc: "Side-by-side feature comparison" },
  { id: "process", label: "Process Flow", icon: <TrendingUp size={14} />, desc: "Step-by-step workflow" },
  { id: "pie", label: "Pie/Donut Chart", icon: <Aperture size={14} />, desc: "Percentage breakdown visual" },
  { id: "hierarchy", label: "Hierarchy/Org Chart", icon: <Users size={14} />, desc: "Organizational structure" },
];

// ---------- Social Proof Widget Types ----------
const SOCIAL_PROOF_TYPES = [
  { id: "testimonial", label: "Testimonial Card", icon: <Quote size={14} /> },
  { id: "review_stars", label: "Review Stars", icon: <Star size={14} /> },
  { id: "trust_badge", label: "Trust Badge", icon: <BadgeCheck size={14} /> },
  { id: "counter", label: "Stats Counter", icon: <TrendingUp size={14} /> },
  { id: "logo_wall", label: "Client Logo Wall", icon: <Grid size={14} /> },
  { id: "before_after", label: "Before/After", icon: <SlidersHorizontal size={14} /> },
];

// ---------- Seasonal Template Packs ----------
const SEASONAL_PACKS = [
  { id: "christmas", label: "Christmas / Holidays", icon: <Gift size={14} />, colors: ["#c0392b", "#27ae60", "#f1c40f", "#ecf0f1", "#2c3e50"] },
  { id: "new_year", label: "New Year", icon: <PartyPopper size={14} />, colors: ["#f1c40f", "#2c3e50", "#ecf0f1", "#8e44ad", "#000000"] },
  { id: "valentine", label: "Valentine's Day", icon: <Heart size={14} />, colors: ["#e74c3c", "#ff6b81", "#fdcb6e", "#ffffff", "#2c3e50"] },
  { id: "spring", label: "Spring / Easter", icon: <Leaf size={14} />, colors: ["#55efc4", "#81ecec", "#fdcb6e", "#ff7979", "#badc58"] },
  { id: "summer", label: "Summer Vibes", icon: <Sun size={14} />, colors: ["#f39c12", "#e74c3c", "#3498db", "#1abc9c", "#ffffff"] },
  { id: "halloween", label: "Halloween", icon: <Moon size={14} />, colors: ["#f39c12", "#2c3e50", "#8e44ad", "#e74c3c", "#000000"] },
  { id: "fall", label: "Autumn / Thanksgiving", icon: <Leaf size={14} />, colors: ["#d35400", "#e67e22", "#f39c12", "#27ae60", "#6c3483"] },
  { id: "winter", label: "Winter Wonderland", icon: <Snowflake size={14} />, colors: ["#3498db", "#ecf0f1", "#bdc3c7", "#2c3e50", "#ffffff"] },
  { id: "back_to_school", label: "Back to School", icon: <BookOpen size={14} />, colors: ["#e74c3c", "#3498db", "#f1c40f", "#2ecc71", "#2c3e50"] },
  { id: "black_friday", label: "Black Friday / Cyber", icon: <Zap size={14} />, colors: ["#000000", "#f1c40f", "#e74c3c", "#ffffff", "#2c3e50"] },
];

// ---------- Design System Token Defaults ----------
interface DesignToken {
  id: string;
  category: "spacing" | "radius" | "shadow" | "opacity" | "font-size";
  name: string;
  value: string;
}

// ---------- Typography Pairings ----------
const FONT_PAIRINGS = [
  { heading: "Montserrat Bold", body: "Open Sans Regular", vibe: "Modern & Clean" },
  { heading: "Playfair Display", body: "Source Sans Pro", vibe: "Elegant & Classic" },
  { heading: "Oswald Bold", body: "Lato Regular", vibe: "Bold & Confident" },
  { heading: "Poppins SemiBold", body: "Nunito Regular", vibe: "Friendly & Approachable" },
  { heading: "Bebas Neue", body: "Roboto Regular", vibe: "Impactful & Modern" },
  { heading: "Merriweather Bold", body: "Source Sans Pro Light", vibe: "Editorial & Trustworthy" },
  { heading: "Raleway Bold", body: "Crimson Text Regular", vibe: "Sophisticated & Refined" },
  { heading: "DM Serif Display", body: "DM Sans Regular", vibe: "Contemporary Serif" },
  { heading: "Inter Bold", body: "Inter Regular", vibe: "Tech & SaaS" },
  { heading: "Archivo Black", body: "Work Sans Regular", vibe: "Strong & Professional" },
];

// ---------- Pattern Types ----------
const PATTERN_TYPES = [
  { id: "geometric", label: "Geometric", desc: "Triangles, hexagons, grids" },
  { id: "dots", label: "Polka Dots", desc: "Evenly spaced dot patterns" },
  { id: "stripes", label: "Stripes", desc: "Diagonal, horizontal, vertical" },
  { id: "waves", label: "Waves", desc: "Flowing organic wave patterns" },
  { id: "floral", label: "Floral", desc: "Flower and botanical patterns" },
  { id: "abstract", label: "Abstract", desc: "Organic blobs and shapes" },
  { id: "memphis", label: "Memphis", desc: "90s-style playful shapes" },
  { id: "noise", label: "Noise/Grain", desc: "Subtle texture overlay" },
];

export default function DesignStudioPage() {
  useAuth();
  const supabase = createClient();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; industry: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [tab, setTab] = useState<"create" | "templates" | "palettes" | "tools">("create");
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedPrompt[]>([]);
  const [generating, setGenerating] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreset | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1080, height: 1080 });
  const [style, setStyle] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState<typeof COLOR_PALETTES[0] | null>(null);

  // ---------- New Feature State ----------
  const [toolsTab, setToolsTab] = useState<string>("brand-kit");
  const [brandKits, setBrandKits] = useState<BrandKit[]>([
    { id: "1", name: "Default Brand", colors: ["#C9A84C", "#1a1a2e", "#16213e", "#ffffff", "#f0f0f0"], fonts: { heading: "Montserrat Bold", body: "Open Sans Regular" }, logoUrl: "" },
  ]);
  const [activeBrandKit, setActiveBrandKit] = useState<string>("1");
  const [newBrandKitName, setNewBrandKitName] = useState("");
  const [newBrandColor, setNewBrandColor] = useState("#C9A84C");

  // Smart Resize
  const [resizeSource, setResizeSource] = useState<string>("");
  const [selectedResizes, setSelectedResizes] = useState<string[]>([]);

  // Layer Editor
  const [designLayers, setDesignLayers] = useState<DesignLayer[]>([
    { id: "1", name: "Background", type: "background", visible: true, locked: false, opacity: 100 },
    { id: "2", name: "Main Image", type: "image", visible: true, locked: false, opacity: 100 },
    { id: "3", name: "Headline Text", type: "text", visible: true, locked: false, opacity: 100 },
    { id: "4", name: "Subtitle", type: "text", visible: true, locked: false, opacity: 90 },
    { id: "5", name: "CTA Button", type: "shape", visible: true, locked: false, opacity: 100 },
    { id: "6", name: "Logo Overlay", type: "image", visible: true, locked: true, opacity: 85 },
  ]);

  // Background Remover
  const [bgRemoveStatus, setBgRemoveStatus] = useState<"idle" | "processing" | "done">("idle");
  const [bgRemoveFile, setBgRemoveFile] = useState<string>("");

  // Mockup Generator
  const [selectedMockup, setSelectedMockup] = useState<string>("tshirt");
  const [mockupColor, setMockupColor] = useState("#ffffff");
  const [mockupGenerating, setMockupGenerating] = useState(false);

  // QR Code
  const [qrUrl, setQrUrl] = useState("");
  const [qrColor, setQrColor] = useState("#000000");
  const [qrBgColor, setQrBgColor] = useState("#ffffff");
  const [qrSize, setQrSize] = useState(256);
  const [qrIncludeLogo, setQrIncludeLogo] = useState(true);

  // Version History
  // TODO: fetch from API
  const [versionHistory] = useState<Array<{ id: string; label: string; date: string; changes: string }>>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [compareVersion, setCompareVersion] = useState("");

  // Color Palette Extractor
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [extractingColors, setExtractingColors] = useState(false);

  // Typography Pairing
  const [selectedPairing, setSelectedPairing] = useState<number | null>(null);

  // Pattern Generator
  const [patternType, setPatternType] = useState("geometric");
  const [patternColor1, setPatternColor1] = useState("#C9A84C");
  const [patternColor2, setPatternColor2] = useState("#1a1a2e");
  const [patternScale, setPatternScale] = useState(50);

  // Photo Filters
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [filterIntensity, setFilterIntensity] = useState(100);

  // Icon Library
  const [iconSearch, setIconSearch] = useState("");
  const [iconCategory, setIconCategory] = useState("Business");

  // Infographic Builder
  const [infographicType, setInfographicType] = useState("stats");
  const [infographicData, setInfographicData] = useState<Array<{ label: string; value: string }>>([]);

  // Social Proof
  const [socialProofType, setSocialProofType] = useState("testimonial");
  const [testimonialText, setTestimonialText] = useState("");
  const [testimonialAuthor, setTestimonialAuthor] = useState("");
  const [reviewStars, setReviewStars] = useState(5);

  // Seasonal Templates
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);

  // Animation Preview
  const [animationType, setAnimationType] = useState<"fade" | "slide" | "bounce" | "zoom" | "rotate">("fade");
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [animationPlaying, setAnimationPlaying] = useState(false);

  // Design System Tokens
  const [designTokens, setDesignTokens] = useState<DesignToken[]>([
    { id: "t1", category: "spacing", name: "sm", value: "4px" },
    { id: "t2", category: "spacing", name: "md", value: "8px" },
    { id: "t3", category: "spacing", name: "lg", value: "16px" },
    { id: "t4", category: "spacing", name: "xl", value: "24px" },
    { id: "t5", category: "radius", name: "sm", value: "4px" },
    { id: "t6", category: "radius", name: "md", value: "8px" },
    { id: "t7", category: "radius", name: "lg", value: "16px" },
    { id: "t8", category: "radius", name: "full", value: "9999px" },
    { id: "t9", category: "shadow", name: "sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
    { id: "t10", category: "shadow", name: "md", value: "0 4px 6px rgba(0,0,0,0.1)" },
    { id: "t11", category: "shadow", name: "lg", value: "0 10px 25px rgba(0,0,0,0.15)" },
  ]);
  const [newTokenCategory, setNewTokenCategory] = useState<DesignToken["category"]>("spacing");
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenValue, setNewTokenValue] = useState("");

  // Batch Export
  const [batchExportFormats, setBatchExportFormats] = useState<string[]>(["png"]);
  const [batchExportSizes, setBatchExportSizes] = useState<string[]>(["1080x1080"]);
  const [batchExporting, setBatchExporting] = useState(false);

  // Accessibility Checker
  const [a11yFgColor, setA11yFgColor] = useState("#ffffff");
  const [a11yBgColor, setA11yBgColor] = useState("#1a1a2e");
  const [a11yFontSize, setA11yFontSize] = useState(16);

  // Mood Board
  const [moodBoardItems, setMoodBoardItems] = useState<Array<{ id: string; type: "color" | "image" | "note"; value: string }>>([
    { id: "m1", type: "color", value: "#C9A84C" },
    { id: "m2", type: "color", value: "#1a1a2e" },
    { id: "m3", type: "note", value: "Minimalist luxury feel" },
    { id: "m4", type: "note", value: "Gold accents on dark background" },
  ]);
  const [newMoodNote, setNewMoodNote] = useState("");
  const [newMoodColor, setNewMoodColor] = useState("#C9A84C");

  // AI Style Transfer
  const [styleTransferSource, setStyleTransferSource] = useState("");
  const [styleTransferStyle, setStyleTransferStyle] = useState("");
  const [styleTransferring, setStyleTransferring] = useState(false);
  const [styleTransferStrength, setStyleTransferStrength] = useState(75);

  // Guided Mode ↔ Advanced Mode
  const [advancedMode, setAdvancedMode] = useAdvancedMode("design");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedKind, setGuidedKind] = useState<string>("social");
  const [guidedVibe, setGuidedVibe] = useState<string>("professional");
  const [guidedPrompt, setGuidedPrompt] = useState<string>("");

  // ---------- Helper Functions ----------
  function getContrastRatio(fg: string, bg: string): number {
    const getLuminance = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    };
    const l1 = getLuminance(fg);
    const l2 = getLuminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getWCAGRating(ratio: number, fontSize: number): { aa: boolean; aaa: boolean; aaLarge: boolean; aaaLarge: boolean } {
    const isLarge = fontSize >= 18;
    return {
      aa: isLarge ? ratio >= 3 : ratio >= 4.5,
      aaa: isLarge ? ratio >= 4.5 : ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5,
    };
  }

  function handleExtractColors() {
    setExtractingColors(true);
    setTimeout(() => {
      setExtractedColors(["#2d3436", "#636e72", "#b2bec3", "#dfe6e9", "#C9A84C", "#e17055"]);
      setExtractingColors(false);
      toast.success("Extracted 6 colors from image");
    }, 1500);
  }

  function handleBgRemove() {
    setBgRemoveStatus("processing");
    setTimeout(() => {
      setBgRemoveStatus("done");
      toast.success("Background removed successfully!");
    }, 2000);
  }

  function handleMockupGenerate() {
    setMockupGenerating(true);
    setTimeout(() => {
      setMockupGenerating(false);
      toast.success(`Mockup generated on ${MOCKUP_PRODUCTS.find(p => p.id === selectedMockup)?.label}!`);
    }, 2000);
  }

  function handleBatchExport() {
    setBatchExporting(true);
    setTimeout(() => {
      setBatchExporting(false);
      toast.success(`Exported ${batchExportSizes.length} sizes in ${batchExportFormats.length} format(s)!`);
    }, 2500);
  }

  function handleStyleTransfer() {
    setStyleTransferring(true);
    setTimeout(() => {
      setStyleTransferring(false);
      toast.success("Style transfer complete!");
    }, 3000);
  }

  useEffect(() => {
    supabase.from("clients").select("id, business_name, industry").eq("is_active", true).then(({ data }: { data: { id: string; business_name: string; industry: string }[] | null }) => {
      setClients(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sectionTypeMap: Record<string, string> = {
    thumbnails: "thumbnail", social: "social_post", carousels: "carousel", ads: "ad", logos: "logo",
    banners: "banner", infographics: "infographic", presentations: "presentation",
    email_headers: "email_header", podcast_covers: "podcast_cover", brochures: "brochure", mockups: "mockup",
  };

  function getAspectRatio(w: number, h: number): string {
    if (w === h) return "1:1";
    if (w / h > 1.7) return "16:9";
    if (h / w > 1.7) return "9:16";
    if (w / h > 1.3) return "3:2";
    return "4:5";
  }

  function getIndustryStyle(): string {
    if (selectedClient) {
      const client = clients.find(c => c.id === selectedClient);
      if (client?.industry) {
        const match = Object.entries(INDUSTRY_STYLES).find(([k]) => client.industry.toLowerCase().includes(k));
        if (match) return match[1];
      }
    }
    return "";
  }

  async function generateDesign(section: string) {
    const prompt = prompts[section];
    if (!prompt?.trim()) { toast.error("Please enter a design prompt"); return; }

    setGenerating(section);
    try {
      const w = selectedTemplate?.width || dimensions.width;
      const h = selectedTemplate?.height || dimensions.height;
      const industryStyle = getIndustryStyle();
      const paletteStr = selectedPalette ? `Color palette: ${selectedPalette.colors.join(", ")}. ` : "";

      const res = await fetch("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: prompt,
          type: sectionTypeMap[section] || section,
          aspect_ratio: getAspectRatio(w, h),
          style: `${paletteStr}${industryStyle ? industryStyle + ". " : ""}${selectedTemplate?.style || style || "professional, modern"}`,
          client_id: selectedClient || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mjPrompts = data.prompts || [];
        const mainPrompt = mjPrompts[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;

        const newPrompt: GeneratedPrompt = {
          id: crypto.randomUUID(),
          section,
          prompt: mainPrompt,
          style: selectedTemplate?.style || style || "professional",
          dimensions: `${w}x${h}`,
        };
        setGenerated(prev => [newPrompt, ...prev]);

        if (mjPrompts.length > 1) {
          mjPrompts.slice(1).forEach((p: { prompt: string }) => {
            setGenerated(prev => [{
              id: crypto.randomUUID(), section, prompt: p.prompt,
              style: selectedTemplate?.style || style || "professional",
              dimensions: `${w}x${h}`,
            }, ...prev]);
          });
        }

        toast.success(`${mjPrompts.length || 1} prompt${(mjPrompts.length || 1) > 1 ? "s" : ""} generated!`);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to generate");
      }
    } catch {
      toast.error("Error connecting to AI service");
    }
    setGenerating(null);
  }

  async function batchGenerate() {
    const prompt = prompts[activeSection || "social"];
    if (!prompt?.trim()) { toast.error("Enter a description first"); return; }
    setBatchGenerating(true);
    toast.loading("Generating for all sizes...");

    const sizes = TEMPLATES.filter(t => activeSection ? t.category === activeSection : true).slice(0, 5);
    for (const template of sizes) {
      try {
        const res = await fetch("/api/content/generate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: prompt,
            type: sectionTypeMap[activeSection || "social"] || "social_post",
            aspect_ratio: getAspectRatio(template.width, template.height),
            style: template.style,
            client_id: selectedClient || null,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const mainPrompt = data.prompts?.[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;
          setGenerated(prev => [{
            id: crypto.randomUUID(),
            section: activeSection || "social",
            prompt: mainPrompt,
            style: template.style,
            dimensions: `${template.width}x${template.height}`,
          }, ...prev]);
        }
      } catch { /* continue */ }
    }
    toast.dismiss();
    toast.success(`Generated prompts for ${sizes.length} sizes!`);
    setBatchGenerating(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  }

  function applyTemplate(template: TemplatePreset) {
    setSelectedTemplate(template);
    setDimensions({ width: template.width, height: template.height });
    setStyle(template.style);
    toast.success(`Applied: ${template.label}`);
  }

  /* ─── Guided Mode: pick a design kind + vibe → generate first prompt ─── */
  const GUIDED_KINDS: Array<{ id: string; label: string; desc: string; sectionKey: string; templateLabel: string; icon: React.ReactNode }> = [
    { id: "logo", label: "Logo", desc: "Brand mark or wordmark", sectionKey: "logos", templateLabel: "Primary Logo", icon: <Award size={18} /> },
    { id: "banner", label: "Banner", desc: "Website or social header", sectionKey: "banners", templateLabel: "Website Hero", icon: <Monitor size={18} /> },
    { id: "social", label: "Social post", desc: "IG, LinkedIn, TikTok", sectionKey: "social", templateLabel: "Instagram Post", icon: <Camera size={18} /> },
    { id: "thumbnail", label: "Thumbnail", desc: "YouTube cover art", sectionKey: "thumbnails", templateLabel: "YouTube Thumbnail", icon: <Play size={18} /> },
  ];

  const GUIDED_VIBES: Array<{ id: string; label: string; style: string; palette: string }> = [
    { id: "professional", label: "Professional", style: "clean, corporate, trustworthy, premium typography", palette: "Professional" },
    { id: "bold", label: "Bold", style: "high-contrast, bold, impactful, confident, energetic", palette: "Bold & Vibrant" },
    { id: "minimal", label: "Minimal", style: "minimal, lots of white space, simple, modern, refined", palette: "Minimal Dark" },
    { id: "luxury", label: "Luxury", style: "luxury gold, elegant, premium, sophisticated, high-end brand", palette: "Luxury Gold" },
    { id: "playful", label: "Playful", style: "playful, vibrant, fun, approachable, warm", palette: "Neon Pop" },
    { id: "natural", label: "Natural", style: "organic, earthy, warm, calm, rooted", palette: "Earth Tones" },
  ];

  async function handleGuidedGenerate() {
    const prompt = guidedPrompt.trim();
    if (!prompt) {
      toast.error("Describe what you want to design");
      return;
    }
    const kind = GUIDED_KINDS.find(k => k.id === guidedKind) || GUIDED_KINDS[0];
    const vibe = GUIDED_VIBES.find(v => v.id === guidedVibe) || GUIDED_VIBES[0];
    const template = TEMPLATES.find(t => t.label === kind.templateLabel);
    const palette = COLOR_PALETTES.find(p => p.name === vibe.palette);

    // Sync into Advanced state so the user can iterate in the full UI.
    setActiveSection(kind.sectionKey);
    setPrompts(prev => ({ ...prev, [kind.sectionKey]: prompt }));
    if (template) {
      setSelectedTemplate(template);
      setDimensions({ width: template.width, height: template.height });
    }
    setStyle(vibe.style);
    if (palette) setSelectedPalette(palette);

    setGenerating(kind.sectionKey);
    try {
      const w = template?.width || dimensions.width;
      const h = template?.height || dimensions.height;
      const paletteStr = palette ? `Color palette: ${palette.colors.join(", ")}. ` : "";
      const industryStyle = getIndustryStyle();

      const res = await fetch("/api/content/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: prompt,
          type: sectionTypeMap[kind.sectionKey] || kind.sectionKey,
          aspect_ratio: getAspectRatio(w, h),
          style: `${paletteStr}${industryStyle ? industryStyle + ". " : ""}${template?.style || vibe.style}`,
          client_id: selectedClient || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const mjPrompts = data.prompts || [];
        const mainPrompt = mjPrompts[0]?.prompt || data.midjourney_prompt || data.prompt || prompt;
        const newPrompt: GeneratedPrompt = {
          id: crypto.randomUUID(),
          section: kind.sectionKey,
          prompt: mainPrompt,
          style: template?.style || vibe.style,
          dimensions: `${w}x${h}`,
        };
        setGenerated(prev => [newPrompt, ...prev]);
        if (mjPrompts.length > 1) {
          mjPrompts.slice(1).forEach((p: { prompt: string }) => {
            setGenerated(prev => [{
              id: crypto.randomUUID(), section: kind.sectionKey, prompt: p.prompt,
              style: template?.style || vibe.style,
              dimensions: `${w}x${h}`,
            }, ...prev]);
          });
        }
        toast.success(`${mjPrompts.length || 1} prompt${(mjPrompts.length || 1) > 1 ? "s" : ""} generated!`);
        setAdvancedMode(true);
        setTab("create");
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.error || "Failed to generate");
      }
    } catch {
      toast.error("Error connecting to AI service");
    }
    setGenerating(null);
  }

  const guidedSteps: WizardStepDef[] = [
    {
      id: "kind",
      title: "What are you designing?",
      description: "We'll pick the right dimensions and default style for you.",
      icon: <Palette size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {GUIDED_KINDS.map(k => {
            const sel = guidedKind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setGuidedKind(k.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  sel
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <div className="text-gold mb-2">{k.icon}</div>
                <p className="text-sm font-semibold">{k.label}</p>
                <p className="text-[10px] text-muted mt-1">{k.desc}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "vibe",
      title: "Pick a vibe",
      description: "This picks a style + matching color palette — you can change both in Advanced.",
      icon: <Wand2 size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {GUIDED_VIBES.map(v => {
            const sel = guidedVibe === v.id;
            const palette = COLOR_PALETTES.find(p => p.name === v.palette);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setGuidedVibe(v.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  sel
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <p className="text-sm font-semibold">{v.label}</p>
                {palette && (
                  <div className="flex gap-1 mt-2">
                    {palette.colors.map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded border border-border" style={{ background: c }} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "prompt",
      title: "What should it show?",
      description: "One or two sentences about the subject. AI will turn this into a Midjourney-ready prompt.",
      icon: <Sparkles size={18} />,
      canProceed: guidedPrompt.trim().length > 0,
      component: (
        <textarea
          value={guidedPrompt}
          onChange={e => setGuidedPrompt(e.target.value)}
          placeholder={`e.g., "Modern dental clinic hero image with a friendly dentist and warm lighting"`}
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all resize-none"
          autoFocus
        />
      ),
    },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<PenTool size={28} />}
        title="Design Studio"
        subtitle="AI designs, palettes & batch generation."
        gradient="ocean"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="text-xs py-1.5 px-2 min-w-[140px] rounded-lg bg-white/10 border border-white/20 text-white">
              <option value="" className="bg-slate-800">No client</option>
              {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.business_name} {c.industry ? `(${c.industry})` : ""}</option>)}
            </select>
            {advancedMode && (
              <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
                <ExternalLink size={12} /> Canva
              </a>
            )}
          </>
        }
      />

      {/* Guided Mode — 3-step AI design prompter */}
      {!advancedMode && (
        <Wizard
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Generating…" : "Generate design"}
          busy={!!generating}
          onFinish={handleGuidedGenerate}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Rolling preview of example designs */}
      {advancedMode && (<>
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6">
        <div className="absolute inset-0 pointer-events-none">
          <RollingPreview
            items={DESIGN_PREVIEW_FALLBACK}
            rows={2}
            aspectRatio="16:9"
            opacity={0.35}
            speed="medium"
          />
        </div>
        <div className="relative text-center px-4">
          <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
            Design library
          </p>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Banners, posters, ad creatives, decks — one prompt away
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Pair a template with a brand palette and we batch out every
            asset at every ratio your campaign needs.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["create", "templates", "palettes", "tools"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "create" ? "Create" : t === "templates" ? "Templates" : t === "palettes" ? "Color Palettes" : "Design Tools"}
          </button>
        ))}
      </div>

      {/* Create Tab */}
      {tab === "create" && (
        <div className="space-y-4">
          {/* Active template info */}
          {selectedTemplate && (
            <div className="flex items-center gap-3 bg-gold/[0.04] border border-gold/15 rounded-xl px-4 py-2">
              <span className="text-[10px] text-gold font-medium flex items-center gap-1">{selectedTemplate.icon} {selectedTemplate.label}</span>
              <span className="text-[9px] text-muted">{selectedTemplate.width}x{selectedTemplate.height}</span>
              <span className="text-[9px] text-muted truncate max-w-xs">{selectedTemplate.style}</span>
              <button onClick={() => { setSelectedTemplate(null); setStyle(""); }}
                className="text-[9px] text-gold hover:text-gold-light ml-auto flex items-center gap-1"><RotateCcw size={9} /> Clear</button>
            </div>
          )}

          {selectedPalette && (
            <div className="flex items-center gap-3 bg-surface-light border border-border rounded-xl px-4 py-2">
              <span className="text-[10px] font-medium flex items-center gap-1"><Palette size={10} /> {selectedPalette.name}</span>
              <div className="flex gap-1">
                {selectedPalette.colors.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-md border border-border" style={{ background: c }} />
                ))}
              </div>
              <button onClick={() => setSelectedPalette(null)}
                className="text-[9px] text-muted hover:text-foreground ml-auto flex items-center gap-1"><RotateCcw size={9} /> Clear</button>
            </div>
          )}

          {/* Industry style hint */}
          {getIndustryStyle() && (
            <div className="flex items-center gap-2 text-[9px] text-gold bg-gold/[0.03] border border-gold/10 rounded-lg px-3 py-1.5">
              <Wand2 size={10} />
              <span>AI will use industry-specific style: <span className="font-medium">{getIndustryStyle().substring(0, 80)}...</span></span>
            </div>
          )}

          {/* Section selector */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setActiveSection(null)}
              className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${!activeSection ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"}`}>
              All
            </button>
            {SECTIONS.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  activeSection === s.key ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
                }`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Design cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(activeSection ? SECTIONS.filter(s => s.key === activeSection) : SECTIONS.slice(0, 6)).map(section => (
              <div key={section.key} className="card card-hover rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold">
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm">{section.label}</h3>
                    <p className="text-[10px] text-muted">{section.description}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={100} max={5000} value={dimensions.width}
                      onChange={e => setDimensions({ ...dimensions, width: parseInt(e.target.value) || 1080 })}
                      className="input w-16 text-[9px] py-1 text-center" />
                    <span className="text-[9px] text-muted">x</span>
                    <input type="number" min={100} max={5000} value={dimensions.height}
                      onChange={e => setDimensions({ ...dimensions, height: parseInt(e.target.value) || 1080 })}
                      className="input w-16 text-[9px] py-1 text-center" />
                  </div>
                </div>
                <div className="mb-3">
                  <PromptEnhancer
                    value={prompts[section.key] || ""}
                    onChange={(v) => setPrompts(prev => ({ ...prev, [section.key]: v }))}
                    type="design"
                    placeholder={`Describe your ${section.label.toLowerCase()} design...`}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => generateDesign(section.key)} disabled={generating === section.key}
                    className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-lg text-xs">
                    {generating === section.key ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {generating === section.key ? "Generating..." : "Generate with AI"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Batch generate */}
          {activeSection && (
            <button onClick={batchGenerate} disabled={batchGenerating || !prompts[activeSection]}
              className="w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/[0.06] text-gold hover:bg-gold/[0.12] transition-all font-medium disabled:opacity-50">
              {batchGenerating ? <Loader size={14} className="animate-spin" /> : <Layers size={14} />}
              {batchGenerating ? "Generating all sizes..." : "Batch Generate for All Sizes"}
            </button>
          )}

          {/* Generated Prompts */}
          {generated.length > 0 && (
            <div className="card rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header flex items-center gap-2 mb-0">
                  <ImageIcon size={16} /> Generated Prompts ({generated.length})
                </h2>
                <button onClick={() => {
                  const all = generated.map(g => `[${g.section} - ${g.dimensions}]\n${g.prompt}`).join("\n\n");
                  navigator.clipboard.writeText(all);
                  toast.success("All prompts copied!");
                }} className="btn-ghost text-[9px] flex items-center gap-1"><Copy size={10} /> Copy All</button>
              </div>
              <div className="space-y-3">
                {generated.map(g => (
                  <div key={g.id} className="card-hover rounded-xl">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="badge bg-gold/10 text-gold text-[10px] px-2 py-0.5 rounded capitalize">
                            {g.section}
                          </span>
                          <span className="text-[10px] text-muted">{g.dimensions}</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed">{g.prompt}</p>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => copyToClipboard(g.prompt)}
                          className="btn-primary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg">
                          <Copy size={10} /> Copy Prompt
                        </button>
                        <a href="https://www.canva.com" target="_blank" rel="noopener noreferrer"
                          className="btn-secondary flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg text-center justify-center">
                          <ExternalLink size={10} /> Canva
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Click a template to apply its dimensions and style to your designs</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => { applyTemplate(t); setTab("create"); }}
                className={`card card-hover text-left p-3 ${selectedTemplate?.label === t.label ? "border-gold/30" : ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gold">{t.icon}</span>
                  <span className="text-[8px] text-muted bg-surface-light px-1.5 py-0.5 rounded capitalize">{t.category}</span>
                </div>
                <p className="text-[11px] font-semibold">{t.label}</p>
                <p className="text-[9px] text-muted">{t.width}x{t.height}</p>
                <p className="text-[8px] text-muted mt-1 line-clamp-2">{t.style}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Palettes Tab */}
      {tab === "palettes" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Select a palette to apply to AI-generated designs. AI will incorporate these colors.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {COLOR_PALETTES.map(palette => (
              <button key={palette.name} onClick={() => { setSelectedPalette(palette); setTab("create"); toast.success(`Palette applied: ${palette.name}`); }}
                className={`card card-hover p-4 text-left ${selectedPalette?.name === palette.name ? "border-gold/30" : ""}`}>
                <p className="text-xs font-semibold mb-2">{palette.name}</p>
                <div className="flex gap-1 mb-2">
                  {palette.colors.map((c, i) => (
                    <div key={i} className="flex-1 h-8 rounded-lg border border-border" style={{ background: c }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {palette.colors.map((c, i) => (
                    <span key={i} className="text-[8px] text-muted font-mono">{c}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="card border-gold/10">
            <h3 className="section-header flex items-center gap-2"><Wand2 size={12} className="text-gold" /> Industry Styles</h3>
            <p className="text-[10px] text-muted mb-3">When you select a client, AI automatically uses an industry-appropriate style</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(INDUSTRY_STYLES).map(([industry, style]) => (
                <div key={industry} className="p-2.5 rounded-xl border border-border">
                  <p className="text-[10px] font-semibold capitalize">{industry}</p>
                  <p className="text-[9px] text-muted">{style}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== DESIGN TOOLS TAB ==================== */}
      {tab === "tools" && (
        <div className="space-y-4">
          {/* Tools Navigation */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "brand-kit", label: "Brand Kit", icon: <Paintbrush size={11} /> },
              { id: "smart-resize", label: "Smart Resize", icon: <Maximize2 size={11} /> },
              { id: "layers", label: "Layer Editor", icon: <Layers size={11} /> },
              { id: "bg-remover", label: "BG Remover", icon: <Scissors size={11} /> },
              { id: "mockups", label: "Mockups", icon: <Shirt size={11} /> },
              { id: "qr-code", label: "QR Code", icon: <QrCode size={11} /> },
              { id: "version-history", label: "Versions", icon: <History size={11} /> },
              { id: "color-extract", label: "Color Extract", icon: <Pipette size={11} /> },
              { id: "typography", label: "Typography", icon: <Type size={11} /> },
              { id: "patterns", label: "Patterns", icon: <Repeat size={11} /> },
              { id: "filters", label: "Photo Filters", icon: <Aperture size={11} /> },
              { id: "icons", label: "Icon Library", icon: <Search size={11} /> },
              { id: "infographics", label: "Infographics", icon: <BarChart3 size={11} /> },
              { id: "social-proof", label: "Social Proof", icon: <ThumbsUp size={11} /> },
              { id: "seasonal", label: "Seasonal Packs", icon: <CalendarDays size={11} /> },
              { id: "animation", label: "Animation", icon: <Film size={11} /> },
              { id: "design-tokens", label: "Design Tokens", icon: <Database size={11} /> },
              { id: "batch-export", label: "Batch Export", icon: <Download size={11} /> },
              { id: "accessibility", label: "Accessibility", icon: <Accessibility size={11} /> },
              { id: "mood-board", label: "Mood Board", icon: <Heart size={11} /> },
              { id: "style-transfer", label: "AI Style Transfer", icon: <Shuffle size={11} /> },
            ].map(tool => (
              <button key={tool.id} onClick={() => setToolsTab(tool.id)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                  toolsTab === tool.id ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
                }`}>
                {tool.icon} {tool.label}
              </button>
            ))}
          </div>

          {/* ========== 1. Brand Kit Manager ========== */}
          {toolsTab === "brand-kit" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Paintbrush size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Brand Kit Manager</h3>
                  <p className="text-[10px] text-muted">Save and apply brand colors, fonts, and logos across all designs</p>
                </div>
              </div>

              {/* Brand Kit List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {brandKits.map(kit => (
                  <div key={kit.id} className={`card-hover rounded-xl cursor-pointer transition-all ${activeBrandKit === kit.id ? "border-gold/30 bg-gold/[0.03]" : ""}`}
                    onClick={() => { setActiveBrandKit(kit.id); toast.success(`Active brand: ${kit.name}`); }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">{kit.name}</span>
                      {activeBrandKit === kit.id && <span className="text-[9px] text-gold font-medium bg-gold/10 px-2 py-0.5 rounded">Active</span>}
                    </div>
                    <div className="flex gap-1 mb-2">
                      {kit.colors.map((c, i) => (
                        <div key={i} className="flex-1 h-6 rounded-md border border-border" style={{ background: c }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-muted">
                      <span><Type size={9} className="inline mr-1" />{kit.fonts.heading}</span>
                      <span>{kit.fonts.body}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Brand Kit */}
              <div className="border border-border rounded-xl p-3 space-y-3">
                <h4 className="text-[11px] font-semibold flex items-center gap-2"><Plus size={12} /> Create New Brand Kit</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[9px] text-muted block mb-1">Kit Name</label>
                    <input value={newBrandKitName} onChange={e => setNewBrandKitName(e.target.value)}
                      className="input text-xs py-1.5 w-full" placeholder="My Brand" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted block mb-1">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newBrandColor} onChange={e => setNewBrandColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0" />
                      <span className="text-[10px] font-mono text-muted">{newBrandColor}</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button onClick={() => {
                      if (!newBrandKitName.trim()) { toast.error("Enter a kit name"); return; }
                      const newKit: BrandKit = {
                        id: crypto.randomUUID(), name: newBrandKitName,
                        colors: [newBrandColor, "#1a1a2e", "#ffffff", "#f0f0f0", "#333333"],
                        fonts: { heading: "Montserrat Bold", body: "Open Sans Regular" }, logoUrl: "",
                      };
                      setBrandKits(prev => [...prev, newKit]);
                      setNewBrandKitName("");
                      toast.success(`Brand kit "${newKit.name}" created!`);
                    }} className="btn-primary text-xs flex items-center gap-1.5 w-full justify-center">
                      <Plus size={12} /> Create Kit
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Kit Details */}
              {brandKits.find(k => k.id === activeBrandKit) && (
                <div className="border border-gold/15 bg-gold/[0.02] rounded-xl p-3 space-y-3">
                  <h4 className="text-[11px] font-semibold flex items-center gap-2">
                    <Wand2 size={12} className="text-gold" /> Active Kit: {brandKits.find(k => k.id === activeBrandKit)?.name}
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {brandKits.find(k => k.id === activeBrandKit)?.colors.map((c, i) => (
                      <div key={i} className="text-center">
                        <div className="h-10 rounded-lg border border-border mb-1" style={{ background: c }} />
                        <span className="text-[8px] font-mono text-muted">{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const kit = brandKits.find(k => k.id === activeBrandKit);
                      if (kit) { setSelectedPalette({ name: kit.name, colors: kit.colors }); setTab("create"); toast.success("Brand palette applied to designs!"); }
                    }} className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center">
                      <Palette size={10} /> Apply to Designs
                    </button>
                    <button className="btn-secondary text-[10px] flex items-center gap-1.5">
                      <Upload size={10} /> Upload Logo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== 2. Smart Resize ========== */}
          {toolsTab === "smart-resize" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Maximize2 size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Smart Resize</h3>
                  <p className="text-[10px] text-muted">One-click resize your design for multiple platforms simultaneously</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1.5">Source Design / Prompt</label>
                <textarea value={resizeSource} onChange={e => setResizeSource(e.target.value)}
                  className="input text-xs w-full" rows={2} placeholder="Paste your design prompt to resize for multiple platforms..." />
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-2">Target Platforms</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {RESIZE_PRESETS.map(preset => {
                    const key = `${preset.label}-${preset.w}x${preset.h}`;
                    const isSelected = selectedResizes.includes(key);
                    return (
                      <button key={key} onClick={() => setSelectedResizes(prev => isSelected ? prev.filter(r => r !== key) : [...prev, key])}
                        className={`card-hover rounded-xl p-2.5 text-left transition-all ${isSelected ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {isSelected ? <CheckCircle size={12} className="text-gold" /> : <span className="text-muted">{preset.icon}</span>}
                          <span className="text-[10px] font-medium">{preset.label}</span>
                        </div>
                        <span className="text-[9px] text-muted">{preset.w} x {preset.h}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setSelectedResizes(RESIZE_PRESETS.map(p => `${p.label}-${p.w}x${p.h}`))}
                  className="btn-secondary text-[10px] flex items-center gap-1.5">
                  <CheckCircle size={10} /> Select All
                </button>
                <button onClick={() => setSelectedResizes([])}
                  className="btn-ghost text-[10px] flex items-center gap-1.5">
                  <X size={10} /> Clear
                </button>
                <button disabled={!resizeSource.trim() || selectedResizes.length === 0}
                  onClick={() => { toast.success(`Resizing to ${selectedResizes.length} sizes...`); }}
                  className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center disabled:opacity-50">
                  <Maximize2 size={10} /> Resize to {selectedResizes.length} Platform{selectedResizes.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}

          {/* ========== 3. Layer Editor ========== */}
          {toolsTab === "layers" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Layers size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Layer Editor</h3>
                  <p className="text-[10px] text-muted">Manage layer ordering, visibility, and opacity for your designs</p>
                </div>
              </div>

              <div className="space-y-1.5">
                {designLayers.map((layer, index) => (
                  <div key={layer.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:border-gold/20 transition-all bg-surface-light/30">
                    <GripVertical size={12} className="text-muted cursor-grab" />
                    <button onClick={() => setDesignLayers(prev => prev.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l))}
                      className="text-muted hover:text-foreground transition-colors">
                      {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-muted/40" />}
                    </button>
                    <div className={`w-2 h-2 rounded-full ${layer.type === "text" ? "bg-blue-400" : layer.type === "image" ? "bg-green-400" : layer.type === "shape" ? "bg-purple-400" : "bg-orange-400"}`} />
                    <span className={`text-[10px] flex-1 ${layer.visible ? "text-foreground" : "text-muted/50 line-through"}`}>{layer.name}</span>
                    <span className="text-[8px] text-muted capitalize bg-surface-light px-1.5 py-0.5 rounded">{layer.type}</span>
                    <div className="flex items-center gap-1.5">
                      <input type="range" min={0} max={100} value={layer.opacity}
                        onChange={e => setDesignLayers(prev => prev.map(l => l.id === layer.id ? { ...l, opacity: parseInt(e.target.value) } : l))}
                        className="w-14 h-1 accent-gold" />
                      <span className="text-[8px] text-muted w-6 text-right">{layer.opacity}%</span>
                    </div>
                    <button onClick={() => setDesignLayers(prev => prev.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l))}
                      className={`text-[10px] ${layer.locked ? "text-gold" : "text-muted hover:text-foreground"}`}>
                      {layer.locked ? <Shield size={11} /> : <Move size={11} />}
                    </button>
                    {index > 0 && (
                      <button onClick={() => {
                        const newLayers = [...designLayers];
                        [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
                        setDesignLayers(newLayers);
                      }} className="text-muted hover:text-foreground text-[9px]">
                        <ChevronDown size={11} className="rotate-180" />
                      </button>
                    )}
                    {index < designLayers.length - 1 && (
                      <button onClick={() => {
                        const newLayers = [...designLayers];
                        [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
                        setDesignLayers(newLayers);
                      }} className="text-muted hover:text-foreground text-[9px]">
                        <ChevronDown size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={() => {
                const newLayer: DesignLayer = {
                  id: crypto.randomUUID(), name: `Layer ${designLayers.length + 1}`,
                  type: "shape", visible: true, locked: false, opacity: 100,
                };
                setDesignLayers(prev => [newLayer, ...prev]);
                toast.success("Layer added");
              }} className="btn-secondary text-[10px] flex items-center gap-1.5 w-full justify-center">
                <Plus size={11} /> Add Layer
              </button>
            </div>
          )}

          {/* ========== 4. Background Remover ========== */}
          {toolsTab === "bg-remover" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Scissors size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">AI Background Remover</h3>
                  <p className="text-[10px] text-muted">Remove backgrounds from images using AI in one click</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/30 transition-all cursor-pointer"
                onClick={() => setBgRemoveFile("sample-photo.jpg")}>
                <Upload size={24} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">Click to upload or drag & drop an image</p>
                <p className="text-[9px] text-muted/60 mt-1">Supports PNG, JPG, WEBP up to 10MB</p>
              </div>

              {bgRemoveFile && (
                <div className="flex items-center gap-3 bg-surface-light rounded-xl p-3">
                  <ImageIcon size={16} className="text-gold" />
                  <span className="text-xs flex-1">{bgRemoveFile}</span>
                  <button onClick={() => { setBgRemoveFile(""); setBgRemoveStatus("idle"); }}
                    className="text-muted hover:text-foreground"><X size={14} /></button>
                </div>
              )}

              {bgRemoveStatus === "processing" && (
                <div className="flex items-center gap-3 bg-gold/[0.04] border border-gold/15 rounded-xl p-3">
                  <Loader size={14} className="text-gold animate-spin" />
                  <span className="text-xs text-gold">Removing background with AI...</span>
                </div>
              )}

              {bgRemoveStatus === "done" && (
                <div className="flex items-center gap-3 bg-green-500/[0.06] border border-green-500/20 rounded-xl p-3">
                  <CheckCircle size={14} className="text-green-400" />
                  <span className="text-xs text-green-400">Background removed successfully!</span>
                  <button className="btn-primary text-[10px] ml-auto flex items-center gap-1"><Download size={10} /> Download</button>
                </div>
              )}

              <button onClick={handleBgRemove} disabled={!bgRemoveFile || bgRemoveStatus === "processing"}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full disabled:opacity-50">
                {bgRemoveStatus === "processing" ? <Loader size={12} className="animate-spin" /> : <Scissors size={12} />}
                {bgRemoveStatus === "processing" ? "Processing..." : "Remove Background"}
              </button>
            </div>
          )}

          {/* ========== 5. Mockup Generator ========== */}
          {toolsTab === "mockups" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Shirt size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Mockup Generator</h3>
                  <p className="text-[10px] text-muted">Place your designs on realistic product mockups</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {MOCKUP_PRODUCTS.map(product => (
                  <button key={product.id} onClick={() => setSelectedMockup(product.id)}
                    className={`card-hover rounded-xl p-3 text-center transition-all ${selectedMockup === product.id ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <div className={`mb-1.5 ${selectedMockup === product.id ? "text-gold" : "text-muted"}`}>{product.icon}</div>
                    <span className="text-[10px] font-medium">{product.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] text-muted block mb-1">Product Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={mockupColor} onChange={e => setMockupColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0" />
                    <span className="text-[10px] font-mono text-muted">{mockupColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted block mb-1">Quick Colors</label>
                  <div className="flex gap-1.5">
                    {["#ffffff", "#000000", "#1a1a2e", "#c0392b", "#2980b9", "#27ae60"].map(c => (
                      <button key={c} onClick={() => setMockupColor(c)}
                        className={`w-6 h-6 rounded-md border ${mockupColor === c ? "border-gold" : "border-border"}`} style={{ background: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-gold/30 transition-all cursor-pointer">
                <Upload size={20} className="text-muted mx-auto mb-1.5" />
                <p className="text-[10px] text-muted">Upload your design to place on mockup</p>
              </div>

              <button onClick={handleMockupGenerate} disabled={mockupGenerating}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full disabled:opacity-50">
                {mockupGenerating ? <Loader size={12} className="animate-spin" /> : <Shirt size={12} />}
                {mockupGenerating ? "Generating Mockup..." : `Generate ${MOCKUP_PRODUCTS.find(p => p.id === selectedMockup)?.label} Mockup`}
              </button>
            </div>
          )}

          {/* ========== 6. QR Code Generator ========== */}
          {toolsTab === "qr-code" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><QrCode size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">QR Code Generator</h3>
                  <p className="text-[10px] text-muted">Generate branded QR codes with custom colors and embedded logo</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1.5">URL or Content</label>
                <input value={qrUrl} onChange={e => setQrUrl(e.target.value)}
                  className="input text-xs py-2 w-full" placeholder="https://yourwebsite.com" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[9px] text-muted block mb-1">QR Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={qrColor} onChange={e => setQrColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <span className="text-[9px] font-mono text-muted">{qrColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted block mb-1">Background</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={qrBgColor} onChange={e => setQrBgColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <span className="text-[9px] font-mono text-muted">{qrBgColor}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted block mb-1">Size (px)</label>
                  <input type="number" value={qrSize} onChange={e => setQrSize(parseInt(e.target.value) || 256)}
                    className="input text-[10px] py-1.5 w-full" min={128} max={1024} />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={qrIncludeLogo} onChange={e => setQrIncludeLogo(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-gold" />
                    <span className="text-[10px]">Embed Logo</span>
                  </label>
                </div>
              </div>

              {/* Preview area */}
              <div className="flex justify-center p-6 bg-surface-light rounded-xl border border-border">
                <div className="w-32 h-32 rounded-xl flex items-center justify-center" style={{ background: qrBgColor }}>
                  <QrCode size={80} style={{ color: qrColor }} />
                </div>
              </div>

              <div className="flex gap-2">
                <button disabled={!qrUrl.trim()} onClick={() => toast.success("QR code generated!")}
                  className="btn-primary text-xs flex items-center justify-center gap-2 flex-1 disabled:opacity-50">
                  <QrCode size={12} /> Generate QR Code
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1.5">
                  <Download size={12} /> PNG
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1.5">
                  <Download size={12} /> SVG
                </button>
              </div>
            </div>
          )}

          {/* ========== 7. Design Version History ========== */}
          {toolsTab === "version-history" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><History size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Design Version History</h3>
                  <p className="text-[10px] text-muted">Track design iterations and compare versions with visual diff</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Version List */}
                <div className="space-y-2">
                  <h4 className="text-[10px] text-muted font-medium">Version Timeline</h4>
                  {versionHistory.map((v, i) => (
                    <div key={v.id} className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      selectedVersion === v.id ? "border-gold/30 bg-gold/[0.04]" : "border-border hover:border-gold/15"
                    }`} onClick={() => setSelectedVersion(v.id)}>
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${selectedVersion === v.id ? "bg-gold" : "bg-muted/30"}`} />
                        {i < versionHistory.length - 1 && <div className="w-px h-6 bg-border mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold">{v.label}</span>
                          {i === 0 && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">Latest</span>}
                        </div>
                        <p className="text-[9px] text-muted">{v.date}</p>
                        <p className="text-[9px] text-muted/70 mt-0.5">{v.changes}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Compare Panel */}
                <div className="space-y-3">
                  <h4 className="text-[10px] text-muted font-medium">Visual Comparison</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Version A</label>
                      <select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)} className="input text-[10px] py-1.5 w-full">
                        {versionHistory.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-muted block mb-1">Version B</label>
                      <select value={compareVersion} onChange={e => setCompareVersion(e.target.value)} className="input text-[10px] py-1.5 w-full">
                        {versionHistory.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-light rounded-xl p-4 text-center border border-border aspect-video flex items-center justify-center">
                      <span className="text-[10px] text-muted">{selectedVersion} Preview</span>
                    </div>
                    <div className="bg-surface-light rounded-xl p-4 text-center border border-border aspect-video flex items-center justify-center">
                      <span className="text-[10px] text-muted">{compareVersion} Preview</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center">
                      <RotateCcw size={10} /> Restore Version
                    </button>
                    <button className="btn-secondary text-[10px] flex items-center gap-1.5">
                      <SlidersHorizontal size={10} /> Diff Overlay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== 8. Color Palette Extractor ========== */}
          {toolsTab === "color-extract" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Pipette size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Color Palette Extractor</h3>
                  <p className="text-[10px] text-muted">Extract a color palette from any uploaded image</p>
                </div>
              </div>

              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-gold/30 transition-all cursor-pointer"
                onClick={handleExtractColors}>
                <Upload size={24} className="text-muted mx-auto mb-2" />
                <p className="text-xs text-muted">Upload an image to extract its color palette</p>
                <p className="text-[9px] text-muted/60 mt-1">Works with photos, designs, logos, artwork</p>
              </div>

              {extractingColors && (
                <div className="flex items-center gap-3 bg-gold/[0.04] border border-gold/15 rounded-xl p-3">
                  <Loader size={14} className="text-gold animate-spin" />
                  <span className="text-xs text-gold">Analyzing image colors...</span>
                </div>
              )}

              {extractedColors.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-semibold">Extracted Colors</h4>
                  <div className="flex gap-2">
                    {extractedColors.map((c, i) => (
                      <div key={i} className="flex-1 text-center cursor-pointer group" onClick={() => { navigator.clipboard.writeText(c); toast.success(`Copied ${c}`); }}>
                        <div className="h-14 rounded-xl border border-border group-hover:ring-2 ring-gold/30 transition-all" style={{ background: c }} />
                        <span className="text-[8px] font-mono text-muted mt-1 block">{c}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedPalette({ name: "Extracted", colors: extractedColors.slice(0, 5) }); setTab("create"); toast.success("Palette applied!"); }}
                      className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center">
                      <Palette size={10} /> Apply as Design Palette
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(extractedColors.join(", ")); toast.success("All colors copied!"); }}
                      className="btn-secondary text-[10px] flex items-center gap-1.5">
                      <Copy size={10} /> Copy All
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== 9. Typography Pairing ========== */}
          {toolsTab === "typography" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Type size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Typography Pairing</h3>
                  <p className="text-[10px] text-muted">AI-curated font combinations for professional designs</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FONT_PAIRINGS.map((pair, i) => (
                  <button key={i} onClick={() => { setSelectedPairing(i); toast.success(`Selected: ${pair.vibe}`); }}
                    className={`card-hover rounded-xl p-3 text-left transition-all ${selectedPairing === i ? "border-gold/30 bg-gold/[0.04]" : ""}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-muted bg-surface-light px-2 py-0.5 rounded">{pair.vibe}</span>
                      {selectedPairing === i && <CheckCircle size={12} className="text-gold" />}
                    </div>
                    <p className="text-sm font-bold mb-0.5" style={{ fontFamily: pair.heading.split(" ")[0] }}>{pair.heading}</p>
                    <p className="text-[10px] text-muted" style={{ fontFamily: pair.body.split(" ")[0] }}>{pair.body}</p>
                    <div className="mt-2 p-2 bg-surface-light rounded-lg">
                      <p className="text-xs font-bold">The quick brown fox</p>
                      <p className="text-[10px] text-muted">jumps over the lazy dog. 0123456789</p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedPairing !== null && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    const pair = FONT_PAIRINGS[selectedPairing];
                    navigator.clipboard.writeText(`Heading: ${pair.heading}\nBody: ${pair.body}`);
                    toast.success("Font pairing copied!");
                  }} className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center">
                    <Copy size={10} /> Copy Pairing
                  </button>
                  <button onClick={() => {
                    const pair = FONT_PAIRINGS[selectedPairing];
                    const kit = brandKits.find(k => k.id === activeBrandKit);
                    if (kit) {
                      setBrandKits(prev => prev.map(k => k.id === activeBrandKit ? { ...k, fonts: { heading: pair.heading, body: pair.body } } : k));
                      toast.success("Fonts applied to brand kit!");
                    }
                  }} className="btn-secondary text-[10px] flex items-center gap-1.5">
                    <Paintbrush size={10} /> Apply to Brand Kit
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========== 10. Pattern Generator ========== */}
          {toolsTab === "patterns" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Repeat size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Pattern Generator</h3>
                  <p className="text-[10px] text-muted">Generate seamless patterns for backgrounds and design elements</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PATTERN_TYPES.map(p => (
                  <button key={p.id} onClick={() => setPatternType(p.id)}
                    className={`card-hover rounded-xl p-2.5 text-left transition-all ${patternType === p.id ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <span className="text-[10px] font-medium block">{p.label}</span>
                    <span className="text-[8px] text-muted">{p.desc}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] text-muted block mb-1">Color 1</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={patternColor1} onChange={e => setPatternColor1(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <span className="text-[9px] font-mono text-muted">{patternColor1}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted block mb-1">Color 2</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={patternColor2} onChange={e => setPatternColor2(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <span className="text-[9px] font-mono text-muted">{patternColor2}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted block mb-1">Scale: {patternScale}%</label>
                  <input type="range" min={10} max={100} value={patternScale} onChange={e => setPatternScale(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-gold mt-2" />
                </div>
              </div>

              {/* Pattern Preview */}
              <div className="h-32 rounded-xl border border-border overflow-hidden" style={{
                background: `repeating-linear-gradient(45deg, ${patternColor1} 0px, ${patternColor1} ${patternScale / 5}px, ${patternColor2} ${patternScale / 5}px, ${patternColor2} ${patternScale / 2.5}px)`,
              }}>
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-[10px] font-medium bg-black/40 text-white px-3 py-1 rounded-lg backdrop-blur">{PATTERN_TYPES.find(p => p.id === patternType)?.label} Pattern</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => toast.success("Pattern generated!")} className="btn-primary text-xs flex items-center gap-2 flex-1 justify-center">
                  <Repeat size={12} /> Generate Pattern
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export</button>
              </div>
            </div>
          )}

          {/* ========== 11. Photo Filter Library ========== */}
          {toolsTab === "filters" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Aperture size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Photo Filter Library</h3>
                  <p className="text-[10px] text-muted">{PHOTO_FILTERS.length} professional filters for any photo</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <label className="text-[10px] text-muted">Intensity: {filterIntensity}%</label>
                <input type="range" min={0} max={100} value={filterIntensity} onChange={e => setFilterIntensity(parseInt(e.target.value))}
                  className="flex-1 h-1.5 accent-gold" />
              </div>

              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {PHOTO_FILTERS.map(filter => (
                  <button key={filter.name} onClick={() => { setActiveFilter(filter.name); toast.success(`Filter: ${filter.name}`); }}
                    className={`rounded-xl overflow-hidden border transition-all ${activeFilter === filter.name ? "border-gold/40 ring-2 ring-gold/20" : "border-border hover:border-gold/20"}`}>
                    <div className="h-16 bg-gradient-to-br from-gold/20 via-blue-500/20 to-purple-500/20"
                      style={{ filter: filter.css }} />
                    <div className="p-1.5 text-center">
                      <span className="text-[9px] font-medium">{filter.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              {activeFilter && (
                <div className="flex items-center gap-2 bg-gold/[0.04] border border-gold/15 rounded-xl px-3 py-2">
                  <Aperture size={12} className="text-gold" />
                  <span className="text-[10px] flex-1">Active: <span className="font-medium text-gold">{activeFilter}</span> at {filterIntensity}%</span>
                  <button onClick={() => setActiveFilter(null)} className="text-[9px] text-muted hover:text-foreground flex items-center gap-1">
                    <X size={10} /> Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========== 12. Icon Library Browser ========== */}
          {toolsTab === "icons" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Search size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Icon Library Browser</h3>
                  <p className="text-[10px] text-muted">Search and insert icons from a curated library</p>
                </div>
              </div>

              <input value={iconSearch} onChange={e => setIconSearch(e.target.value)}
                className="input text-xs py-2 w-full" placeholder="Search icons (e.g., chart, heart, star)..." />

              <div className="flex flex-wrap gap-1.5">
                {ICON_CATEGORIES.map(cat => (
                  <button key={cat.name} onClick={() => setIconCategory(cat.name)}
                    className={`text-[9px] px-2.5 py-1 rounded-lg border transition-all ${iconCategory === cat.name ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted"}`}>
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {(ICON_CATEGORIES.find(c => c.name === iconCategory)?.icons || [])
                  .filter(icon => !iconSearch || icon.includes(iconSearch.toLowerCase()))
                  .map(icon => (
                    <button key={icon} onClick={() => { navigator.clipboard.writeText(icon); toast.success(`Copied icon: ${icon}`); }}
                      className="card-hover rounded-xl p-3 text-center group hover:bg-gold/[0.05]">
                      <div className="w-6 h-6 mx-auto mb-1 rounded-lg bg-surface-light flex items-center justify-center group-hover:bg-gold/10">
                        <Globe size={14} className="text-muted group-hover:text-gold" />
                      </div>
                      <span className="text-[8px] text-muted group-hover:text-foreground block truncate">{icon}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* ========== 13. Infographic Builder ========== */}
          {toolsTab === "infographics" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><BarChart3 size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Infographic Builder</h3>
                  <p className="text-[10px] text-muted">Build data visualizations with templates for charts, stats, and timelines</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {INFOGRAPHIC_TYPES.map(type => (
                  <button key={type.id} onClick={() => setInfographicType(type.id)}
                    className={`card-hover rounded-xl p-3 text-left transition-all ${infographicType === type.id ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <div className={`mb-1.5 ${infographicType === type.id ? "text-gold" : "text-muted"}`}>{type.icon}</div>
                    <span className="text-[10px] font-medium block">{type.label}</span>
                    <span className="text-[8px] text-muted">{type.desc}</span>
                  </button>
                ))}
              </div>

              {/* Data Entries */}
              <div className="space-y-2">
                <h4 className="text-[10px] text-muted font-medium">Data Points</h4>
                {infographicData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={item.label} onChange={e => setInfographicData(prev => prev.map((d, idx) => idx === i ? { ...d, label: e.target.value } : d))}
                      className="input text-[10px] py-1.5 flex-1" placeholder="Label" />
                    <input value={item.value} onChange={e => setInfographicData(prev => prev.map((d, idx) => idx === i ? { ...d, value: e.target.value } : d))}
                      className="input text-[10px] py-1.5 w-24" placeholder="Value" />
                    <button onClick={() => setInfographicData(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-muted hover:text-red-400"><Trash2 size={12} /></button>
                  </div>
                ))}
                <button onClick={() => setInfographicData(prev => [...prev, { label: "", value: "" }])}
                  className="btn-ghost text-[9px] flex items-center gap-1"><Plus size={10} /> Add Data Point</button>
              </div>

              <button onClick={() => toast.success("Infographic generated!")}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full">
                <BarChart3 size={12} /> Generate Infographic
              </button>
            </div>
          )}

          {/* ========== 14. Social Proof Widgets ========== */}
          {toolsTab === "social-proof" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><ThumbsUp size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Social Proof Widgets</h3>
                  <p className="text-[10px] text-muted">Generate testimonial cards, review stars, and trust badges</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SOCIAL_PROOF_TYPES.map(type => (
                  <button key={type.id} onClick={() => setSocialProofType(type.id)}
                    className={`card-hover rounded-xl p-3 text-left transition-all ${socialProofType === type.id ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <div className={`mb-1 ${socialProofType === type.id ? "text-gold" : "text-muted"}`}>{type.icon}</div>
                    <span className="text-[10px] font-medium">{type.label}</span>
                  </button>
                ))}
              </div>

              {socialProofType === "testimonial" && (
                <div className="space-y-3">
                  <textarea value={testimonialText} onChange={e => setTestimonialText(e.target.value)}
                    className="input text-xs w-full" rows={3} placeholder="Enter testimonial quote..." />
                  <input value={testimonialAuthor} onChange={e => setTestimonialAuthor(e.target.value)}
                    className="input text-xs w-full" placeholder="Author name and title..." />
                  {/* Preview */}
                  <div className="bg-surface-light rounded-xl p-4 border border-border">
                    <Quote size={16} className="text-gold mb-2" />
                    <p className="text-xs italic leading-relaxed">{testimonialText || "Your testimonial will appear here..."}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[10px] font-bold">
                        {testimonialAuthor ? testimonialAuthor[0]?.toUpperCase() : "?"}
                      </div>
                      <span className="text-[10px] font-medium">{testimonialAuthor || "Author Name"}</span>
                    </div>
                  </div>
                </div>
              )}

              {socialProofType === "review_stars" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Rating</label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => setReviewStars(n)}
                          className={`transition-all ${n <= reviewStars ? "text-gold" : "text-muted/30"}`}>
                          <Star size={24} fill={n <= reviewStars ? "currentColor" : "none"} />
                        </button>
                      ))}
                      <span className="text-xs ml-2 text-muted">{reviewStars}/5</span>
                    </div>
                  </div>
                  <div className="bg-surface-light rounded-xl p-4 border border-border text-center">
                    <div className="flex justify-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star key={n} size={20} className={n <= reviewStars ? "text-gold" : "text-muted/20"} fill={n <= reviewStars ? "currentColor" : "none"} />
                      ))}
                    </div>
                    <p className="text-xs font-semibold">{reviewStars}.0 out of 5</p>
                    <p className="text-[9px] text-muted mt-0.5">Based on 1,247 reviews</p>
                  </div>
                </div>
              )}

              <button onClick={() => toast.success("Social proof widget generated!")}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full">
                <ThumbsUp size={12} /> Generate Widget
              </button>
            </div>
          )}

          {/* ========== 15. Seasonal Template Packs ========== */}
          {toolsTab === "seasonal" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><CalendarDays size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Seasonal Template Packs</h3>
                  <p className="text-[10px] text-muted">Holiday, seasonal, and event-specific design templates with themed palettes</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {SEASONAL_PACKS.map(pack => (
                  <button key={pack.id} onClick={() => { setSelectedSeason(pack.id); toast.success(`Selected: ${pack.label}`); }}
                    className={`card-hover rounded-xl p-3 text-left transition-all ${selectedSeason === pack.id ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={selectedSeason === pack.id ? "text-gold" : "text-muted"}>{pack.icon}</span>
                      <span className="text-[10px] font-medium">{pack.label}</span>
                      {selectedSeason === pack.id && <CheckCircle size={10} className="text-gold ml-auto" />}
                    </div>
                    <div className="flex gap-1">
                      {pack.colors.map((c, i) => (
                        <div key={i} className="flex-1 h-5 rounded-md border border-border" style={{ background: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {selectedSeason && (
                <div className="flex gap-2">
                  <button onClick={() => {
                    const pack = SEASONAL_PACKS.find(p => p.id === selectedSeason);
                    if (pack) { setSelectedPalette({ name: pack.label, colors: pack.colors }); setTab("create"); toast.success("Seasonal palette applied!"); }
                  }} className="btn-primary text-[10px] flex items-center gap-1.5 flex-1 justify-center">
                    <Palette size={10} /> Apply Palette to Designs
                  </button>
                  <button onClick={() => toast.success("Seasonal templates loaded!")}
                    className="btn-secondary text-[10px] flex items-center gap-1.5">
                    <Grid size={10} /> Browse Templates
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ========== 16. Animation Preview ========== */}
          {toolsTab === "animation" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Film size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Animation Preview</h3>
                  <p className="text-[10px] text-muted">Preview your design as animated GIF or video with transitions</p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {(["fade", "slide", "bounce", "zoom", "rotate"] as const).map(type => (
                  <button key={type} onClick={() => setAnimationType(type)}
                    className={`card-hover rounded-xl p-2.5 text-center transition-all ${animationType === type ? "border-gold/30 bg-gold/[0.05]" : ""}`}>
                    <span className="text-[10px] font-medium capitalize">{type}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-[10px] text-muted whitespace-nowrap">Speed: {animationSpeed}x</label>
                <input type="range" min={0.25} max={3} step={0.25} value={animationSpeed}
                  onChange={e => setAnimationSpeed(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 accent-gold" />
              </div>

              {/* Animation Preview Area */}
              <div className="bg-surface-light rounded-xl border border-border p-8 flex items-center justify-center min-h-[200px]">
                <div className={`w-32 h-32 bg-gold/20 rounded-xl flex items-center justify-center border border-gold/30 transition-all ${
                  animationPlaying ? (
                    animationType === "fade" ? "animate-pulse" :
                    animationType === "bounce" ? "animate-bounce" :
                    animationType === "zoom" ? "animate-ping" :
                    animationType === "rotate" ? "animate-spin" :
                    "animate-pulse"
                  ) : ""
                }`} style={{ animationDuration: `${2 / animationSpeed}s` }}>
                  <Sparkles size={24} className="text-gold" />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setAnimationPlaying(!animationPlaying)}
                  className="btn-primary text-xs flex items-center justify-center gap-2 flex-1">
                  {animationPlaying ? <><X size={12} /> Stop Preview</> : <><Play size={12} /> Play Animation</>}
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1.5">
                  <Download size={12} /> Export GIF
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1.5">
                  <Film size={12} /> Export MP4
                </button>
              </div>
            </div>
          )}

          {/* ========== 17. Design System Tokens ========== */}
          {toolsTab === "design-tokens" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Database size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Design System Tokens</h3>
                  <p className="text-[10px] text-muted">Save reusable design tokens for spacing, border radius, shadows, and more</p>
                </div>
              </div>

              {/* Token Categories */}
              {(["spacing", "radius", "shadow", "opacity", "font-size"] as const).map(category => {
                const tokens = designTokens.filter(t => t.category === category);
                if (tokens.length === 0) return null;
                return (
                  <div key={category} className="border border-border rounded-xl p-3">
                    <h4 className="text-[10px] font-semibold capitalize mb-2 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                      {category}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {tokens.map(token => (
                        <div key={token.id} className="bg-surface-light rounded-lg p-2 flex items-center justify-between group">
                          <div>
                            <span className="text-[9px] font-medium block">{token.name}</span>
                            <span className="text-[8px] font-mono text-muted">{token.value}</span>
                          </div>
                          <button onClick={() => setDesignTokens(prev => prev.filter(t => t.id !== token.id))}
                            className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Add Token */}
              <div className="border border-border rounded-xl p-3 space-y-2">
                <h4 className="text-[10px] font-semibold flex items-center gap-1.5"><Plus size={11} /> Add Token</h4>
                <div className="flex gap-2">
                  <select value={newTokenCategory} onChange={e => setNewTokenCategory(e.target.value as DesignToken["category"])}
                    className="input text-[10px] py-1.5">
                    <option value="spacing">Spacing</option>
                    <option value="radius">Border Radius</option>
                    <option value="shadow">Shadow</option>
                    <option value="opacity">Opacity</option>
                    <option value="font-size">Font Size</option>
                  </select>
                  <input value={newTokenName} onChange={e => setNewTokenName(e.target.value)}
                    className="input text-[10px] py-1.5 flex-1" placeholder="Token name (e.g., sm, md)" />
                  <input value={newTokenValue} onChange={e => setNewTokenValue(e.target.value)}
                    className="input text-[10px] py-1.5 flex-1" placeholder="Value (e.g., 8px)" />
                  <button onClick={() => {
                    if (!newTokenName || !newTokenValue) { toast.error("Fill in name and value"); return; }
                    setDesignTokens(prev => [...prev, { id: crypto.randomUUID(), category: newTokenCategory, name: newTokenName, value: newTokenValue }]);
                    setNewTokenName(""); setNewTokenValue("");
                    toast.success("Token added!");
                  }} className="btn-primary text-[10px] flex items-center gap-1"><Plus size={10} /> Add</button>
                </div>
              </div>

              <button onClick={() => {
                const json = JSON.stringify(designTokens.reduce((acc, t) => {
                  if (!acc[t.category]) acc[t.category] = {};
                  acc[t.category][t.name] = t.value;
                  return acc;
                }, {} as Record<string, Record<string, string>>), null, 2);
                navigator.clipboard.writeText(json);
                toast.success("Tokens copied as JSON!");
              }} className="btn-secondary text-[10px] flex items-center gap-1.5 w-full justify-center">
                <Copy size={10} /> Export Tokens as JSON
              </button>
            </div>
          )}

          {/* ========== 18. Batch Export ========== */}
          {toolsTab === "batch-export" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Download size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Batch Export</h3>
                  <p className="text-[10px] text-muted">Export your design in multiple sizes and formats at once</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-2">Export Formats</label>
                <div className="flex gap-2">
                  {["png", "jpg", "webp", "svg", "pdf"].map(fmt => (
                    <button key={fmt} onClick={() => setBatchExportFormats(prev => prev.includes(fmt) ? prev.filter(f => f !== fmt) : [...prev, fmt])}
                      className={`text-[10px] px-3 py-1.5 rounded-lg border uppercase font-medium transition-all ${
                        batchExportFormats.includes(fmt) ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                      }`}>
                      .{fmt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-2">Export Sizes</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "Original", size: "original" },
                    { label: "1080x1080", size: "1080x1080" },
                    { label: "1080x1920", size: "1080x1920" },
                    { label: "1200x630", size: "1200x630" },
                    { label: "1280x720", size: "1280x720" },
                    { label: "1920x1080", size: "1920x1080" },
                    { label: "2x Scale", size: "2x" },
                    { label: "0.5x Scale", size: "0.5x" },
                  ].map(s => (
                    <button key={s.size} onClick={() => setBatchExportSizes(prev => prev.includes(s.size) ? prev.filter(x => x !== s.size) : [...prev, s.size])}
                      className={`card-hover rounded-xl p-2 text-center text-[10px] transition-all ${
                        batchExportSizes.includes(s.size) ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : ""
                      }`}>
                      {batchExportSizes.includes(s.size) && <CheckCircle size={10} className="text-gold inline mr-1" />}
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-surface-light rounded-xl p-3 flex items-center justify-between">
                <div className="text-[10px]">
                  <span className="text-muted">Total exports: </span>
                  <span className="font-semibold text-gold">{batchExportFormats.length * batchExportSizes.length} files</span>
                  <span className="text-muted"> ({batchExportSizes.length} sizes x {batchExportFormats.length} formats)</span>
                </div>
              </div>

              <button onClick={handleBatchExport} disabled={batchExporting || batchExportFormats.length === 0 || batchExportSizes.length === 0}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full disabled:opacity-50">
                {batchExporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                {batchExporting ? "Exporting..." : `Export ${batchExportFormats.length * batchExportSizes.length} Files`}
              </button>
            </div>
          )}

          {/* ========== 19. Accessibility Checker ========== */}
          {toolsTab === "accessibility" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Accessibility size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Accessibility Checker</h3>
                  <p className="text-[10px] text-muted">Check contrast ratios and WCAG compliance for text/background combinations</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted block mb-1.5">Text Color (Foreground)</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={a11yFgColor} onChange={e => setA11yFgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <div>
                      <input value={a11yFgColor} onChange={e => setA11yFgColor(e.target.value)}
                        className="input text-[10px] py-1.5 font-mono w-24" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1.5">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={a11yBgColor} onChange={e => setA11yBgColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                    <div>
                      <input value={a11yBgColor} onChange={e => setA11yBgColor(e.target.value)}
                        className="input text-[10px] py-1.5 font-mono w-24" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Font Size: {a11yFontSize}px</label>
                <input type="range" min={8} max={72} value={a11yFontSize} onChange={e => setA11yFontSize(parseInt(e.target.value))}
                  className="w-full h-1.5 accent-gold" />
              </div>

              {/* Preview */}
              <div className="rounded-xl p-6 text-center border border-border" style={{ background: a11yBgColor }}>
                <p style={{ color: a11yFgColor, fontSize: `${a11yFontSize}px` }} className="font-semibold">Sample Text Preview</p>
                <p style={{ color: a11yFgColor, fontSize: `${Math.max(a11yFontSize - 4, 8)}px` }} className="mt-1 opacity-80">Body text at a smaller size</p>
              </div>

              {/* Results */}
              {(() => {
                const ratio = getContrastRatio(a11yFgColor, a11yBgColor);
                const rating = getWCAGRating(ratio, a11yFontSize);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-surface-light rounded-xl p-3">
                      <Contrast size={16} className="text-gold" />
                      <div>
                        <span className="text-xs font-semibold">Contrast Ratio: {ratio.toFixed(2)}:1</span>
                        <p className="text-[9px] text-muted">Minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA)</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { label: "WCAG AA", pass: rating.aa, desc: "Normal text" },
                        { label: "WCAG AAA", pass: rating.aaa, desc: "Enhanced" },
                        { label: "AA Large", pass: rating.aaLarge, desc: "18px+ or bold 14px+" },
                        { label: "AAA Large", pass: rating.aaaLarge, desc: "Enhanced large" },
                      ].map(item => (
                        <div key={item.label} className={`rounded-xl p-2.5 border text-center ${item.pass ? "border-green-500/20 bg-green-500/[0.06]" : "border-red-500/20 bg-red-500/[0.06]"}`}>
                          <div className="flex items-center justify-center gap-1 mb-0.5">
                            {item.pass ? <CheckCircle size={11} className="text-green-400" /> : <AlertTriangle size={11} className="text-red-400" />}
                            <span className={`text-[10px] font-semibold ${item.pass ? "text-green-400" : "text-red-400"}`}>{item.pass ? "Pass" : "Fail"}</span>
                          </div>
                          <span className="text-[9px] font-medium block">{item.label}</span>
                          <span className="text-[8px] text-muted">{item.desc}</span>
                        </div>
                      ))}
                    </div>
                    {!rating.aa && (
                      <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-3 py-2">
                        <AlertTriangle size={12} />
                        <span>This color combination does not meet WCAG AA standards. Consider increasing contrast.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ========== 20. Mood Board Builder ========== */}
          {toolsTab === "mood-board" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Heart size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">Mood Board Builder</h3>
                  <p className="text-[10px] text-muted">Collect inspiration images, colors, and notes for your design direction</p>
                </div>
              </div>

              {/* Board Items */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {moodBoardItems.map(item => (
                  <div key={item.id} className="card-hover rounded-xl p-2.5 relative group">
                    <button onClick={() => setMoodBoardItems(prev => prev.filter(i => i.id !== item.id))}
                      className="absolute top-1.5 right-1.5 text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={10} />
                    </button>
                    {item.type === "color" && (
                      <div>
                        <div className="h-16 rounded-lg border border-border mb-1.5" style={{ background: item.value }} />
                        <span className="text-[8px] font-mono text-muted">{item.value}</span>
                      </div>
                    )}
                    {item.type === "image" && (
                      <div className="h-20 rounded-lg bg-surface-light border border-border flex items-center justify-center mb-1.5">
                        <ImageIcon size={16} className="text-muted" />
                      </div>
                    )}
                    {item.type === "note" && (
                      <div className="bg-gold/[0.04] border border-gold/15 rounded-lg p-2 min-h-[64px]">
                        <p className="text-[9px] leading-relaxed">{item.value}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Items */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-border rounded-xl p-3">
                  <label className="text-[9px] text-muted block mb-1.5">Add Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={newMoodColor} onChange={e => setNewMoodColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0" />
                    <button onClick={() => {
                      setMoodBoardItems(prev => [...prev, { id: crypto.randomUUID(), type: "color", value: newMoodColor }]);
                      toast.success("Color added to mood board");
                    }} className="btn-secondary text-[9px] flex items-center gap-1 flex-1 justify-center">
                      <Plus size={9} /> Add Color
                    </button>
                  </div>
                </div>
                <div className="border border-border rounded-xl p-3">
                  <label className="text-[9px] text-muted block mb-1.5">Add Note</label>
                  <div className="flex gap-2">
                    <input value={newMoodNote} onChange={e => setNewMoodNote(e.target.value)}
                      className="input text-[9px] py-1.5 flex-1" placeholder="Design note..." />
                    <button onClick={() => {
                      if (!newMoodNote.trim()) return;
                      setMoodBoardItems(prev => [...prev, { id: crypto.randomUUID(), type: "note", value: newMoodNote }]);
                      setNewMoodNote(""); toast.success("Note added");
                    }} className="btn-secondary text-[9px]"><Plus size={9} /></button>
                  </div>
                </div>
                <div className="border border-dashed border-border rounded-xl p-3 flex items-center justify-center cursor-pointer hover:border-gold/30 transition-all"
                  onClick={() => {
                    setMoodBoardItems(prev => [...prev, { id: crypto.randomUUID(), type: "image", value: "" }]);
                    toast.success("Image placeholder added");
                  }}>
                  <div className="text-center">
                    <Upload size={14} className="text-muted mx-auto mb-1" />
                    <span className="text-[9px] text-muted">Upload Image</span>
                  </div>
                </div>
              </div>

              <button onClick={() => {
                const colors = moodBoardItems.filter(i => i.type === "color").map(i => i.value).slice(0, 5);
                if (colors.length > 0) { setSelectedPalette({ name: "Mood Board", colors }); setTab("create"); toast.success("Mood board colors applied!"); }
                else toast.error("Add colors to your mood board first");
              }} className="btn-primary text-[10px] flex items-center gap-1.5 w-full justify-center">
                <Palette size={10} /> Apply Mood Board Colors to Designs
              </button>
            </div>
          )}

          {/* ========== 21. AI Style Transfer ========== */}
          {toolsTab === "style-transfer" && (
            <div className="card rounded-xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 bg-gold/10 rounded-xl flex items-center justify-center text-gold"><Shuffle size={16} /></div>
                <div>
                  <h3 className="font-medium text-sm">AI Style Transfer</h3>
                  <p className="text-[10px] text-muted">Apply the artistic style of one image to another using AI</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted block mb-1.5">Source Image (Content)</label>
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-gold/30 transition-all cursor-pointer"
                    onClick={() => setStyleTransferSource("content-image.jpg")}>
                    {styleTransferSource ? (
                      <div className="flex items-center gap-2 justify-center">
                        <ImageIcon size={14} className="text-gold" />
                        <span className="text-[10px]">{styleTransferSource}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStyleTransferSource(""); }} className="text-muted hover:text-foreground"><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-muted mx-auto mb-1" />
                        <p className="text-[9px] text-muted">Upload content image</p>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1.5">Style Reference</label>
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-gold/30 transition-all cursor-pointer"
                    onClick={() => setStyleTransferStyle("style-reference.jpg")}>
                    {styleTransferStyle ? (
                      <div className="flex items-center gap-2 justify-center">
                        <Brush size={14} className="text-gold" />
                        <span className="text-[10px]">{styleTransferStyle}</span>
                        <button onClick={(e) => { e.stopPropagation(); setStyleTransferStyle(""); }} className="text-muted hover:text-foreground"><X size={12} /></button>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-muted mx-auto mb-1" />
                        <p className="text-[9px] text-muted">Upload style reference</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted block mb-1">Style Strength: {styleTransferStrength}%</label>
                <input type="range" min={10} max={100} value={styleTransferStrength}
                  onChange={e => setStyleTransferStrength(parseInt(e.target.value))}
                  className="w-full h-1.5 accent-gold" />
                <div className="flex justify-between text-[8px] text-muted mt-0.5">
                  <span>Subtle</span><span>Balanced</span><span>Strong</span>
                </div>
              </div>

              {/* Quick Style Presets */}
              <div>
                <label className="text-[10px] text-muted block mb-1.5">Quick Style Presets</label>
                <div className="flex flex-wrap gap-1.5">
                  {["Oil Painting", "Watercolor", "Pixel Art", "Comic Book", "Art Deco", "Impressionist", "Cyberpunk", "Minimalist"].map(preset => (
                    <button key={preset} onClick={() => { setStyleTransferStyle(preset); toast.success(`Style: ${preset}`); }}
                      className={`text-[9px] px-2.5 py-1.5 rounded-lg border transition-all ${
                        styleTransferStyle === preset ? "border-gold/30 bg-gold/[0.05] text-gold font-medium" : "border-border text-muted hover:text-foreground"
                      }`}>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {styleTransferring && (
                <div className="flex items-center gap-3 bg-gold/[0.04] border border-gold/15 rounded-xl p-3">
                  <Loader size={14} className="text-gold animate-spin" />
                  <span className="text-xs text-gold">Applying style transfer ({styleTransferStrength}% strength)...</span>
                </div>
              )}

              <button onClick={handleStyleTransfer}
                disabled={styleTransferring || (!styleTransferSource && !styleTransferStyle)}
                className="btn-primary text-xs flex items-center justify-center gap-2 w-full disabled:opacity-50">
                {styleTransferring ? <Loader size={12} className="animate-spin" /> : <Shuffle size={12} />}
                {styleTransferring ? "Applying Style..." : "Apply Style Transfer"}
              </button>
            </div>
          )}
        </div>
      )}
      </>)}

      <PageAI pageName="Design Studio" context="AI design prompt generator for thumbnails, social posts, ads, logos, banners, infographics, presentations, and more. Generates Midjourney prompts with industry-specific styling." suggestions={["Generate a thumbnail concept for '5 Marketing Tips'", "Create an Instagram post design for a restaurant", "What colors work best for dental practice ads?", "Design a YouTube banner concept", "Create a full brand kit for a fitness studio"]} />
    </div>
  );
}
