"use client";

import { useState } from "react";
import {
  MessageSquare, Plus, Pin, Heart, Send, Users,
  Megaphone, HelpCircle, Sparkles, BookOpen, ChevronDown,
  Search, Calendar, Award, Bell, Shield, Vote,
  TrendingUp, Star, Clock, Hash
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface Post {
  id: string;
  author: string;
  avatar: string;
  role: string;
  title: string;
  content: string;
  type: string;
  pinned: boolean;
  likes: number;
  comments: number;
  created_at: string;
}

const MOCK_POSTS: Post[] = [
  { id: "p1", author: "Nick S.", avatar: "N", role: "admin", title: "New Feature: AI Video Generator is Live!", content: "Excited to announce our AI Video Generator is now available for all Scale plan users. Create professional short-form videos in minutes. Check the sidebar under AI Video.", type: "announcement", pinned: true, likes: 24, comments: 8, created_at: "2h ago" },
  { id: "p2", author: "Sarah K.", avatar: "S", role: "member", title: "Best practices for cold DM campaigns?", content: "I've been running DM campaigns for dental clients and getting ~8% response rate. Any tips to improve? What templates work best for you?", type: "question", pinned: false, likes: 12, comments: 15, created_at: "5h ago" },
  { id: "p3", author: "Alex M.", avatar: "A", role: "member", title: "Case Study: 0 to 50 leads/mo for a plumber", content: "Just wrapped up a 3-month engagement with a local plumber. Went from zero online presence to 50+ leads per month using Google Ads + SEO. Happy to share the strategy.", type: "showcase", pinned: false, likes: 31, comments: 22, created_at: "1d ago" },
  { id: "p4", author: "Nick S.", avatar: "N", role: "admin", title: "Free Resource: 2026 Social Media Calendar Template", content: "Download our free content calendar template with 365 post ideas, holiday dates, and industry-specific prompts. Link in the resource library.", type: "resource", pinned: true, likes: 45, comments: 6, created_at: "2d ago" },
  { id: "p5", author: "Mike T.", avatar: "M", role: "member", title: "Client retention strategies that actually work", content: "Been in the agency game for 3 years. Here are my top 5 retention strategies: 1) Monthly video reports, 2) Quarterly strategy calls, 3) Surprise audits, 4) Birthday/holiday touches, 5) Referral incentives.", type: "discussion", pinned: false, likes: 18, comments: 11, created_at: "3d ago" },
  { id: "p6", author: "Priya S.", avatar: "P", role: "member", title: "How do you handle scope creep?", content: "A client keeps asking for extra work outside their package. How do you politely set boundaries without losing the client?", type: "question", pinned: false, likes: 9, comments: 14, created_at: "4d ago" },
];

const TYPE_CONFIG: Record<string, { bg: string; icon: typeof MessageSquare }> = {
  announcement: { bg: "bg-gold/10 text-gold border-gold/20", icon: Megaphone },
  discussion: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", icon: Users },
  question: { bg: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", icon: HelpCircle },
  resource: { bg: "bg-green-400/10 text-green-400 border-green-400/20", icon: BookOpen },
  showcase: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", icon: Sparkles },
};

const MEMBERS = [
  { name: "Nick S.", role: "Admin", level: "Founder", badge: "gold", posts: 142, joined: "Jan 2025", online: true },
  { name: "Sarah K.", role: "Team Lead", level: "Expert", badge: "silver", posts: 87, joined: "Mar 2025", online: true },
  { name: "Alex M.", role: "Strategist", level: "Pro", badge: "bronze", posts: 64, joined: "Apr 2025", online: false },
  { name: "Mike T.", role: "Member", level: "Rising Star", badge: "bronze", posts: 45, joined: "Jun 2025", online: true },
  { name: "Priya S.", role: "Member", level: "Contributor", badge: "none", posts: 28, joined: "Aug 2025", online: false },
  { name: "Carlos R.", role: "Member", level: "Newcomer", badge: "none", posts: 12, joined: "Jan 2026", online: false },
  { name: "Emma L.", role: "Member", level: "Newcomer", badge: "none", posts: 8, joined: "Feb 2026", online: true },
];

const EVENTS = [
  { id: "e1", title: "Weekly Agency Mastermind", date: "Every Thursday 2pm ET", type: "recurring", attendees: 18 },
  { id: "e2", title: "Cold Outreach Workshop", date: "Apr 20, 2026 at 3pm ET", type: "workshop", attendees: 32 },
  { id: "e3", title: "Q2 Feature Roadmap Reveal", date: "Apr 28, 2026 at 12pm ET", type: "announcement", attendees: 56 },
  { id: "e4", title: "Guest Speaker: Scaling to $50k MRR", date: "May 5, 2026 at 1pm ET", type: "webinar", attendees: 44 },
];

const POLLS = [
  { id: "poll1", question: "What feature should we build next?", options: [
    { label: "AI Video Editor", votes: 34 },
    { label: "Proposal Builder", votes: 28 },
    { label: "Client Portal V2", votes: 45 },
    { label: "Advanced Analytics", votes: 19 },
  ], totalVotes: 126, endsIn: "2 days" },
  { id: "poll2", question: "How many clients are you managing?", options: [
    { label: "1-5", votes: 22 },
    { label: "6-15", votes: 38 },
    { label: "16-30", votes: 15 },
    { label: "30+", votes: 8 },
  ], totalVotes: 83, endsIn: "5 days" },
];

const RESOURCES = [
  { title: "2026 Social Media Calendar", type: "Template", downloads: 234, icon: Calendar },
  { title: "Cold DM Swipe File (50 templates)", type: "Swipe File", downloads: 189, icon: MessageSquare },
  { title: "Client Onboarding Checklist", type: "Checklist", downloads: 156, icon: BookOpen },
  { title: "Pricing Strategy Guide", type: "Guide", downloads: 201, icon: Star },
  { title: "SEO Audit Template", type: "Template", downloads: 143, icon: Search },
  { title: "Agency SOPs Bundle", type: "SOP", downloads: 167, icon: Shield },
];

const TRENDING = [
  { topic: "AI video generation", posts: 12, trend: "+240%" },
  { topic: "Client retention", posts: 8, trend: "+85%" },
  { topic: "Cold outreach scripts", posts: 6, trend: "+60%" },
  { topic: "Pricing strategies", posts: 5, trend: "+45%" },
  { topic: "White label services", posts: 4, trend: "+30%" },
];

const LEADERBOARD = [
  { name: "Nick S.", points: 2840, posts: 142, helpful: 89 },
  { name: "Sarah K.", points: 1650, posts: 87, helpful: 54 },
  { name: "Alex M.", points: 1280, posts: 64, helpful: 41 },
  { name: "Mike T.", points: 920, posts: 45, helpful: 28 },
  { name: "Priya S.", points: 540, posts: 28, helpful: 15 },
];

const GUIDELINES = [
  "Be respectful and professional in all interactions",
  "No spam, self-promotion without value, or affiliate links",
  "Share knowledge freely - we all grow together",
  "Keep client-specific information confidential",
  "Use appropriate channels for different types of content",
  "Report any violations to admins privately",
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"feed" | "members" | "events" | "resources" | "polls" | "moderation">("feed");
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [votedPolls, setVotedPolls] = useState<Record<string, number>>({});
  const [showNewPost, setShowNewPost] = useState(false);

  function toggleLike(postId: string) {
    setLikedPosts(prev => prev.includes(postId) ? prev.filter(p => p !== postId) : [...prev, postId]);
  }

  function votePoll(pollId: string, optionIdx: number) {
    setVotedPolls(prev => ({ ...prev, [pollId]: optionIdx }));
  }

  const POST_TYPES = [
    { id: "all", label: "All", icon: MessageSquare },
    { id: "announcement", label: "Announcements", icon: Megaphone },
    { id: "discussion", label: "Discussions", icon: Users },
    { id: "question", label: "Questions", icon: HelpCircle },
    { id: "resource", label: "Resources", icon: BookOpen },
    { id: "showcase", label: "Showcase", icon: Sparkles },
  ];

  const filteredPosts = MOCK_POSTS.filter(p => {
    if (filter !== "all" && p.type !== filter) return false;
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

  return (
    <div className="fade-in space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Community</h1>
            <p className="text-xs text-muted">Discussions, resources & events for the ShortStack community</p>
          </div>
        </div>
        <button onClick={() => setShowNewPost(!showNewPost)} className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1.5">
          <Plus size={14} /> New Post
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
          <p className="text-lg font-bold font-mono">{MOCK_POSTS.length}</p>
          <p className="text-[10px] text-muted">Posts This Week</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold font-mono text-gold">{EVENTS.length}</p>
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

          {/* Trending Topics */}
          <div className="card p-3">
            <h3 className="text-[10px] font-semibold mb-2 flex items-center gap-1"><TrendingUp size={10} className="text-gold" /> Trending</h3>
            <div className="flex gap-2 overflow-x-auto">
              {TRENDING.map(t => (
                <div key={t.topic} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-[9px] whitespace-nowrap shrink-0">
                  <Hash size={8} className="text-gold" />
                  <span>{t.topic}</span>
                  <span className="text-green-400 font-mono">{t.trend}</span>
                </div>
              ))}
            </div>
          </div>

          {/* New Post Form */}
          {showNewPost && (
            <div className="card p-4 border-gold/20">
              <h3 className="text-xs font-semibold mb-3">Create New Post</h3>
              <div className="space-y-3">
                <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground">
                  <option value="discussion">Discussion</option>
                  <option value="question">Question</option>
                  <option value="resource">Resource</option>
                  <option value="showcase">Showcase</option>
                </select>
                <input className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" placeholder="Post title..." />
                <textarea className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-24" placeholder="Share your thoughts..." />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowNewPost(false)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted">Cancel</button>
                  <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1"><Send size={10} /> Post</button>
                </div>
              </div>
            </div>
          )}

          {/* Posts */}
          <div className="space-y-3">
            {filteredPosts.map(post => {
              const tc = TYPE_CONFIG[post.type] || { bg: "bg-white/5 text-muted border-border", icon: MessageSquare };
              const TypeIcon = tc.icon;
              return (
                <div key={post.id} className={`card p-4 transition-all ${post.pinned ? "border-gold/20 bg-gold/[0.02]" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold shrink-0">
                      {post.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{post.author}</span>
                        {post.role === "admin" && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">ADMIN</span>}
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border ${tc.bg}`}><TypeIcon size={8} className="inline mr-0.5" />{post.type}</span>
                        {post.pinned && <Pin size={10} className="text-gold" />}
                        <span className="text-[9px] text-muted ml-auto">{post.created_at}</span>
                      </div>
                      <h3 className="text-sm font-medium mt-0.5">{post.title}</h3>
                      <p className="text-xs text-muted mt-1.5 leading-relaxed">
                        {expandedPost === post.id ? post.content : post.content.length > 200 ? post.content.slice(0, 200) + "..." : post.content}
                      </p>
                      <div className="flex items-center gap-3 mt-3">
                        <button onClick={() => toggleLike(post.id)}
                          className={`flex items-center gap-1 text-[10px] transition-colors ${likedPosts.includes(post.id) ? "text-red-400" : "text-muted hover:text-red-400"}`}>
                          <Heart size={12} fill={likedPosts.includes(post.id) ? "currentColor" : "none"} /> {post.likes + (likedPosts.includes(post.id) ? 1 : 0)}
                        </button>
                        <button onClick={() => setExpandedPost(expandedPost === post.id ? null : post.id)}
                          className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground">
                          <MessageSquare size={12} /> {post.comments}
                          <ChevronDown size={10} className={expandedPost === post.id ? "rotate-180" : ""} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ---- TAB: Members ---- */}
      {activeTab === "members" && (
        <div className="space-y-4">
          {/* Leaderboard */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Award size={12} className="text-gold" /> Activity Leaderboard</h3>
            <div className="space-y-2">
              {LEADERBOARD.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? "bg-gold/20 text-gold" : i === 1 ? "bg-gray-300/20 text-gray-300" : i === 2 ? "bg-orange-400/20 text-orange-400" : "bg-white/5 text-muted"
                  }`}>{i + 1}</span>
                  <span className="text-xs font-medium flex-1">{m.name}</span>
                  <span className="text-[10px] text-muted">{m.posts} posts</span>
                  <span className="text-[10px] text-muted">{m.helpful} helpful</span>
                  <span className="text-xs font-bold font-mono text-gold">{m.points.toLocaleString()} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* Member Directory */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-gold" /> Member Directory</h3>
            <div className="space-y-2">
              {MEMBERS.map(m => (
                <div key={m.name} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-xs font-bold text-gold">{m.name.charAt(0)}</div>
                      {m.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-surface" />}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{m.name}</p>
                      <p className="text-[10px] text-muted">{m.role} &middot; {m.level}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.badge === "gold" && <Award size={12} className="text-gold" />}
                    {m.badge === "silver" && <Award size={12} className="text-gray-300" />}
                    {m.badge === "bronze" && <Award size={12} className="text-orange-400" />}
                    <span className="text-[9px] text-muted">{m.posts} posts</span>
                    <span className="text-[9px] text-muted">Joined {m.joined}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Events ---- */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-gold" /> Upcoming Events</h3>
            <div className="space-y-2">
              {EVENTS.map(ev => (
                <div key={ev.id} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">{ev.title}</p>
                      <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5"><Clock size={8} /> {ev.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted flex items-center gap-1"><Users size={8} /> {ev.attendees}</span>
                      <button className="px-2 py-1 rounded-lg bg-gold text-black text-[10px] font-semibold">RSVP</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Resources ---- */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><BookOpen size={12} className="text-gold" /> Resource Library</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {RESOURCES.map(r => (
                <div key={r.title} className="p-3 rounded-lg border border-border hover:border-gold/20 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center"><r.icon size={14} className="text-gold" /></div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{r.title}</p>
                      <p className="text-[10px] text-muted">{r.type} &middot; {r.downloads} downloads</p>
                    </div>
                    <button className="text-[10px] text-gold hover:underline">Download</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Polls ---- */}
      {activeTab === "polls" && (
        <div className="space-y-4">
          {POLLS.map(poll => (
            <div key={poll.id} className="card p-4">
              <h3 className="text-xs font-semibold mb-1">{poll.question}</h3>
              <p className="text-[9px] text-muted mb-3">{poll.totalVotes} votes &middot; Ends in {poll.endsIn}</p>
              <div className="space-y-2">
                {poll.options.map((opt, i) => {
                  const pct = Math.round((opt.votes / poll.totalVotes) * 100);
                  const voted = votedPolls[poll.id] === i;
                  return (
                    <button key={i} onClick={() => votePoll(poll.id, i)} className="w-full text-left">
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
          ))}
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
