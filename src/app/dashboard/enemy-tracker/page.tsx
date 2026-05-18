"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Play,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Bookmark,
  Copy,
  Wand2,
  FolderPlus,
  X,
  RefreshCw,
  Flame,
  TrendingUp,
  Clock,
  CheckCircle,
  Sparkles,
  BarChart3,
  ArrowUpRight,
  Users,
  Mic,
  Loader2,
  Search,
  ChevronDown,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────────────────────────

type Platform = "all" | "tiktok" | "instagram" | "youtube" | "x";

interface ViralContent {
  id: string;
  platform: Exclude<Platform, "all">;
  creator: {
    username: string;
    displayName: string;
    followers: number;
    verified: boolean;
    avatarSeed: string;
  };
  content: {
    type: "video" | "image" | "carousel";
    thumbnailSeed: string;
    title: string;
    caption: string;
    duration?: number;
  };
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  };
  viralScore: number;
  clientScore: number;
  postedAt: string;
  hooks: string[];
  whyViral: string;
  niche: string;
  transcript: string;
}

interface Competitor {
  id: string;
  name: string;
  handle: string;
  platform: Exclude<Platform, "all">;
  followers: number;
  niche: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<
  Exclude<Platform, "all">,
  { label: string; color: string; bg: string; border: string }
> = {
  tiktok: {
    label: "TikTok",
    color: "#69C9D0",
    bg: "rgba(105,201,208,0.15)",
    border: "rgba(105,201,208,0.35)",
  },
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    bg: "rgba(225,48,108,0.15)",
    border: "rgba(225,48,108,0.35)",
  },
  youtube: {
    label: "YouTube",
    color: "#FF0000",
    bg: "rgba(255,0,0,0.15)",
    border: "rgba(255,0,0,0.35)",
  },
  x: {
    label: "X / Twitter",
    color: "#A8B3C5",
    bg: "rgba(168,179,197,0.15)",
    border: "rgba(168,179,197,0.35)",
  },
};

const MOCK_FEED: ViralContent[] = [
  {
    id: "v1",
    platform: "tiktok",
    creator: {
      username: "alexfit_official",
      displayName: "Alex Fitness",
      followers: 2_400_000,
      verified: true,
      avatarSeed: "alex",
    },
    content: {
      type: "video",
      thumbnailSeed: "workout",
      title: "I worked out every day for 30 days",
      caption:
        "The results shocked me 😱 Full breakdown below 👇 #fitness #30daychallenge #transformation",
      duration: 47,
    },
    metrics: {
      views: 14_200_000,
      likes: 982_000,
      comments: 45_200,
      shares: 234_000,
      saves: 567_000,
    },
    viralScore: 94,
    clientScore: 81,
    postedAt: "2 days ago",
    hooks: [
      "I tried X for Y days — results inside",
      "Before vs After reveal",
      "Curiosity gap opening",
    ],
    whyViral:
      "Combines the high-performing 'challenge result' format with transformation content (top-save category on TikTok). Posted Monday 7 AM—peak intent window for fitness.",
    niche: "fitness",
    transcript:
      "Day 1: I weigh 187 lbs and I feel terrible about it. Day 15: Something starts clicking — I'm actually looking forward to this. Day 30: Down 12 lbs, energy through the roof. Here's the exact routine...",
  },
  {
    id: "v2",
    platform: "instagram",
    creator: {
      username: "businesswithsarah",
      displayName: "Sarah Chen",
      followers: 890_000,
      verified: false,
      avatarSeed: "sarah",
    },
    content: {
      type: "carousel",
      thumbnailSeed: "business",
      title: "5 things successful founders do before 8am",
      caption:
        "Save this for tomorrow morning ☀️ Slide 2 is the one nobody talks about #entrepreneur #morningroutine #productivity",
      duration: undefined,
    },
    metrics: {
      views: 3_100_000,
      likes: 187_000,
      comments: 8_900,
      shares: 94_000,
      saves: 412_000,
    },
    viralScore: 88,
    clientScore: 73,
    postedAt: "4 days ago",
    hooks: [
      "Save this for tomorrow",
      "The one thing nobody talks about",
      "List-based authority content",
    ],
    whyViral:
      "Carousel format drives 3x more saves than single images on Instagram. 'Nobody talks about this' creates curiosity. High-save content gets pushed to Explore repeatedly.",
    niche: "business",
    transcript:
      "Slide 1: They block 2 hours before email. Slide 2: They review their top 3 priorities the night before — not in the morning. Most people make this mistake backwards...",
  },
  {
    id: "v3",
    platform: "youtube",
    creator: {
      username: "mkbhd",
      displayName: "Marques Brownlee",
      followers: 18_700_000,
      verified: true,
      avatarSeed: "mkbhd",
    },
    content: {
      type: "video",
      thumbnailSeed: "tech",
      title: "I tested every AI tool for 90 days — here's the truth",
      caption:
        "Most of these are completely overhyped. A few changed how I work forever.",
      duration: 1842,
    },
    metrics: {
      views: 6_800_000,
      likes: 312_000,
      comments: 28_700,
      shares: 145_000,
      saves: 89_000,
    },
    viralScore: 91,
    clientScore: 67,
    postedAt: "1 week ago",
    hooks: [
      "I tested X for Y days",
      "Most are overhyped — contrast hook",
      "Long-form authority review",
    ],
    whyViral:
      "YouTube rewards watch time. Structured long-form review with timestamp chapters keeps retention above 65%. 'Truth' positioning creates trust before the video starts.",
    niche: "tech",
    transcript:
      "I've spent 90 days testing 47 different AI tools. Here's my honest breakdown: ChatGPT is still the best at writing. Midjourney blows everything else away for images. But for business workflows, there are three nobody talks about...",
  },
  {
    id: "v4",
    platform: "tiktok",
    creator: {
      username: "chefmarcello",
      displayName: "Chef Marcello",
      followers: 4_100_000,
      verified: true,
      avatarSeed: "chef",
    },
    content: {
      type: "video",
      thumbnailSeed: "food",
      title: "POV: You learned this pasta trick in Italy",
      caption:
        "Your pasta will never be the same 🍝 The secret is in the water #cooking #italian #foodtok",
      duration: 32,
    },
    metrics: {
      views: 22_400_000,
      likes: 1_840_000,
      comments: 67_300,
      shares: 890_000,
      saves: 1_200_000,
    },
    viralScore: 98,
    clientScore: 85,
    postedAt: "3 days ago",
    hooks: [
      "POV: you learned [skill] in [place]",
      "Your X will never be the same",
      "Secret/insider knowledge reveal",
    ],
    whyViral:
      "POV format creates immediate immersion. 'Secret' framing triggers urgency to save. Short duration (32s) means 80%+ completion rate. Food content consistently tops all-platform shares.",
    niche: "food",
    transcript:
      "The secret: never add oil to your pasta water. That's a myth. But do add a handful of pasta water to your sauce at the end. The starch binds everything and creates that silky restaurant texture...",
  },
  {
    id: "v5",
    platform: "x",
    creator: {
      username: "levelsio",
      displayName: "Pieter Levels",
      followers: 520_000,
      verified: true,
      avatarSeed: "pieter",
    },
    content: {
      type: "image",
      thumbnailSeed: "code",
      title: "Built 12 startups in 12 months — here's what happened",
      caption:
        "Thread: I shipped 12 startups this year. 2 failed immediately. 3 are making $0. 2 broke even. 4 are profitable. 1 does $85k MRR.\n\nHere's exactly what I learned (long thread) 👇",
      duration: undefined,
    },
    metrics: {
      views: 4_200_000,
      likes: 89_000,
      comments: 12_400,
      shares: 67_000,
      saves: 0,
    },
    viralScore: 87,
    clientScore: 62,
    postedAt: "5 days ago",
    hooks: [
      "Transparent income/result breakdown",
      "Thread format (high retweet gravity)",
      "Specific numbers create credibility",
    ],
    whyViral:
      "Exact revenue figures make the claim verifiable. Thread format incentivizes quote-tweets and replies. Failure/success ratio story arc is irresistible.",
    niche: "business",
    transcript:
      "Startup 1: Nomad rental aggregator. Built in 3 weeks. $0 revenue. Startup 4: AI headshot generator. Built in 2 days. $12K MRR month 1. The difference wasn't the idea — it was the distribution...",
  },
  {
    id: "v6",
    platform: "instagram",
    creator: {
      username: "minimalismwithkai",
      displayName: "Kai Norden",
      followers: 1_200_000,
      verified: false,
      avatarSeed: "kai",
    },
    content: {
      type: "video",
      thumbnailSeed: "lifestyle",
      title: "I own 47 things. Here's my apartment",
      caption:
        "People think I'm crazy. I think I've never been happier. #minimalism #intentionalliving #owningless",
      duration: 68,
    },
    metrics: {
      views: 8_900_000,
      likes: 634_000,
      comments: 91_200,
      shares: 312_000,
      saves: 445_000,
    },
    viralScore: 92,
    clientScore: 70,
    postedAt: "6 days ago",
    hooks: [
      "Controversy statement ('people think I'm crazy')",
      "Specific exact number (47)",
      "Tour/reveal format",
    ],
    whyViral:
      "Controversy hooks drive comments (algorithm signal). Specific numbers (47 not ~50) create believability. 'Tour' format satisfies curiosity and drives completion rate above 70%.",
    niche: "lifestyle",
    transcript:
      "This is everything I own. A bed. A desk. A chair. Two sets of clothes. A laptop. 43 other items. The first thing people ask is: what about when you need something? I rent it. Or borrow it. I stopped buying things two years ago and here's what I found...",
  },
  {
    id: "v7",
    platform: "tiktok",
    creator: {
      username: "drmayahealth",
      displayName: "Dr. Maya Health",
      followers: 3_200_000,
      verified: true,
      avatarSeed: "drmaya",
    },
    content: {
      type: "video",
      thumbnailSeed: "health",
      title: "3 supplements cardiologists actually take",
      caption:
        "As a cardiologist I only recommend what I personally use 🫀 #cardiology #supplements #healthtips",
      duration: 41,
    },
    metrics: {
      views: 18_700_000,
      likes: 1_340_000,
      comments: 88_400,
      shares: 672_000,
      saves: 920_000,
    },
    viralScore: 97,
    clientScore: 79,
    postedAt: "1 day ago",
    hooks: [
      "Expert reveals what [profession] actually uses",
      "Authority + insider access",
      "Top-save health category",
    ],
    whyViral:
      "Health content from verified professionals gets 4x more saves than generic health advice. 'Actually' implies insider truth vs. public advice. Supplements is the highest-save sub-niche in health.",
    niche: "health",
    transcript:
      "Number one: Magnesium glycinate — most Americans are deficient and it directly affects heart rhythm. Number two: Omega-3s, but only triglyceride form, not ethyl ester. Most supplements on Amazon are ethyl ester. Number three might surprise you...",
  },
  {
    id: "v8",
    platform: "youtube",
    creator: {
      username: "neilpatel",
      displayName: "Neil Patel",
      followers: 1_040_000,
      verified: true,
      avatarSeed: "neil",
    },
    content: {
      type: "video",
      thumbnailSeed: "marketing",
      title: "This SEO strategy got 2M visitors in 90 days",
      caption:
        "The exact playbook — no fluff, no courses to sell.",
      duration: 924,
    },
    metrics: {
      views: 1_820_000,
      likes: 78_400,
      comments: 9_200,
      shares: 41_000,
      saves: 23_000,
    },
    viralScore: 83,
    clientScore: 88,
    postedAt: "2 weeks ago",
    hooks: [
      "Exact result + time frame",
      "Anti-pitch credibility signal",
      "Case study format",
    ],
    whyViral:
      "Specific result (2M, 90 days) creates believability. 'No fluff, no courses' disarms sales resistance. Business/marketing audience is high-intent and watches till the end.",
    niche: "business",
    transcript:
      "Step 1: We identified 400 keywords with 1,000-10,000 monthly searches and less than 40 domain authority competition. Step 2: We created one piece of content per keyword in under 48 hours using this exact template...",
  },
  {
    id: "v9",
    platform: "instagram",
    creator: {
      username: "designwithzara",
      displayName: "Zara Okafor",
      followers: 567_000,
      verified: false,
      avatarSeed: "zara",
    },
    content: {
      type: "carousel",
      thumbnailSeed: "design",
      title: "Color palettes that print agencies don't want you to know",
      caption:
        "Slide 4 is the one I use on every client project now 🎨 Save this #graphicdesign #colortheory #designtips",
      duration: undefined,
    },
    metrics: {
      views: 2_100_000,
      likes: 143_000,
      comments: 6_700,
      shares: 78_000,
      saves: 298_000,
    },
    viralScore: 86,
    clientScore: 74,
    postedAt: "3 days ago",
    hooks: [
      "Industry doesn't want you to know",
      "Specific slide teaser ('slide 4')",
      "Save-bait utility content",
    ],
    whyViral:
      "Curiosity gap ('they don't want you to know') drives shares. Slide teaser creates reason to swipe through entire carousel. High save/view ratio boosts Explore placement.",
    niche: "design",
    transcript:
      "Palette 1: 87% of top-performing brands use a 60-30-10 split. Palette 4 — the one I use for every client: split-complementary with a muted base. Here are the exact hex codes...",
  },
  {
    id: "v10",
    platform: "tiktok",
    creator: {
      username: "crypto_realist",
      displayName: "Marcus Crypto",
      followers: 780_000,
      verified: false,
      avatarSeed: "marcus",
    },
    content: {
      type: "video",
      thumbnailSeed: "finance",
      title: "How I turned $500 into $47,000 in 8 months",
      caption:
        "No BS, no speculation. Here's the actual strategy I used 📈 #crypto #investing #financefreedom",
      duration: 89,
    },
    metrics: {
      views: 9_400_000,
      likes: 456_000,
      comments: 124_000,
      shares: 289_000,
      saves: 334_000,
    },
    viralScore: 89,
    clientScore: 58,
    postedAt: "1 week ago",
    hooks: [
      "Specific dollar transformation",
      "Anti-hype credibility frame",
      "High-comment controversy topic",
    ],
    whyViral:
      "Finance transformation hooks consistently top all platforms. Exact numbers (not round) create believability. Controversy (crypto) drives comments which signals to algorithm.",
    niche: "finance",
    transcript:
      "January 2024: $500 in. Strategy: I only bought assets with active GitHub commits and real developer activity. I ignored price. Here's how I evaluated each one...",
  },
  {
    id: "v11",
    platform: "instagram",
    creator: {
      username: "sophiabakes",
      displayName: "Sophia Bakes",
      followers: 2_800_000,
      verified: true,
      avatarSeed: "sophia",
    },
    content: {
      type: "video",
      thumbnailSeed: "baking",
      title: "No-knead bread that looks impossible",
      caption:
        "4 ingredients. 0 skill required. Baked this 100 times. Never fails. #bread #baking #easyrecipes",
      duration: 55,
    },
    metrics: {
      views: 11_200_000,
      likes: 820_000,
      comments: 34_200,
      shares: 560_000,
      saves: 890_000,
    },
    viralScore: 96,
    clientScore: 82,
    postedAt: "5 days ago",
    hooks: [
      "Looks impossible / impossibly easy paradox",
      "Minimal ingredient count",
      "Social proof ('never fails')",
    ],
    whyViral:
      "Food how-tos are the highest-save content on Instagram. 4 ingredients signals accessibility. 'Never fails' removes the fear of trying. Short enough to complete, detailed enough to be useful.",
    niche: "food",
    transcript:
      "3 cups flour. 1.5 tsp salt. 0.5 tsp instant yeast. 1.5 cups water. Mix. Cover. Wait 12 hours. Here's the trick for that crust — you need a dutch oven and you need to preheat it. This is the only step where people go wrong...",
  },
  {
    id: "v12",
    platform: "youtube",
    creator: {
      username: "vanessalau",
      displayName: "Vanessa Lau",
      followers: 740_000,
      verified: true,
      avatarSeed: "vanessa",
    },
    content: {
      type: "video",
      thumbnailSeed: "social_media",
      title: "How I grew from 0 to 100K in 6 months (the real way)",
      caption:
        "I'm sharing my actual analytics, my posting schedule, and the ONE thing that changed everything.",
      duration: 1247,
    },
    metrics: {
      views: 2_400_000,
      likes: 98_700,
      comments: 14_300,
      shares: 52_000,
      saves: 31_000,
    },
    viralScore: 84,
    clientScore: 91,
    postedAt: "3 weeks ago",
    hooks: [
      "Real analytics transparency",
      "The ONE thing framework",
      "Milestone reveal (0 to X)",
    ],
    whyViral:
      "Growth content is evergreen on YouTube — people search for it monthly. Transparency (actual analytics) earns trust. 'The one thing' creates expectation management and click magnetism.",
    niche: "social media",
    transcript:
      "Month 1: 0 to 2,000 subscribers. Posted 3x per week, zero views. Month 3: Found my ONE thing — I stopped trying to teach everything and became the person who teaches Instagram Reels to service businesses. That specificity changed everything...",
  },
];

const MOCK_COMPETITORS: Competitor[] = [
  {
    id: "c1",
    name: "FitKing Studios",
    handle: "@fitkingstudios",
    platform: "instagram",
    followers: 1_200_000,
    niche: "fitness",
  },
  {
    id: "c2",
    name: "ByteScale Media",
    handle: "@bytescale",
    platform: "tiktok",
    followers: 890_000,
    niche: "tech",
  },
  {
    id: "c3",
    name: "Marcello Kitchen",
    handle: "@marcellokitchen",
    platform: "youtube",
    followers: 4_100_000,
    niche: "food",
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function scoreColor(score: number) {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#f59e0b";
  if (score >= 55) return "#3B82F6";
  return "#6b7280";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Explosive";
  if (score >= 75) return "Hot";
  if (score >= 55) return "Trending";
  return "Slow";
}

// ─── ViralScoreRing ───────────────────────────────────────────────────────────

function ViralScoreRing({
  score,
  size = 56,
}: {
  score: number;
  size?: number;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ fontFamily: "var(--font-satoshi, inherit)" }}
      >
        <span className="text-xs font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[9px] text-white/40 leading-none mt-0.5">
          viral
        </span>
      </div>
    </div>
  );
}

// ─── PlatformBadge ────────────────────────────────────────────────────────────

function PlatformBadge({
  platform,
  small,
}: {
  platform: Exclude<Platform, "all">;
  small?: boolean;
}) {
  const cfg = PLATFORM_CONFIG[platform];
  return (
    <span
      className={`font-semibold tracking-tight ${small ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-1"} rounded-md`}
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── ContentCard ─────────────────────────────────────────────────────────────

function ContentCard({
  item,
  selected,
  onClick,
}: {
  item: ViralContent;
  selected: boolean;
  onClick: () => void;
}) {
  const engagementRate = (
    ((item.metrics.likes + item.metrics.comments + item.metrics.shares) /
      item.metrics.views) *
    100
  ).toFixed(1);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl overflow-hidden"
      style={{
        background: selected
          ? "rgba(59,130,246,0.10)"
          : "rgba(13,17,32,0.9)",
        border: selected
          ? "1px solid rgba(59,130,246,0.50)"
          : "1px solid rgba(99,146,255,0.10)",
        boxShadow: selected
          ? "0 0 0 2px rgba(59,130,246,0.20)"
          : "none",
      }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/14] overflow-hidden bg-[#131827]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://picsum.photos/seed/${item.content.thumbnailSeed}/320/500`}
          alt={item.content.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Platform badge */}
        <div className="absolute top-2.5 left-2.5">
          <PlatformBadge platform={item.platform} small />
        </div>

        {/* Viral score */}
        <div className="absolute top-2 right-2">
          <ViralScoreRing score={item.viralScore} size={44} />
        </div>

        {/* Play button for videos */}
        {item.content.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Duration */}
        {item.content.duration && (
          <div className="absolute bottom-2 right-2 text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded font-mono">
            {item.content.duration >= 60
              ? `${Math.floor(item.content.duration / 60)}:${String(item.content.duration % 60).padStart(2, "0")}`
              : `0:${String(item.content.duration).padStart(2, "0")}`}
          </div>
        )}

        {/* Content type badge */}
        {item.content.type === "carousel" && (
          <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded font-mono">
            Carousel
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3 space-y-2">
        {/* Creator */}
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.creator.avatarSeed}`}
            alt={item.creator.displayName}
            className="w-6 h-6 rounded-full bg-[#1a1f35]"
          />
          <div className="min-w-0">
            <span className="text-[11px] font-semibold text-white/90 truncate block">
              {item.creator.username}
            </span>
            <span className="text-[10px] text-white/40">
              {fmt(item.creator.followers)} followers
            </span>
          </div>
        </div>

        {/* Title */}
        <p className="text-xs text-white/80 font-medium leading-tight line-clamp-2">
          {item.content.title}
        </p>

        {/* Metrics strip */}
        <div className="flex items-center gap-3 text-[10px] text-white/50">
          <span className="flex items-center gap-0.5">
            <Eye className="w-3 h-3" />
            {fmt(item.metrics.views)}
          </span>
          <span className="flex items-center gap-0.5">
            <Heart className="w-3 h-3" />
            {fmt(item.metrics.likes)}
          </span>
          <span className="flex items-center gap-0.5">
            <Bookmark className="w-3 h-3" />
            {fmt(item.metrics.saves)}
          </span>
          <span className="ml-auto flex items-center gap-0.5 text-blue-400">
            <BarChart3 className="w-3 h-3" />
            {engagementRate}%
          </span>
        </div>

        {/* Client potential */}
        <div className="flex items-center gap-2 pt-0.5">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: scoreColor(item.clientScore) }}
              initial={{ width: 0 }}
              animate={{ width: `${item.clientScore}%` }}
              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <span className="text-[10px] text-white/40 shrink-0">
            {item.clientScore}% for you
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── DetailPanel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  onClose,
}: {
  item: ViralContent;
  onClose: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const cfg = PLATFORM_CONFIG[item.platform];

  const handleCopy = () => {
    navigator.clipboard.writeText(item.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTranscribe = async () => {
    setTranscribing(true);
    await new Promise((r) => setTimeout(r, 1800));
    setTranscribing(false);
  };

  const handleGenerateVersion = () => {
    const params = new URLSearchParams({
      hooks: item.hooks[0] ?? "",
      niche: item.niche,
      platform: item.platform,
      ref: "enemy-tracker",
    });
    router.push(`/dashboard/script-lab?${params.toString()}`);
  };

  const handleGenerateThumbnail = () => {
    const params = new URLSearchParams({
      style: item.content.thumbnailSeed,
      ref: "enemy-tracker",
    });
    router.push(`/dashboard/thumbnail-generator?${params.toString()}`);
  };

  const engRate = (
    ((item.metrics.likes + item.metrics.comments + item.metrics.shares) /
      item.metrics.views) *
    100
  ).toFixed(2);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 36 }}
      className="fixed right-0 top-0 h-full z-40 overflow-y-auto"
      style={{
        width: 400,
        background: "rgba(9,13,26,0.97)",
        borderLeft: "1px solid rgba(99,146,255,0.15)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]"
        style={{ background: "rgba(9,13,26,0.97)" }}
      >
        <div className="flex items-center gap-2">
          <PlatformBadge platform={item.platform} />
          <span className="text-xs text-white/40">{item.postedAt}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Thumbnail */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-[#131827]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://picsum.photos/seed/${item.content.thumbnailSeed}/800/450`}
            alt={item.content.title}
            className="w-full h-full object-cover"
          />
          {item.content.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Creator + title */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.creator.avatarSeed}`}
              alt={item.creator.displayName}
              className="w-8 h-8 rounded-full bg-[#1a1f35]"
            />
            <div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-white">
                  {item.creator.displayName}
                </span>
                {item.creator.verified && (
                  <CheckCircle
                    className="w-3.5 h-3.5"
                    style={{ color: cfg.color }}
                  />
                )}
              </div>
              <span className="text-xs text-white/40">
                {item.creator.username} · {fmt(item.creator.followers)} followers
              </span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-white leading-tight">
            {item.content.title}
          </h3>
          <p className="text-xs text-white/50 mt-1 leading-relaxed line-clamp-3">
            {item.content.caption}
          </p>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: `rgba(${scoreColor(item.viralScore) === "#22c55e" ? "34,197,94" : scoreColor(item.viralScore) === "#f59e0b" ? "245,158,11" : "59,130,246"},0.08)`,
              border: `1px solid ${scoreColor(item.viralScore)}22`,
            }}
          >
            <div
              className="text-2xl font-bold font-display mb-0.5"
              style={{ color: scoreColor(item.viralScore) }}
            >
              {item.viralScore}
            </div>
            <div className="text-[11px] text-white/50">Enemy Viral Score</div>
            <div
              className="text-[10px] font-semibold mt-0.5"
              style={{ color: scoreColor(item.viralScore) }}
            >
              {scoreLabel(item.viralScore)}
            </div>
          </div>
          <div
            className="rounded-xl p-3 text-center"
            style={{
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.15)",
            }}
          >
            <div className="text-2xl font-bold font-display text-blue-400 mb-0.5">
              {item.clientScore}
            </div>
            <div className="text-[11px] text-white/50">Your Potential</div>
            <div className="text-[10px] font-semibold text-blue-400 mt-0.5">
              {item.clientScore >= 80
                ? "Very High"
                : item.clientScore >= 65
                  ? "High"
                  : "Moderate"}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "rgba(13,17,32,0.8)",
            border: "1px solid rgba(99,146,255,0.10)",
          }}
        >
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Performance
          </h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {[
              { icon: Eye, label: "Views", val: fmt(item.metrics.views) },
              { icon: Heart, label: "Likes", val: fmt(item.metrics.likes) },
              { icon: MessageCircle, label: "Comments", val: fmt(item.metrics.comments) },
              { icon: Share2, label: "Shares", val: fmt(item.metrics.shares) },
              { icon: Bookmark, label: "Saves", val: fmt(item.metrics.saves) },
              { icon: BarChart3, label: "Eng. Rate", val: `${engRate}%` },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-white/40">
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
                <span className="text-white/80 font-medium">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Why it's viral */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(251,191,36,0.05)",
            border: "1px solid rgba(251,191,36,0.12)",
          }}
        >
          <h4 className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" />
            Why It&apos;s Viral
          </h4>
          <p className="text-xs text-white/60 leading-relaxed">{item.whyViral}</p>
        </div>

        {/* Hooks */}
        <div>
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
            Hooks Used
          </h4>
          <div className="space-y-1.5">
            {item.hooks.map((hook, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-xs text-white/70 bg-white/[0.04] rounded-lg px-3 py-2"
              >
                <TrendingUp className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
                {hook}
              </div>
            ))}
          </div>
        </div>

        {/* Transcript */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(13,17,32,0.8)",
            border: "1px solid rgba(99,146,255,0.10)",
          }}
        >
          <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" />
            Script / Transcript
          </h4>
          <p className="text-xs text-white/60 leading-relaxed italic">
            &ldquo;{item.transcript}&rdquo;
          </p>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2 pb-4">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all"
            style={{
              background: copied
                ? "rgba(34,197,94,0.15)"
                : "rgba(59,130,246,0.12)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.30)" : "rgba(59,130,246,0.25)"}`,
              color: copied ? "#22c55e" : "#60a5fa",
            }}
          >
            {copied ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied!" : "Copy Script"}
          </button>

          <button
            onClick={handleTranscribe}
            disabled={transcribing}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all disabled:opacity-60"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.70)",
            }}
          >
            {transcribing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
            {transcribing ? "Transcribing…" : "Transcribe"}
          </button>

          <button
            onClick={handleGenerateVersion}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold col-span-2 transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
              color: "#fff",
            }}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate My Version in Script Lab
          </button>

          <button
            onClick={handleGenerateThumbnail}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all"
            style={{
              background: "rgba(139,92,246,0.12)",
              border: "1px solid rgba(139,92,246,0.25)",
              color: "#a78bfa",
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Match Thumbnail Style
          </button>

          <button
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all"
            style={{
              background: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.18)",
              color: "#86efac",
            }}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Save to Library
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnemyTrackerPage() {
  const [platform, setPlatform] = useState<Platform>("all");
  const [selectedItem, setSelectedItem] = useState<ViralContent | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>(MOCK_COMPETITORS);
  const [addingCompetitor, setAddingCompetitor] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [feed, setFeed] = useState<ViralContent[]>(MOCK_FEED);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = platform === "all"
    ? feed
    : feed.filter((i) => i.platform === platform);

  // Infinite scroll sentinel
  const loadMore = useCallback(() => {
    if (loading) return;
    setLoading(true);
    setTimeout(() => {
      // In production: fetch `/api/enemy-tracker/feed?page=${page+1}&platform=${platform}`
      const more = MOCK_FEED.slice(0, 6).map((item) => ({
        ...item,
        id: `${item.id}-p${page + 1}`,
        viralScore: Math.max(50, item.viralScore - Math.floor(Math.random() * 10)),
        clientScore: Math.max(40, item.clientScore - Math.floor(Math.random() * 8)),
      }));
      setFeed((prev) => [...prev, ...more]);
      setPage((p) => p + 1);
      setLoading(false);
    }, 1200);
  }, [loading, page]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { threshold: 0.3 }
    );
    observerRef.current.observe(sentinel);
    return () => observerRef.current?.disconnect();
  }, [loadMore]);

  const handleAddCompetitor = () => {
    if (!newHandle.trim()) return;
    const nc: Competitor = {
      id: `c${Date.now()}`,
      name: newHandle.replace("@", ""),
      handle: newHandle.startsWith("@") ? newHandle : `@${newHandle}`,
      platform: "instagram",
      followers: 0,
      niche: "general",
    };
    setCompetitors((p) => [...p, nc]);
    setNewHandle("");
    setAddingCompetitor(false);
  };

  const platforms: Array<{ id: Platform; label: string }> = [
    { id: "all", label: "All Platforms" },
    { id: "tiktok", label: "TikTok" },
    { id: "instagram", label: "Instagram" },
    { id: "youtube", label: "YouTube" },
    { id: "x", label: "X / Twitter" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base, #020711)" }}>
      <PageHero
        title="Enemy Tracker"
        subtitle="Watch what's going viral in your clients' niches — then outperform it."
        icon={<Target className="w-5 h-5" />}
        gradient="blue"
      />

      <div className="flex" style={{ height: "calc(100vh - 120px)" }}>
        {/* Left: Competitor sidebar */}
        <aside
          className="flex-shrink-0 overflow-y-auto"
          style={{
            width: 200,
            background: "rgba(13,17,32,0.70)",
            borderRight: "1px solid rgba(99,146,255,0.08)",
          }}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
                Tracking
              </span>
              <button
                onClick={() => {
                  setAddingCompetitor(true);
                  setTimeout(() => inputRef.current?.focus(), 50);
                }}
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {addingCompetitor && (
              <div className="mb-3">
                <input
                  ref={inputRef}
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCompetitor();
                    if (e.key === "Escape") setAddingCompetitor(false);
                  }}
                  placeholder="@handle"
                  className="w-full text-xs bg-white/[0.06] border border-white/10 rounded-lg px-2.5 py-1.5 text-white placeholder:text-white/30 outline-none focus:border-blue-500/50"
                />
              </div>
            )}

            <div className="space-y-1">
              {competitors.map((c) => {
                const cfg = PLATFORM_CONFIG[c.platform];
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer group"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold text-white/80 truncate">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-white/30 truncate">
                        {c.handle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                Trending Now
              </div>
              {["fitness", "business", "food", "tech", "beauty"].map(
                (niche) => (
                  <div
                    key={niche}
                    className="flex items-center gap-1.5 py-1.5 cursor-pointer hover:text-blue-400 transition-colors text-[11px] text-white/40 hover:text-white/60"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {niche}
                  </div>
                )
              )}
            </div>
          </div>
        </aside>

        {/* Main: feed */}
        <main className="flex-1 overflow-y-auto">
          {/* Controls bar */}
          <div
            className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3"
            style={{
              background: "rgba(2,7,17,0.92)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid rgba(99,146,255,0.08)",
            }}
          >
            {/* Platform tabs */}
            <div className="flex items-center gap-1 flex-1">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background:
                      platform === p.id
                        ? "rgba(59,130,246,0.18)"
                        : "transparent",
                    color:
                      platform === p.id
                        ? "#60a5fa"
                        : "rgba(255,255,255,0.45)",
                    border:
                      platform === p.id
                        ? "1px solid rgba(59,130,246,0.35)"
                        : "1px solid transparent",
                  }}
                >
                  {p.id !== "all" ? (
                    <>
                      <span
                        style={{ color: PLATFORM_CONFIG[p.id as Exclude<Platform, "all">].color }}
                      >
                        ●{" "}
                      </span>
                      {p.id.charAt(0).toUpperCase() + p.id.slice(1)}
                    </>
                  ) : (
                    p.label
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-white/40 text-xs">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>{filtered.length} viral posts</span>
              <RefreshCw className="w-3.5 h-3.5 ml-1 cursor-pointer hover:text-white/70 transition-colors" />
            </div>
          </div>

          {/* Grid feed */}
          <div className="p-4">
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              <AnimatePresence>
                {filtered.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    onClick={() =>
                      setSelectedItem(
                        selectedItem?.id === item.id ? null : item
                      )
                    }
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-20 flex items-center justify-center">
              {loading && (
                <div className="flex items-center gap-2 text-white/30 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more…
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedItem && (
          <>
            {/* Backdrop (mobile) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-30 lg:hidden"
              style={{ background: "rgba(0,0,0,0.5)" }}
            />
            <DetailPanel
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
