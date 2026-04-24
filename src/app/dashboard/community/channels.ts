import {
  Megaphone,
  Trophy,
  HelpCircle,
  Sparkles,
  Coffee,
  type LucideIcon,
} from "lucide-react";

export interface CommunityChannel {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  color: string;
}

/**
 * Fixed set of community channels. Keep in sync with the `channel` CHECK
 * constraint in supabase/migrations/20260424_community.sql.
 */
export const COMMUNITY_CHANNELS: CommunityChannel[] = [
  {
    id: "announcements",
    label: "Announcements",
    icon: Megaphone,
    description: "Product updates, releases, and important news",
    color: "text-gold",
  },
  {
    id: "wins",
    label: "Wins",
    icon: Trophy,
    description: "Celebrate revenue milestones and client success",
    color: "text-emerald-400",
  },
  {
    id: "questions",
    label: "Questions",
    icon: HelpCircle,
    description: "Ask for help — the community has your back",
    color: "text-blue-400",
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: Sparkles,
    description: "Feature requests, bug reports, roadmap ideas",
    color: "text-purple-400",
  },
  {
    id: "off-topic",
    label: "Off-topic",
    icon: Coffee,
    description: "Water cooler — everything else agency life",
    color: "text-cyan-400",
  },
];

export type ChannelId = (typeof COMMUNITY_CHANNELS)[number]["id"];

export const REACTION_EMOJIS = [
  "\u{1F44D}",
  "\u{2764}\u{FE0F}",
  "\u{1F389}",
  "\u{1F680}",
  "\u{1F440}",
  "\u{1F914}",
];
