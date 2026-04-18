"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Plus, Pin, Heart, Send, Users,
  Megaphone, HelpCircle, Sparkles, BookOpen, ChevronDown,
  Search, Calendar, Award, Bell, Shield, Vote,
  TrendingUp, Clock, Hash, Loader2, Trash2,
  Flame, Trophy, Star, Target, Zap,
  ExternalLink, Link2, Gift, FileText, Video, MapPin, X,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar: string | null;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  likes: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

interface CommunityEvent {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  date_time: string;
  location: string | null;
  attendees_count: number;
  max_attendees: number | null;
  category: string;
  cover_url: string | null;
  status: "upcoming" | "live" | "ended";
  created_at: string;
  my_rsvp: "going" | "maybe" | "not_going" | null;
}

interface PollOptionCount {
  label: string;
  votes: number;
}

interface CommunityPoll {
  id: string;
  user_id: string | null;
  question: string;
  options: string[];
  ends_at: string | null;
  total_votes: number;
  created_at: string;
  option_counts: PollOptionCount[];
  my_vote: number | null;
}

interface CommunityResource {
  id: string;
  user_id: string | null;
  title: string;
  url: string;
  type: "pdf" | "video" | "template" | "link";
  description: string | null;
  downloads: number;
  pinned: boolean;
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: "post" | "comment" | "like" | "achievement" | "join";
  user: string;
  avatar: string;
  action: string;
  target?: string;
  time: string;
}

interface Badge {
  id: string;
  label: string;
  icon: typeof Star;
  color: string;
  description: string;
  earned: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<string, { bg: string; icon: typeof MessageSquare }> = {
  announcement: { bg: "bg-gold/10 text-gold border-gold/20", icon: Megaphone },
  discussion: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", icon: Users },
  question: { bg: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", icon: HelpCircle },
  resource: { bg: "bg-green-400/10 text-green-400 border-green-400/20", icon: BookOpen },
  showcase: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", icon: Sparkles },
};

const MEMBERS: { name: string; role: string; level: string; badge: string; posts: number; joined: string; online: boolean; points: number; streak: number; bio: string }[] = [];

const TRENDING: { topic: string; posts: number; trend: string }[] = [];

const LEADERBOARD: { name: string; points: number; posts: number; helpful: number; streak: number; avatar: string }[] = [];

const ACTIVITY_FEED: ActivityItem[] = [];

const BADGES: Badge[] = [];

const DISCUSSION_CATEGORIES = [
  { id: "general", label: "General", icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20", description: "Open discussion about anything ShortStack", threads: 48 },
  { id: "tips", label: "Tips & Tricks", icon: Sparkles, color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20", description: "Share your best workflows and hacks", threads: 32 },
  { id: "features", label: "Feature Requests", icon: Target, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20", description: "Request and vote on new features", threads: 27 },
  { id: "showcase", label: "Show & Tell", icon: Gift, color: "text-gold", bg: "bg-gold/10 border-gold/20", description: "Show off what you've built", threads: 19 },
];

/* Current user gamification stats */
const MY_STATS = {
  name: "You",
  points: 0,
  streak: 0,
  rank: 0,
  postsThisWeek: 0,
  badgesEarned: 0,
  totalBadges: 0,
  level: "New Member",
  nextLevel: "Rising Star",
  xpToNext: 2000,
  xpCurrent: 0,
  xpNeeded: 2000,
};

const GUIDELINES = [
  "Be respectful and professional in all interactions",
  "No spam, self-promotion without value, or affiliate links",
  "Share knowledge freely - we all grow together",
  "Keep client-specific information confidential",
  "Use appropriate channels for different types of content",
  "Report any violations to admins privately",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function activityIcon(type: ActivityItem["type"]) {
  switch (type) {
    case "post": return MessageSquare;
    case "comment": return MessageSquare;
    case "like": return Heart;
    case "achievement": return Trophy;
    case "join": return Users;
  }
}

function activityColor(type: ActivityItem["type"]) {
  switch (type) {
    case "post": return "text-blue-400";
    case "comment": return "text-cyan-400";
    case "like": return "text-red-400";
    case "achievement": return "text-gold";
    case "join": return "text-green-400";
  }
}

function resourceIcon(type: CommunityResource["type"]) {
  switch (type) {
    case "pdf": return FileText;
    case "video": return Video;
    case "template": return Gift;
    case "link":
    default: return Link2;
  }
}

/* Format an absolute date_time like "Apr 22, 7:00 PM" */
function formatEventDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* Format remaining time until ISO date, e.g. "in 3d", "in 5h", "ended" */
function timeUntil(iso: string | null): string {
  if (!iso) return "no end date";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.max(1, Math.floor(ms / 60000));
  return `${minutes}m left`;
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "members" | "events" | "resources" | "polls" | "moderation">("feed");
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [quickAction, setQuickAction] = useState<string | null>(null);

  // Events / Polls / Resources state — fetched from /api/community/{events,polls,resources}
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    date_time: "",
    location: "",
    max_attendees: "",
    category: "general",
  });

  const [polls, setPolls] = useState<CommunityPoll[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [showNewPoll, setShowNewPoll] = useState(false);
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [newPoll, setNewPoll] = useState<{ question: string; options: string[]; ends_at: string }>({
    question: "",
    options: ["", ""],
    ends_at: "",
  });

  const [resources, setResources] = useState<CommunityResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [showNewResource, setShowNewResource] = useState(false);
  const [creatingResource, setCreatingResource] = useState(false);
  const [newResource, setNewResource] = useState<{ title: string; url: string; type: CommunityResource["type"]; description: string }>({
    title: "",
    url: "",
    type: "link",
    description: "",
  });

  // Database-backed state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New post form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("discussion");

  // Comments state (keyed by post id)
  const [postComments, setPostComments] = useState<Record<string, Array<{ id: string; user_id: string; author_name: string; author_avatar: string | null; content: string; likes: number; created_at: string; parent_id: string | null; }>>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  /* ---- Fetch comments for a post ---- */
  async function loadComments(postId: string) {
    setCommentsLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/community/comments?post_id=${postId}`);
      const data = await res.json();
      setPostComments(prev => ({ ...prev, [postId]: data.comments || [] }));
    } catch {
      // silent
    } finally {
      setCommentsLoading(prev => ({ ...prev, [postId]: false }));
    }
  }

  /* ---- Post a comment ---- */
  async function postComment(postId: string, parentId?: string | null) {
    const content = (commentInputs[postId] || "").trim();
    if (!content) return;
    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: postId, content, parent_id: parentId || null }),
      });
      const data = await res.json();
      if (data.success) {
        setPostComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data.comment] }));
        setCommentInputs(prev => ({ ...prev, [postId]: "" }));
        setReplyingTo(null);
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
      }
    } catch {
      // silent
    }
  }

  /* ---- Delete a comment ---- */
  async function deleteComment(postId: string, commentId: string) {
    await fetch(`/api/community/comments/${commentId}`, { method: "DELETE" });
    setPostComments(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).filter(c => c.id !== commentId),
    }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, (p.comments_count || 0) - 1) } : p));
  }

  /* ---- Toggle comment like ---- */
  async function toggleCommentLike(postId: string, commentId: string) {
    const res = await fetch(`/api/community/comments/${commentId}`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      setPostComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).map(c => c.id === commentId
          ? { ...c, likes: Math.max(0, c.likes + (data.liked ? 1 : -1)) }
          : c),
      }));
    }
  }

  /* ---- Toggle bookmark ---- */
  async function toggleBookmark(postId: string) {
    const res = await fetch("/api/community/bookmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: postId }),
    });
    const data = await res.json();
    if (data.success) {
      setBookmarkedPosts(prev => {
        const next = new Set(prev);
        if (data.bookmarked) next.add(postId);
        else next.delete(postId);
        return next;
      });
    }
  }

  // Load bookmarks on mount
  useEffect(() => {
    fetch("/api/community/bookmark")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.bookmarks)) {
          setBookmarkedPosts(new Set(d.bookmarks.map((b: { post_id: string }) => b.post_id)));
        }
      })
      .catch(() => {});
  }, []);

  /* ---- Fetch posts ---- */
  const fetchPosts = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/community?limit=50");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch posts");
      }
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  /* ---- Events: fetch / create / rsvp / delete ---- */
  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch("/api/community/events");
      const data = await res.json();
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch {
      // silent
    } finally {
      setEventsLoading(false);
    }
  }, []);

  async function handleCreateEvent() {
    if (!newEvent.title.trim() || !newEvent.date_time) return;
    setCreatingEvent(true);
    try {
      const res = await fetch("/api/community/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          description: newEvent.description || undefined,
          date_time: new Date(newEvent.date_time).toISOString(),
          location: newEvent.location || undefined,
          max_attendees: newEvent.max_attendees ? Number(newEvent.max_attendees) : undefined,
          category: newEvent.category,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create event");
      }
      setShowNewEvent(false);
      setNewEvent({ title: "", description: "", date_time: "", location: "", max_attendees: "", category: "general" });
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreatingEvent(false);
    }
  }

  async function handleRsvp(eventId: string, status: "going" | "maybe" | "not_going" = "going") {
    try {
      const res = await fetch(`/api/community/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvp_status: status }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to RSVP");
      }
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to RSVP");
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setEvents(prev => prev.filter(e => e.id !== eventId));
    try {
      const res = await fetch(`/api/community/events/${eventId}`, { method: "DELETE" });
      if (!res.ok) await fetchEvents();
    } catch {
      await fetchEvents();
    }
  }

  /* ---- Polls: fetch / create / vote ---- */
  const fetchPolls = useCallback(async () => {
    setPollsLoading(true);
    try {
      const res = await fetch("/api/community/polls");
      const data = await res.json();
      setPolls(Array.isArray(data.polls) ? data.polls : []);
    } catch {
      // silent
    } finally {
      setPollsLoading(false);
    }
  }, []);

  async function handleCreatePoll() {
    const cleanOpts = newPoll.options.map(o => o.trim()).filter(Boolean);
    if (!newPoll.question.trim() || cleanOpts.length < 2) return;
    setCreatingPoll(true);
    try {
      const res = await fetch("/api/community/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: newPoll.question,
          options: cleanOpts,
          ends_at: newPoll.ends_at ? new Date(newPoll.ends_at).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create poll");
      }
      setShowNewPoll(false);
      setNewPoll({ question: "", options: ["", ""], ends_at: "" });
      await fetchPolls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create poll");
    } finally {
      setCreatingPoll(false);
    }
  }

  async function handleVote(pollId: string, optionIndex: number) {
    try {
      const res = await fetch(`/api/community/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to vote");
      }
      await fetchPolls();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    }
  }

  /* ---- Resources: fetch / create / download ---- */
  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    try {
      const res = await fetch("/api/community/resources");
      const data = await res.json();
      setResources(Array.isArray(data.resources) ? data.resources : []);
    } catch {
      // silent
    } finally {
      setResourcesLoading(false);
    }
  }, []);

  async function handleCreateResource() {
    if (!newResource.title.trim() || !newResource.url.trim()) return;
    setCreatingResource(true);
    try {
      const res = await fetch("/api/community/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newResource.title,
          url: newResource.url,
          type: newResource.type,
          description: newResource.description || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add resource");
      }
      setShowNewResource(false);
      setNewResource({ title: "", url: "", type: "link", description: "" });
      await fetchResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add resource");
    } finally {
      setCreatingResource(false);
    }
  }

  async function handleResourceOpen(resource: CommunityResource) {
    // Open in a new tab and bump the counter (counter is best-effort).
    if (typeof window !== "undefined") {
      window.open(resource.url, "_blank", "noopener,noreferrer");
    }
    try {
      const res = await fetch(`/api/community/resources/${resource.id}/download`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResources(prev => prev.map(r => r.id === resource.id ? { ...r, downloads: data.downloads ?? r.downloads + 1 } : r));
      }
    } catch {
      // silent — the URL still opened
    }
  }

  // Lazy-load each tab's data the first time it is opened
  useEffect(() => {
    if (activeTab === "events" && events.length === 0 && !eventsLoading) fetchEvents();
    if (activeTab === "polls" && polls.length === 0 && !pollsLoading) fetchPolls();
    if (activeTab === "resources" && resources.length === 0 && !resourcesLoading) fetchResources();
  }, [activeTab, events.length, polls.length, resources.length, eventsLoading, pollsLoading, resourcesLoading, fetchEvents, fetchPolls, fetchResources]);

  // Also fetch upcoming events on mount so the stats bar count is accurate
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /* ---- Create post ---- */
  async function handleCreatePost() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          category: newCategory,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create post");
      }
      const data = await res.json();
      setPosts(prev => [data.post, ...prev]);
      setNewTitle("");
      setNewContent("");
      setNewCategory("discussion");
      setShowNewPost(false);
      setQuickAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setCreating(false);
    }
  }

  /* ---- Quick action shortcuts ---- */
  function openQuickAction(type: string) {
    switch (type) {
      case "new-post":
        setNewCategory("discussion");
        setNewTitle("");
        setNewContent("");
        break;
      case "share-win":
        setNewCategory("showcase");
        setNewTitle("");
        setNewContent("");
        break;
      case "ask-question":
        setNewCategory("question");
        setNewTitle("");
        setNewContent("");
        break;
    }
    setQuickAction(type);
    setShowNewPost(true);
    setActiveTab("feed");
  }

  /* ---- Like post ---- */
  async function toggleLike(postId: string) {
    const alreadyLiked = likedPosts.includes(postId);
    setLikedPosts(prev =>
      alreadyLiked ? prev.filter(p => p !== postId) : [...prev, postId]
    );

    if (!alreadyLiked) {
      try {
        const res = await fetch("/api/community", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: postId, action: "like" }),
        });
        if (res.ok) {
          const data = await res.json();
          setPosts(prev =>
            prev.map(p => (p.id === postId ? { ...p, likes: data.post.likes } : p))
          );
        }
      } catch {
        setLikedPosts(prev => prev.filter(p => p !== postId));
      }
    }
  }

  /* ---- Delete post ---- */
  async function handleDelete(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      const res = await fetch("/api/community", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId }),
      });
      if (!res.ok) {
        fetchPosts();
      }
    } catch {
      fetchPosts();
    }
  }

  const POST_TYPES = [
    { id: "all", label: "All", icon: MessageSquare },
    { id: "announcement", label: "Announcements", icon: Megaphone },
    { id: "discussion", label: "Discussions", icon: Users },
    { id: "question", label: "Questions", icon: HelpCircle },
    { id: "resource", label: "Resources", icon: BookOpen },
    { id: "showcase", label: "Showcase", icon: Sparkles },
  ];

  const filteredPosts = posts.filter(p => {
    if (filter !== "all" && p.category !== filter) return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase()) && !p.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const tabs = [
    { id: "feed" as const, label: "Feed", icon: MessageSquare },
    { id: "members" as const, label: "Members", icon: Users },
    { id: "events" as const, label: "Events", icon: Calendar },
    { id: "resources" as const, label: "Resources", icon: BookOpen },
    { id: "polls" as const, label: "Polls", icon: Vote },
    { id: "moderation" as const, label: "Moderation", icon: Shield },
  ];

  /* Progress bar percentage for XP */
  const xpPct = Math.round((MY_STATS.xpCurrent / MY_STATS.xpNeeded) * 100);

  return (
    <div className="fade-in space-y-5 max-w-[900px] mx-auto">
      <PageHero
        icon={<Users size={28} />}
        title="Community"
        subtitle="Discussions, resources & events for ShortStack."
        gradient="purple"
        actions={
          <button onClick={() => openQuickAction("new-post")} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={14} /> New Post
          </button>
        }
      />

      {/* Gamification Bar -- Your Stats */}
      <div className="card p-4 border-gold/10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">
              {MY_STATS.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold">{MY_STATS.level}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 font-medium">Rank #{MY_STATS.rank}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-32 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${xpPct}%` }} />
                </div>
                <span className="text-[9px] text-muted">{MY_STATS.xpCurrent.toLocaleString()} / {MY_STATS.xpNeeded.toLocaleString()} XP to {MY_STATS.nextLevel}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Flame size={12} className="text-orange-400" />
                <span className="text-sm font-bold font-mono">{MY_STATS.streak}</span>
              </div>
              <p className="text-[9px] text-muted">Day Streak</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Star size={12} className="text-gold" />
                <span className="text-sm font-bold font-mono">{MY_STATS.points.toLocaleString()}</span>
              </div>
              <p className="text-[9px] text-muted">Points</p>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1">
                <Trophy size={12} className="text-purple-400" />
                <span className="text-sm font-bold font-mono">{MY_STATS.badgesEarned}/{MY_STATS.totalBadges}</span>
              </div>
              <p className="text-[9px] text-muted">Badges</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => openQuickAction("new-post")}
          className="card p-3 text-center hover:border-blue-400/30 transition-all group">
          <div className="w-8 h-8 mx-auto rounded-lg bg-blue-400/10 flex items-center justify-center mb-1.5 group-hover:bg-blue-400/20 transition-colors">
            <Plus size={14} className="text-blue-400" />
          </div>
          <p className="text-[10px] font-semibold">New Post</p>
          <p className="text-[9px] text-muted">Start a discussion</p>
        </button>
        <button onClick={() => openQuickAction("share-win")}
          className="card p-3 text-center hover:border-gold/30 transition-all group">
          <div className="w-8 h-8 mx-auto rounded-lg bg-gold/10 flex items-center justify-center mb-1.5 group-hover:bg-gold/20 transition-colors">
            <Trophy size={14} className="text-gold" />
          </div>
          <p className="text-[10px] font-semibold">Share a Win</p>
          <p className="text-[9px] text-muted">Celebrate success</p>
        </button>
        <button onClick={() => openQuickAction("ask-question")}
          className="card p-3 text-center hover:border-yellow-400/30 transition-all group">
          <div className="w-8 h-8 mx-auto rounded-lg bg-yellow-400/10 flex items-center justify-center mb-1.5 group-hover:bg-yellow-400/20 transition-colors">
            <HelpCircle size={14} className="text-yellow-400" />
          </div>
          <p className="text-[10px] font-semibold">Ask a Question</p>
          <p className="text-[9px] text-muted">Get community help</p>
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold font-mono">{MEMBERS.length}</p>
          <p className="text-[10px] text-muted">Members</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold font-mono text-green-400">{MEMBERS.filter(m => m.online).length}</p>
          <p className="text-[10px] text-muted">Online Now</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold font-mono">{posts.length}</p>
          <p className="text-[10px] text-muted">Posts This Week</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold font-mono text-gold">{events.length}</p>
          <p className="text-[10px] text-muted">Upcoming Events</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="card p-3 border-red-400/30 bg-red-400/5 text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[10px] underline">Dismiss</button>
        </div>
      )}

      {/* ---- TAB: Feed ---- */}
      {activeTab === "feed" && (
        <>
          {/* Search + Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 pl-8 text-xs text-foreground" placeholder="Search posts..." />
            </div>
          </div>

          {/* Type filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {POST_TYPES.map(t => (
              <button key={t.id} onClick={() => setFilter(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
                  filter === t.id ? "bg-gold/10 border-gold/20 text-gold font-medium" : "border-border text-muted hover:text-foreground"
                }`}>
                <t.icon size={12} /> {t.label}
              </button>
            ))}
          </div>

          {/* Discussion Categories */}
          <div className="card p-4">
            <h3 className="text-[10px] font-semibold mb-3 flex items-center gap-1 uppercase tracking-wider text-muted">
              <Hash size={10} className="text-gold" /> Discussion Topics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {DISCUSSION_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFilter(cat.id === "tips" ? "resource" : cat.id === "features" ? "question" : cat.id === "showcase" ? "showcase" : "discussion")}
                  className={`p-3 rounded-lg border ${cat.bg} text-left hover:brightness-110 transition-all`}>
                  <cat.icon size={16} className={cat.color} />
                  <p className="text-xs font-semibold mt-1.5">{cat.label}</p>
                  <p className="text-[9px] text-muted mt-0.5">{cat.description}</p>
                  <p className="text-[9px] font-mono mt-1.5 opacity-60">{cat.threads} threads</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main feed column */}
            <div className="lg:col-span-2 space-y-3">
              {/* Trending Topics */}
              <div className="card p-3">
                <h3 className="text-[10px] font-semibold mb-2 flex items-center gap-1"><TrendingUp size={10} className="text-gold" /> Trending</h3>
                {TRENDING.length === 0 ? (
                  <p className="text-[9px] text-muted text-center py-2">No trending topics yet</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto">
                    {TRENDING.map(t => (
                      <div key={t.topic} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-[9px] whitespace-nowrap shrink-0 hover:border-gold/20 transition-colors cursor-pointer">
                        <Hash size={8} className="text-gold" />
                        <span>{t.topic}</span>
                        <span className="text-green-400 font-mono">{t.trend}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* New Post Form */}
              {showNewPost && (
                <div className="card p-4 border-gold/20">
                  <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
                    {quickAction === "share-win" && <><Trophy size={12} className="text-gold" /> Share a Win</>}
                    {quickAction === "ask-question" && <><HelpCircle size={12} className="text-yellow-400" /> Ask a Question</>}
                    {(!quickAction || quickAction === "new-post") && <>Create New Post</>}
                  </h3>
                  <div className="space-y-3">
                    <select
                      value={newCategory}
                      onChange={e => setNewCategory(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
                    >
                      <option value="discussion">Discussion</option>
                      <option value="question">Question</option>
                      <option value="resource">Resource</option>
                      <option value="showcase">Showcase</option>
                      <option value="announcement">Announcement</option>
                    </select>
                    <input
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
                      placeholder={quickAction === "share-win" ? "What did you accomplish?" : quickAction === "ask-question" ? "What do you need help with?" : "Post title..."}
                    />
                    <textarea
                      value={newContent}
                      onChange={e => setNewContent(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-24"
                      placeholder={quickAction === "share-win" ? "Tell us about your win..." : quickAction === "ask-question" ? "Describe your question in detail..." : "Share your thoughts..."}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setShowNewPost(false); setQuickAction(null); }} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                      <button
                        onClick={handleCreatePost}
                        disabled={creating || !newTitle.trim() || !newContent.trim()}
                        className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        {creating ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                        {creating ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Posts */}
              <div className="space-y-3">
                {loading ? (
                  <div className="card text-center py-12">
                    <Loader2 size={24} className="mx-auto mb-2 text-muted/50 animate-spin" />
                    <p className="text-xs text-muted">Loading posts...</p>
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="card text-center py-12">
                    <MessageSquare size={24} className="mx-auto mb-2 text-muted/30" />
                    <p className="text-xs text-muted">
                      {posts.length === 0
                        ? "No posts yet. Be the first to share!"
                        : "No posts match your filters."}
                    </p>
                  </div>
                ) : filteredPosts.map(post => {
                  const tc = TYPE_CONFIG[post.category] || { bg: "bg-white/5 text-muted border-border", icon: MessageSquare };
                  const TypeIcon = tc.icon;
                  const liked = likedPosts.includes(post.id);
                  return (
                    <div key={post.id} className={`card p-4 transition-all ${post.pinned ? "border-gold/20 bg-gold/[0.02]" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold shrink-0">
                          {post.author_avatar || post.author_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold">{post.author_name}</span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded border ${tc.bg}`}><TypeIcon size={8} className="inline mr-0.5" />{post.category}</span>
                            {post.pinned && <Pin size={10} className="text-gold" />}
                            <span className="text-[9px] text-muted ml-auto">{timeAgo(post.created_at)}</span>
                          </div>
                          <h3 className="text-sm font-medium mt-0.5">{post.title}</h3>
                          <p className="text-xs text-muted mt-1.5 leading-relaxed">
                            {expandedPost === post.id ? post.content : post.content.length > 200 ? post.content.slice(0, 200) + "..." : post.content}
                          </p>
                          <div className="flex items-center gap-3 mt-3">
                            <button onClick={() => toggleLike(post.id)}
                              className={`flex items-center gap-1 text-[10px] transition-colors ${liked ? "text-red-400" : "text-muted hover:text-red-400"}`}>
                              <Heart size={12} fill={liked ? "currentColor" : "none"} /> {post.likes + (liked ? 1 : 0)}
                            </button>
                            <button onClick={() => {
                              const isExpanded = expandedPost === post.id;
                              setExpandedPost(isExpanded ? null : post.id);
                              if (!isExpanded && !postComments[post.id]) loadComments(post.id);
                            }}
                              className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground">
                              <MessageSquare size={12} /> {post.comments_count} {post.comments_count === 1 ? "comment" : "comments"}
                              <ChevronDown size={10} className={expandedPost === post.id ? "rotate-180" : ""} />
                            </button>
                            <button onClick={() => toggleBookmark(post.id)}
                              className={`flex items-center gap-1 text-[10px] transition-colors ${bookmarkedPosts.has(post.id) ? "text-gold" : "text-muted hover:text-gold"}`}>
                              <Pin size={12} fill={bookmarkedPosts.has(post.id) ? "currentColor" : "none"} />
                            </button>
                            <button onClick={() => {
                              if (navigator.share) navigator.share({ title: post.title, text: post.content.slice(0, 100) });
                              else { navigator.clipboard.writeText(`${window.location.origin}/dashboard/community#${post.id}`); }
                            }}
                              className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground">
                              <ExternalLink size={12} />
                            </button>
                            <button onClick={() => handleDelete(post.id)}
                              className="flex items-center gap-1 text-[10px] text-muted hover:text-red-400 ml-auto">
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {/* Comments section — shown when expanded */}
                          {expandedPost === post.id && (
                            <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                              {/* Comment input */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={commentInputs[post.id] || ""}
                                  onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                  onKeyDown={e => e.key === "Enter" && postComment(post.id, replyingTo)}
                                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                                  className="input flex-1 text-xs"
                                />
                                <button onClick={() => postComment(post.id, replyingTo)}
                                  disabled={!(commentInputs[post.id] || "").trim()}
                                  className="btn-primary text-xs px-3 flex items-center gap-1 disabled:opacity-40">
                                  <Send size={10} /> Post
                                </button>
                              </div>
                              {replyingTo && (
                                <p className="text-[9px] text-muted">Replying to a comment — <button onClick={() => setReplyingTo(null)} className="text-gold hover:underline">cancel</button></p>
                              )}

                              {/* Comments list */}
                              {commentsLoading[post.id] ? (
                                <p className="text-[10px] text-muted text-center py-4">Loading comments...</p>
                              ) : (postComments[post.id] || []).length === 0 ? (
                                <p className="text-[10px] text-muted text-center py-4">Be the first to comment</p>
                              ) : (
                                <div className="space-y-2.5">
                                  {(postComments[post.id] || []).filter(c => !c.parent_id).map(comment => {
                                    const replies = (postComments[post.id] || []).filter(c => c.parent_id === comment.id);
                                    return (
                                      <div key={comment.id} className="space-y-2">
                                        <div className="flex gap-2">
                                          <div className="w-7 h-7 rounded-full bg-gold/15 flex items-center justify-center text-[10px] font-bold text-gold shrink-0">
                                            {(comment.author_name || "?").charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 bg-surface-light/50 rounded-lg p-2.5">
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <span className="text-[10px] font-semibold">{comment.author_name}</span>
                                              <span className="text-[8px] text-muted">{timeAgo(comment.created_at)}</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed">{comment.content}</p>
                                            <div className="flex items-center gap-3 mt-1.5">
                                              <button onClick={() => toggleCommentLike(post.id, comment.id)}
                                                className="flex items-center gap-1 text-[9px] text-muted hover:text-red-400">
                                                <Heart size={9} /> {comment.likes}
                                              </button>
                                              <button onClick={() => setReplyingTo(comment.id)}
                                                className="text-[9px] text-muted hover:text-foreground">
                                                Reply
                                              </button>
                                              <button onClick={() => deleteComment(post.id, comment.id)}
                                                className="text-[9px] text-muted hover:text-red-400 ml-auto">
                                                <Trash2 size={9} />
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                        {/* Nested replies */}
                                        {replies.map(reply => (
                                          <div key={reply.id} className="flex gap-2 ml-9">
                                            <div className="w-6 h-6 rounded-full bg-blue-400/15 flex items-center justify-center text-[9px] font-bold text-blue-400 shrink-0">
                                              {(reply.author_name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 bg-surface-light/30 rounded-lg p-2">
                                              <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-semibold">{reply.author_name}</span>
                                                <span className="text-[8px] text-muted">{timeAgo(reply.created_at)}</span>
                                              </div>
                                              <p className="text-[11px] leading-relaxed">{reply.content}</p>
                                              <div className="flex items-center gap-3 mt-1">
                                                <button onClick={() => toggleCommentLike(post.id, reply.id)}
                                                  className="flex items-center gap-1 text-[9px] text-muted hover:text-red-400">
                                                  <Heart size={9} /> {reply.likes}
                                                </button>
                                                <button onClick={() => deleteComment(post.id, reply.id)}
                                                  className="text-[9px] text-muted hover:text-red-400 ml-auto">
                                                  <Trash2 size={9} />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar -- Activity Feed + Leaderboard mini */}
            <div className="space-y-3">
              {/* Activity Feed */}
              <div className="card p-4">
                <h3 className="text-[10px] font-semibold mb-3 flex items-center gap-1 uppercase tracking-wider text-muted">
                  <Zap size={10} className="text-gold" /> Recent Activity
                </h3>
                {ACTIVITY_FEED.length === 0 ? (
                  <p className="text-[9px] text-muted text-center py-4">No recent activity</p>
                ) : (
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {ACTIVITY_FEED.map(item => {
                      const AIcon = activityIcon(item.type);
                      const aColor = activityColor(item.type);
                      return (
                        <div key={item.id} className="flex items-start gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-white/5 ${aColor}`}>
                            <AIcon size={9} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] leading-relaxed">
                              <span className="font-semibold">{item.user}</span>{" "}
                              <span className="text-muted">{item.action}</span>{" "}
                              {item.target && <span className="font-medium">{item.target}</span>}
                            </p>
                            <p className="text-[9px] text-muted">{timeAgo(item.time)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mini Leaderboard */}
              <div className="card p-4">
                <h3 className="text-[10px] font-semibold mb-3 flex items-center gap-1 uppercase tracking-wider text-muted">
                  <Trophy size={10} className="text-gold" /> Top Contributors
                </h3>
                {LEADERBOARD.length === 0 ? (
                  <p className="text-[9px] text-muted text-center py-4">No contributors yet</p>
                ) : (
                  <div className="space-y-2">
                    {LEADERBOARD.slice(0, 5).map((m, i) => (
                      <div key={m.name} className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          i === 0 ? "bg-gold/20 text-gold" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-orange-400/20 text-orange-400" : "bg-white/5 text-muted"
                        }`}>{i + 1}</span>
                        <div className="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center text-[8px] font-bold text-gold shrink-0">{m.avatar}</div>
                        <span className="text-[10px] font-medium flex-1 truncate">{m.name}</span>
                        <span className="text-[9px] font-mono text-gold">{m.points.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveTab("members")} className="w-full text-center text-[9px] text-gold mt-3 hover:underline">
                  View full leaderboard
                </button>
              </div>

              {/* Your Badges mini */}
              <div className="card p-4">
                <h3 className="text-[10px] font-semibold mb-3 flex items-center gap-1 uppercase tracking-wider text-muted">
                  <Award size={10} className="text-gold" /> Your Badges
                </h3>
                {BADGES.length === 0 ? (
                  <p className="text-[9px] text-muted text-center py-4">No badges available yet</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {BADGES.slice(0, 8).map(badge => {
                      const BIcon = badge.icon;
                      return (
                        <div key={badge.id} className={`relative group flex flex-col items-center p-2 rounded-lg border transition-all ${
                          badge.earned ? "border-border hover:border-gold/20" : "border-border/50 opacity-30"
                        }`}>
                          <BIcon size={14} className={badge.earned ? badge.color : "text-muted"} />
                          <p className="text-[7px] text-center mt-1 font-medium leading-tight">{badge.label}</p>
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                            <div className="bg-black border border-border rounded-lg px-2 py-1 text-[8px] whitespace-nowrap shadow-lg">
                              {badge.description}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ---- TAB: Members ---- */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Full Leaderboard */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Award size={12} className="text-gold" /> Activity Leaderboard</h3>
            {LEADERBOARD.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No leaderboard data yet. Start participating to earn points!</p>
            ) : (
            <div className="space-y-2">
              {LEADERBOARD.map((m, i) => (
                <div key={m.name} className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                  i < 3 ? "border-gold/10 bg-gold/[0.02]" : "border-border"
                }`}>
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "bg-gold/20 text-gold" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-orange-400/20 text-orange-400" : "bg-white/5 text-muted"
                  }`}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold shrink-0">{m.avatar}</div>
                  <span className="text-xs font-medium flex-1">{m.name}</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted">
                    <Flame size={10} className="text-orange-400" />
                    <span className="font-mono">{m.streak}d</span>
                  </div>
                  <span className="text-[10px] text-muted">{m.posts} posts</span>
                  <span className="text-[10px] text-muted">{m.helpful} helpful</span>
                  <span className="text-xs font-bold font-mono text-gold">{m.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Member Directory with Rich Cards */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-gold" /> Member Directory</h3>
            {MEMBERS.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No community members yet</p>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {MEMBERS.map(m => (
                <div key={m.name}
                  onClick={() => setExpandedMember(expandedMember === m.name ? null : m.name)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    expandedMember === m.name ? "border-gold/30 bg-gold/[0.02]" : "border-border hover:border-border"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center text-sm font-bold text-gold">{m.name.charAt(0)}</div>
                      {m.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-surface" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">{m.name}</p>
                        {m.badge === "gold" && <Award size={10} className="text-gold" />}
                        {m.badge === "silver" && <Award size={10} className="text-gray-300" />}
                        {m.badge === "bronze" && <Award size={10} className="text-orange-400" />}
                      </div>
                      <p className="text-[10px] text-muted">{m.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-gold">{m.points.toLocaleString()} pts</p>
                      <p className="text-[9px] text-muted">{m.level}</p>
                    </div>
                  </div>
                  {/* Expanded card content */}
                  {expandedMember === m.name && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      <p className="text-[10px] text-muted italic">&quot;{m.bio}&quot;</p>
                      <div className="flex items-center gap-4 text-[9px] text-muted">
                        <span className="flex items-center gap-1"><MessageSquare size={8} /> {m.posts} posts</span>
                        <span className="flex items-center gap-1"><Calendar size={8} /> Joined {m.joined}</span>
                        <span className="flex items-center gap-1"><Flame size={8} className="text-orange-400" /> {m.streak} day streak</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {m.badge === "gold" && (
                          <>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">Top Contributor</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">Early Adopter</span>
                          </>
                        )}
                        {m.badge === "silver" && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-400/10 text-purple-400 border border-purple-400/20">Helpful Hand</span>
                        )}
                        {m.badge === "bronze" && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">Rising Star</span>
                        )}
                        {m.online && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-400/10 text-green-400 border border-green-400/20">Online</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Achievement Badges Gallery */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Trophy size={12} className="text-gold" /> Achievement Badges</h3>
            {BADGES.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No badges available yet</p>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {BADGES.map(badge => {
                const BIcon = badge.icon;
                return (
                  <div key={badge.id} className={`p-3 rounded-lg border text-center transition-all ${
                    badge.earned ? "border-border hover:border-gold/20" : "border-border/40 opacity-40"
                  }`}>
                    <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                      badge.earned ? "bg-white/5" : "bg-white/[0.02]"
                    }`}>
                      <BIcon size={20} className={badge.earned ? badge.color : "text-muted/50"} />
                    </div>
                    <p className="text-[10px] font-semibold">{badge.label}</p>
                    <p className="text-[9px] text-muted mt-0.5">{badge.description}</p>
                    {badge.earned && <p className="text-[8px] text-green-400 mt-1 font-medium">Earned</p>}
                    {!badge.earned && <p className="text-[8px] text-muted mt-1">Locked</p>}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Events ---- */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Calendar size={12} className="text-gold" /> Upcoming Events</h3>
              <button onClick={() => setShowNewEvent(s => !s)} className="px-2.5 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
                <Plus size={10} /> Create event
              </button>
            </div>

            {showNewEvent && (
              <div className="mb-4 p-3 rounded-lg border border-gold/20 space-y-2">
                <input
                  value={newEvent.title}
                  onChange={e => setNewEvent(s => ({ ...s, title: e.target.value }))}
                  placeholder="Event title"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                />
                <textarea
                  value={newEvent.description}
                  onChange={e => setNewEvent(s => ({ ...s, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs h-16"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="datetime-local"
                    value={newEvent.date_time}
                    onChange={e => setNewEvent(s => ({ ...s, date_time: e.target.value }))}
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  />
                  <input
                    value={newEvent.location}
                    onChange={e => setNewEvent(s => ({ ...s, location: e.target.value }))}
                    placeholder="Location (or leave blank for virtual)"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newEvent.category}
                    onChange={e => setNewEvent(s => ({ ...s, category: e.target.value }))}
                    placeholder="Category (e.g. workshop)"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  />
                  <input
                    type="number"
                    min="1"
                    value={newEvent.max_attendees}
                    onChange={e => setNewEvent(s => ({ ...s, max_attendees: e.target.value }))}
                    placeholder="Max attendees (optional)"
                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowNewEvent(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                  <button
                    onClick={handleCreateEvent}
                    disabled={creatingEvent || !newEvent.title.trim() || !newEvent.date_time}
                    className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    {creatingEvent ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    {creatingEvent ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}

            {eventsLoading ? (
              <div className="text-center py-6"><Loader2 size={20} className="mx-auto animate-spin text-muted/50" /></div>
            ) : events.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No upcoming events. Check back later!</p>
            ) : (
              <div className="space-y-2">
                {events.map(ev => {
                  const isFull = ev.max_attendees != null && ev.attendees_count >= ev.max_attendees && ev.my_rsvp !== "going";
                  return (
                    <div key={ev.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold">{ev.title}</p>
                          <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                            <Clock size={8} /> {formatEventDate(ev.date_time)}
                            {ev.location && <><span className="mx-1">&middot;</span><MapPin size={8} /> {ev.location}</>}
                            <span className="mx-1">&middot;</span>
                            <span className="capitalize">{ev.category}</span>
                          </p>
                          {ev.description && (
                            <p className="text-[10px] text-muted mt-1 leading-relaxed">{ev.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-muted flex items-center gap-1">
                            <Users size={8} /> {ev.attendees_count}{ev.max_attendees ? `/${ev.max_attendees}` : ""}
                          </span>
                          <button
                            onClick={() => handleRsvp(ev.id, "going")}
                            disabled={isFull}
                            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                              ev.my_rsvp === "going"
                                ? "bg-green-400 text-black"
                                : isFull
                                  ? "bg-white/5 text-muted cursor-not-allowed"
                                  : "bg-gold text-black hover:brightness-110"
                            }`}
                          >
                            {ev.my_rsvp === "going" ? "Going" : isFull ? "Full" : "RSVP"}
                          </button>
                          {ev.my_rsvp && ev.my_rsvp !== "going" && (
                            <span className="text-[9px] text-muted capitalize">{ev.my_rsvp.replace("_", " ")}</span>
                          )}
                          <button
                            onClick={() => handleRsvp(ev.id, "maybe")}
                            className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${
                              ev.my_rsvp === "maybe" ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-400" : "border-border text-muted hover:text-foreground"
                            }`}
                          >
                            Maybe
                          </button>
                          {/* Creator delete */}
                          <button onClick={() => handleDeleteEvent(ev.id)} title="Delete (creator only)"
                            className="p-1 rounded-lg text-muted hover:text-red-400">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Resources ---- */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          {/* Add resource form */}
          <div className="card p-4 border-gold/10">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Pin size={12} className="text-gold" /> Pinned Resources</h3>
              <button onClick={() => setShowNewResource(s => !s)} className="px-2.5 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
                <Plus size={10} /> Add resource
              </button>
            </div>
            <p className="text-[10px] text-muted mb-3">Essential guides and templates to get started</p>

            {showNewResource && (
              <div className="mb-4 p-3 rounded-lg border border-gold/20 space-y-2">
                <input
                  value={newResource.title}
                  onChange={e => setNewResource(s => ({ ...s, title: e.target.value }))}
                  placeholder="Resource title"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                />
                <input
                  value={newResource.url}
                  onChange={e => setNewResource(s => ({ ...s, url: e.target.value }))}
                  placeholder="URL (https://...)"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                />
                <select
                  value={newResource.type}
                  onChange={e => setNewResource(s => ({ ...s, type: e.target.value as CommunityResource["type"] }))}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                >
                  <option value="link">Link</option>
                  <option value="pdf">PDF</option>
                  <option value="video">Video</option>
                  <option value="template">Template</option>
                </select>
                <textarea
                  value={newResource.description}
                  onChange={e => setNewResource(s => ({ ...s, description: e.target.value }))}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs h-16"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => setShowNewResource(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                  <button
                    onClick={handleCreateResource}
                    disabled={creatingResource || !newResource.title.trim() || !newResource.url.trim()}
                    className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    {creatingResource ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    {creatingResource ? "Adding..." : "Add"}
                  </button>
                </div>
              </div>
            )}

            {resourcesLoading ? (
              <div className="text-center py-6"><Loader2 size={20} className="mx-auto animate-spin text-muted/50" /></div>
            ) : resources.filter(r => r.pinned).length === 0 ? (
              <p className="text-xs text-muted text-center py-6">{resources.length === 0 ? "No resources shared yet" : "No pinned resources"}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {resources.filter(r => r.pinned).slice(0, 4).map(r => {
                  const RIcon = resourceIcon(r.type);
                  return (
                    <div key={r.id} className="p-3 rounded-lg border border-gold/10 bg-gold/[0.02] hover:border-gold/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center shrink-0"><RIcon size={16} className="text-gold" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{r.title}</p>
                          <p className="text-[10px] text-muted">{r.type} &middot; {r.downloads} downloads</p>
                        </div>
                        <button onClick={() => handleResourceOpen(r)} className="text-[10px] text-gold hover:underline flex items-center gap-0.5 shrink-0">
                          <ExternalLink size={8} /> Open
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Full Library */}
          {resources.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><BookOpen size={12} className="text-gold" /> Resource Library</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {resources.map(r => {
                  const RIcon = resourceIcon(r.type);
                  return (
                    <div key={r.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><RIcon size={14} className="text-gold" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{r.title}</p>
                          <p className="text-[10px] text-muted">{r.type} &middot; {r.downloads} downloads{r.description ? ` · ${r.description}` : ""}</p>
                        </div>
                        <button onClick={() => handleResourceOpen(r)} className="text-[10px] text-gold hover:underline">
                          {r.type === "pdf" || r.type === "template" ? "Download" : "Open"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Helpful Links */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Link2 size={12} className="text-gold" /> Helpful Links</h3>
            <div className="space-y-2">
              {[
                { label: "ShortStack Documentation", url: "#", desc: "Official docs and API reference" },
                { label: "Video Tutorials Playlist", url: "#", desc: "Step-by-step walkthroughs on YouTube" },
                { label: "Feature Changelog", url: "#", desc: "See what's new in each release" },
                { label: "Status Page", url: "#", desc: "Check system uptime and incidents" },
              ].map(link => (
                <a key={link.label} href={link.url} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-gold/20 transition-all">
                  <ExternalLink size={12} className="text-gold shrink-0" />
                  <div>
                    <p className="text-xs font-medium">{link.label}</p>
                    <p className="text-[9px] text-muted">{link.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Polls ---- */}
      {activeTab === "polls" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold flex items-center gap-2"><Vote size={12} className="text-gold" /> Active Polls</h3>
            <button onClick={() => setShowNewPoll(s => !s)} className="px-2.5 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1">
              <Plus size={10} /> Create poll
            </button>
          </div>

          {showNewPoll && (
            <div className="card p-4 border-gold/20 space-y-2">
              <input
                value={newPoll.question}
                onChange={e => setNewPoll(s => ({ ...s, question: e.target.value }))}
                placeholder="What do you want to ask?"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs"
              />
              <div className="space-y-1.5">
                {newPoll.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={opt}
                      onChange={e => setNewPoll(s => {
                        const next = [...s.options];
                        next[i] = e.target.value;
                        return { ...s, options: next };
                      })}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                    />
                    {newPoll.options.length > 2 && (
                      <button onClick={() => setNewPoll(s => ({ ...s, options: s.options.filter((_, idx) => idx !== i) }))}
                        className="px-2 rounded-lg text-muted hover:text-red-400">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setNewPoll(s => ({ ...s, options: [...s.options, ""] }))}
                  className="text-[10px] text-gold hover:underline"
                >
                  + Add option
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted shrink-0">Ends at (optional):</label>
                <input
                  type="datetime-local"
                  value={newPoll.ends_at}
                  onChange={e => setNewPoll(s => ({ ...s, ends_at: e.target.value }))}
                  className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowNewPoll(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                <button
                  onClick={handleCreatePoll}
                  disabled={creatingPoll || !newPoll.question.trim() || newPoll.options.filter(o => o.trim()).length < 2}
                  className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                >
                  {creatingPoll ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  {creatingPoll ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}

          {pollsLoading ? (
            <div className="card text-center py-12"><Loader2 size={24} className="mx-auto animate-spin text-muted/50" /></div>
          ) : polls.length === 0 ? (
            <div className="card text-center py-12">
              <Vote size={24} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No active polls right now</p>
            </div>
          ) : polls.map(poll => {
            const total = poll.total_votes || 0;
            return (
              <div key={poll.id} className="card p-4">
                <h3 className="text-xs font-semibold mb-1">{poll.question}</h3>
                <p className="text-[9px] text-muted mb-3">{total} {total === 1 ? "vote" : "votes"} &middot; {timeUntil(poll.ends_at)}</p>
                <div className="space-y-2">
                  {poll.option_counts.map((opt, i) => {
                    const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
                    const voted = poll.my_vote === i;
                    return (
                      <button key={i} onClick={() => handleVote(poll.id, i)} className="w-full text-left">
                        <div className={`relative p-2 rounded-lg border transition-all ${voted ? "border-gold/30 bg-gold/[0.05]" : "border-border hover:border-border"}`}>
                          <div className="absolute inset-0 rounded-lg bg-gold/10" style={{ width: `${pct}%` }} />
                          <div className="relative flex items-center justify-between">
                            <span className="text-xs">{opt.label}</span>
                            <span className="text-xs font-mono text-muted">{pct}%</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- TAB: Moderation ---- */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Shield size={12} className="text-gold" /> Community Guidelines</h3>
            <div className="space-y-2">
              {GUIDELINES.map((g, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] text-muted">
                  <span className="w-4 h-4 rounded-full bg-gold/10 text-gold text-[8px] flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                  {g}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Bell size={12} className="text-gold" /> Notification Preferences</h3>
            <div className="space-y-2">
              {[
                { label: "New announcements", enabled: true },
                { label: "Replies to my posts", enabled: true },
                { label: "New posts in followed topics", enabled: false },
                { label: "Event reminders", enabled: true },
                { label: "Weekly digest email", enabled: false },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-[10px]">{n.label}</span>
                  <div className={`w-8 h-4 rounded-full transition-all relative cursor-pointer ${n.enabled ? "bg-gold" : "bg-white/10"}`}>
                    <div className="w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: n.enabled ? "18px" : "2px" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
