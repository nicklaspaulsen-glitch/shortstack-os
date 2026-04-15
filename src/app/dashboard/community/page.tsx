"use client";

import { useState } from "react";
import {
  MessageSquare, Plus, Pin, Heart, Send, Users,
  Megaphone, HelpCircle, Sparkles, BookOpen, ChevronDown,
  Search, Calendar, Award, Bell, Shield, Vote,
  TrendingUp, Clock, Hash
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

const MOCK_POSTS: Post[] = [];

const TYPE_CONFIG: Record<string, { bg: string; icon: typeof MessageSquare }> = {
  announcement: { bg: "bg-gold/10 text-gold border-gold/20", icon: Megaphone },
  discussion: { bg: "bg-blue-400/10 text-blue-400 border-blue-400/20", icon: Users },
  question: { bg: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", icon: HelpCircle },
  resource: { bg: "bg-green-400/10 text-green-400 border-green-400/20", icon: BookOpen },
  showcase: { bg: "bg-purple-400/10 text-purple-400 border-purple-400/20", icon: Sparkles },
};

const MEMBERS: { name: string; role: string; level: string; badge: string; posts: number; joined: string; online: boolean }[] = [];

const EVENTS: { id: string; title: string; date: string; type: string; attendees: number }[] = [];

const POLLS: { id: string; question: string; options: { label: string; votes: number }[]; totalVotes: number; endsIn: string }[] = [];

const RESOURCES: { title: string; type: string; downloads: number; icon: typeof Calendar }[] = [];

const TRENDING: { topic: string; posts: number; trend: string }[] = [];

const LEADERBOARD: { name: string; points: number; posts: number; helpful: number }[] = [];

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
            {TRENDING.length === 0 ? (
              <p className="text-[10px] text-muted">No trending topics yet</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto">
                {TRENDING.map(t => (
                  <div key={t.topic} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-[9px] whitespace-nowrap shrink-0">
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
            {filteredPosts.length === 0 ? (
              <div className="card text-center py-12"><MessageSquare size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No posts yet. Be the first to share!</p></div>
            ) : filteredPosts.map(post => {
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
            {LEADERBOARD.length === 0 ? (
              <div className="text-center py-8"><Award size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No leaderboard data yet</p></div>
            ) : (
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
            )}
          </div>

          {/* Member Directory */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Users size={12} className="text-gold" /> Member Directory</h3>
            {MEMBERS.length === 0 ? (
              <div className="text-center py-8"><Users size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No members yet</p></div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Events ---- */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-gold" /> Upcoming Events</h3>
            {EVENTS.length === 0 ? (
              <div className="text-center py-8"><Calendar size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No upcoming events</p></div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Resources ---- */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><BookOpen size={12} className="text-gold" /> Resource Library</h3>
            {RESOURCES.length === 0 ? (
              <div className="text-center py-8"><BookOpen size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No resources yet</p></div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* ---- TAB: Polls ---- */}
      {activeTab === "polls" && (
        <div className="space-y-4">
          {POLLS.length === 0 ? (
            <div className="card text-center py-12"><Vote size={24} className="mx-auto mb-2 text-muted/30" /><p className="text-xs text-muted">No polls yet</p></div>
          ) : POLLS.map(poll => (
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
