"use client";

import { useState } from "react";
import {
  MapPin, Star, Send, RefreshCw, Reply, PenTool, Eye,
  BarChart3, Image, Clock, Calendar, Plus,
  TrendingUp, Globe, Settings, CheckCircle,
  ArrowUpRight, Sparkles, MessageSquare, Tag
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

interface Review {
  id: string;
  name: string;
  stars: number;
  comment: string;
  date: string;
  replied: boolean;
  replyText?: string;
}

const MOCK_REVIEWS: Review[] = [];

const MOCK_POSTS: { id: string; content: string; date: string; views: number; clicks: number; type: string }[] = [];

const QA_DATA: { id: string; question: string; answer: string | null; askedBy: string; date: string }[] = [];

const INSIGHTS = {
  views: { total: 0, search: 0, maps: 0, trend: "--" },
  searches: { direct: 0, discovery: 0, branded: 0, trend: "--" },
  actions: { website: 0, directions: 0, calls: 0, messages: 0, trend: "--" },
  photos: { views: 0, count: 0, trend: "--" },
};

const LOCATIONS: { id: string; name: string; address: string; verified: boolean; rating: number; reviews: number }[] = [];

const CATEGORIES = ["Marketing Agency", "Digital Marketing Service", "Social Media Agency", "Advertising Agency", "SEO Service"];
const SELECTED_CATEGORIES = ["Marketing Agency", "Digital Marketing Service"];

const COMPETITOR_DATA: { name: string; rating: number; reviews: number; photos: number }[] = [];

const HOLIDAY_HOURS: { holiday: string; date: string; hours: string }[] = [];

const SCHEDULED_POSTS: { id: string; content: string; date: string; status: string }[] = [];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function GoogleBusinessPage() {
  const [activeTab, setActiveTab] = useState<"reviews" | "posts" | "insights" | "qa" | "photos" | "settings">("reviews");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("loc1");
  const [postContent, setPostContent] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [aiReply, setAiReply] = useState<Record<string, string>>({});

  const avgRating = MOCK_REVIEWS.length ? (MOCK_REVIEWS.reduce((s, r) => s + r.stars, 0) / MOCK_REVIEWS.length).toFixed(1) : "0.0";
  const needsReply = MOCK_REVIEWS.filter(r => !r.replied).length;

  function generateReply(review: Review) {
    setReplyingTo(review.id);
    setTimeout(() => {
      const templates: Record<number, string> = {
        5: `Thank you so much, ${review.name}! We're thrilled to hear about your positive experience. Your support means the world to us!`,
        4: `Thanks for the great review, ${review.name}! We appreciate your feedback and are always working to improve.`,
        3: `Thank you for your feedback, ${review.name}. We're committed to improving and would love to discuss how we can do better.`,
      };
      setAiReply(prev => ({ ...prev, [review.id]: templates[review.stars] || templates[3] }));
      setReplyText(templates[review.stars] || templates[3]);
    }, 800);
  }

  const renderStars = (rating: number, size: number = 10) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted/30"} />
      ))}
    </div>
  );

  const tabs = [
    { id: "reviews" as const, label: "Reviews", icon: Star },
    { id: "posts" as const, label: "Posts", icon: PenTool },
    { id: "insights" as const, label: "Insights", icon: BarChart3 },
    { id: "qa" as const, label: "Q&A", icon: MessageSquare },
    { id: "photos" as const, label: "Photos", icon: Image },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4285F4]/10 rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-[#4285F4]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Google Business</h1>
            <p className="text-xs text-muted">Manage listings, reviews, posts & local SEO</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground min-w-[160px]">
            {LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{avgRating}</p>
          <p className="text-[10px] text-muted flex items-center justify-center gap-0.5">{renderStars(Math.round(Number(avgRating)))} Avg</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{MOCK_REVIEWS.length}</p>
          <p className="text-[10px] text-muted">Total Reviews</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-yellow-400">{needsReply}</p>
          <p className="text-[10px] text-muted">Needs Reply</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-green-400 flex items-center justify-center gap-0.5">{INSIGHTS.views.total.toLocaleString()} <ArrowUpRight size={10} /></p>
          <p className="text-[10px] text-muted">Profile Views</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-[#4285F4]">{INSIGHTS.actions.website + INSIGHTS.actions.calls}</p>
          <p className="text-[10px] text-muted">Actions Taken</p>
        </div>
      </div>

      {/* Multi-location */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {LOCATIONS.map(l => (
          <div key={l.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] whitespace-nowrap shrink-0 cursor-pointer transition-all ${
            selectedLocation === l.id ? "border-[#4285F4]/30 bg-[#4285F4]/10 text-[#4285F4]" : "border-border text-muted"
          }`} onClick={() => setSelectedLocation(l.id)}>
            <MapPin size={10} />
            <span className="font-medium">{l.name.split(" - ")[1] || l.name}</span>
            {l.verified ? <CheckCircle size={8} className="text-green-400" /> : <Clock size={8} className="text-yellow-400" />}
            {l.rating > 0 && <span>{l.rating}<Star size={7} className="inline fill-yellow-400 text-yellow-400 ml-0.5" /></span>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all border ${
              activeTab === t.id ? "bg-[#4285F4]/10 border-[#4285F4]/20 text-[#4285F4] font-medium" : "border-border text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* ---- TAB: Reviews ---- */}
      {activeTab === "reviews" && (
        <div className="space-y-3">
          {/* Rating distribution */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Rating Distribution</h3>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(r => {
                const count = MOCK_REVIEWS.filter(rev => rev.stars === r).length;
                const pct = MOCK_REVIEWS.length ? Math.round((count / MOCK_REVIEWS.length) * 100) : 0;
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-xs w-4 text-right">{r}</span>
                    <Star size={8} className="fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full bg-yellow-400/40" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted w-10 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews */}
          {MOCK_REVIEWS.map(review => (
            <div key={review.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#4285F4]/10 flex items-center justify-center text-xs font-bold text-[#4285F4] shrink-0">
                  {review.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold">{review.name}</span>
                      <div className="flex items-center gap-1 mt-0.5">{renderStars(review.stars)}</div>
                    </div>
                    <span className="text-[9px] text-muted">{review.date}</span>
                  </div>
                  <p className="text-xs text-muted mt-2 leading-relaxed">{review.comment}</p>
                  {review.replied && review.replyText && (
                    <div className="mt-2 pl-3 border-l-2 border-[#4285F4]/20">
                      <p className="text-[10px] text-muted"><span className="font-medium text-[#4285F4]">Your reply:</span> {review.replyText}</p>
                    </div>
                  )}
                  {replyingTo === review.id && (
                    <div className="mt-2 space-y-2">
                      <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-16" placeholder="Write a reply..." />
                      <div className="flex gap-1.5">
                        <button className="px-2 py-1 rounded-lg bg-[#4285F4] text-white text-[10px] font-medium flex items-center gap-1"><Send size={8} /> Reply</button>
                        <button onClick={() => generateReply(review)} className="px-2 py-1 rounded-lg border border-border text-[10px] text-muted flex items-center gap-1"><Sparkles size={8} /> AI Reply</button>
                        <button onClick={() => { setReplyingTo(null); setReplyText(""); }} className="px-2 py-1 rounded-lg border border-border text-[10px] text-muted">Cancel</button>
                      </div>
                    </div>
                  )}
                  {!review.replied && replyingTo !== review.id && (
                    <button onClick={() => setReplyingTo(review.id)} className="mt-2 text-[10px] text-[#4285F4] hover:underline flex items-center gap-1"><Reply size={10} /> Reply</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- TAB: Posts ---- */}
      {activeTab === "posts" && (
        <div className="space-y-4">
          {/* Post Scheduler */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-[#4285F4]" /> Post Scheduler</h3>
            <div className="space-y-2 mb-3">
              {SCHEDULED_POSTS.map(sp => (
                <div key={sp.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div>
                    <p className="text-[10px] font-medium">{sp.content}</p>
                    <p className="text-[9px] text-muted flex items-center gap-1"><Clock size={8} /> {sp.date}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded ${sp.status === "scheduled" ? "bg-green-400/10 text-green-400" : "bg-yellow-400/10 text-yellow-400"}`}>{sp.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Create Post */}
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-semibold">Create GBP Post</h2>
            <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground h-24" placeholder="Share an update, promotion, or news..." />
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg bg-[#4285F4] text-white text-xs font-semibold flex items-center gap-1.5"><Send size={12} /> Publish</button>
              <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted flex items-center gap-1.5"><Calendar size={12} /> Schedule</button>
            </div>
          </div>

          {/* Recent Posts */}
          <div className="space-y-2">
            {MOCK_POSTS.map(p => (
              <div key={p.id} className="card p-3">
                <p className="text-xs">{p.content}</p>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted">
                  <span>{p.date}</span>
                  <span className="flex items-center gap-0.5"><Eye size={8} /> {p.views} views</span>
                  <span className="flex items-center gap-0.5"><ArrowUpRight size={8} /> {p.clicks} clicks</span>
                  <span className="bg-[#4285F4]/10 text-[#4285F4] px-1.5 py-0.5 rounded">{p.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: Insights ---- */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3">
              <p className="text-[9px] text-muted uppercase mb-1">Profile Views</p>
              <p className="text-xl font-bold">{INSIGHTS.views.total.toLocaleString()}</p>
              <span className="text-[9px] text-green-400 flex items-center gap-0.5"><TrendingUp size={8} /> {INSIGHTS.views.trend}</span>
            </div>
            <div className="card p-3">
              <p className="text-[9px] text-muted uppercase mb-1">Search Impressions</p>
              <p className="text-xl font-bold">{(INSIGHTS.searches.direct + INSIGHTS.searches.discovery).toLocaleString()}</p>
              <span className="text-[9px] text-green-400 flex items-center gap-0.5"><TrendingUp size={8} /> {INSIGHTS.searches.trend}</span>
            </div>
            <div className="card p-3">
              <p className="text-[9px] text-muted uppercase mb-1">Website Clicks</p>
              <p className="text-xl font-bold">{INSIGHTS.actions.website}</p>
              <span className="text-[9px] text-green-400 flex items-center gap-0.5"><TrendingUp size={8} /> {INSIGHTS.actions.trend}</span>
            </div>
            <div className="card p-3">
              <p className="text-[9px] text-muted uppercase mb-1">Phone Calls</p>
              <p className="text-xl font-bold">{INSIGHTS.actions.calls}</p>
            </div>
          </div>

          {/* Search breakdown */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">How Customers Find You</h3>
            <div className="space-y-2">
              {[
                { label: "Direct searches", value: INSIGHTS.searches.direct, color: "bg-[#4285F4]" },
                { label: "Discovery searches", value: INSIGHTS.searches.discovery, color: "bg-green-400" },
                { label: "Branded searches", value: INSIGHTS.searches.branded, color: "bg-gold" },
              ].map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px]">{s.label}</span>
                    <span className="text-[10px] font-mono text-muted">{s.value}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}/40`} style={{ width: `${(s.value / (INSIGHTS.searches.direct + INSIGHTS.searches.discovery + INSIGHTS.searches.branded)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Competitor Comparison */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Eye size={12} className="text-[#4285F4]" /> Competitor Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted">Business</th>
                  <th className="text-center py-2 text-muted">Rating</th>
                  <th className="text-center py-2 text-muted">Reviews</th>
                  <th className="text-center py-2 text-muted">Photos</th>
                </tr></thead>
                <tbody>
                  {COMPETITOR_DATA.map(c => (
                    <tr key={c.name} className="border-b border-border/30">
                      <td className={`py-2 font-medium ${c.name === "Your Business" ? "text-[#4285F4]" : ""}`}>{c.name}</td>
                      <td className="text-center py-2">{c.rating}<Star size={7} className="inline fill-yellow-400 text-yellow-400 ml-0.5" /></td>
                      <td className="text-center py-2">{c.reviews}</td>
                      <td className="text-center py-2">{c.photos}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Q&A ---- */}
      {activeTab === "qa" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><MessageSquare size={12} className="text-[#4285F4]" /> Q&A Manager</h3>
          <div className="space-y-3">
            {QA_DATA.map(qa => (
              <div key={qa.id} className="p-3 rounded-lg border border-border">
                <p className="text-xs font-medium">Q: {qa.question}</p>
                <p className="text-[9px] text-muted mb-2">Asked by {qa.askedBy} &middot; {qa.date}</p>
                {qa.answer ? (
                  <p className="text-[10px] text-muted pl-3 border-l-2 border-[#4285F4]/20">A: {qa.answer}</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground" placeholder="Type an answer..." />
                    <button className="px-2 py-1 rounded-lg bg-[#4285F4] text-white text-[10px] font-medium">Answer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TAB: Photos ---- */}
      {activeTab === "photos" && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-2"><Image size={12} className="text-[#4285F4]" /> Photo Gallery</h3>
              <button className="px-3 py-1.5 rounded-lg bg-[#4285F4] text-white text-[10px] font-semibold flex items-center gap-1"><Plus size={10} /> Upload</button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-white/[0.02] border border-border flex items-center justify-center">
                  <Image size={20} className="text-muted/20" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-2">{INSIGHTS.photos.count} photos &middot; {INSIGHTS.photos.views.toLocaleString()} total views</p>
          </div>
        </div>
      )}

      {/* ---- TAB: Settings ---- */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* Categories */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Tag size={12} className="text-[#4285F4]" /> Category Optimizer</h3>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <span key={c} className={`text-[10px] px-2.5 py-1 rounded-lg border ${
                  SELECTED_CATEGORIES.includes(c) ? "border-[#4285F4]/30 bg-[#4285F4]/10 text-[#4285F4]" : "border-border text-muted"
                }`}>{c}</span>
              ))}
            </div>
          </div>

          {/* Service Area */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Globe size={12} className="text-[#4285F4]" /> Service Area</h3>
            <div className="flex flex-wrap gap-1.5">
              {([] as string[]).map(a => (
                <span key={a} className="text-[10px] px-2.5 py-1 rounded-lg border border-[#4285F4]/20 bg-[#4285F4]/5 text-[#4285F4]">{a}</span>
              ))}
              <p className="text-xs text-muted py-2">No service areas configured</p>
            </div>
          </div>

          {/* Holiday Hours */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Calendar size={12} className="text-[#4285F4]" /> Holiday Hours</h3>
            <div className="space-y-2">
              {HOLIDAY_HOURS.map(h => (
                <div key={h.holiday} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <div>
                    <p className="text-[10px] font-medium">{h.holiday}</p>
                    <p className="text-[9px] text-muted">{h.date}</p>
                  </div>
                  <span className="text-[10px] text-red-400">{h.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Update Tracker */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Clock size={12} className="text-[#4285F4]" /> Recent Listing Updates</h3>
            <div className="space-y-1.5 text-[10px]">
              {([] as { update: string; date: string }[]).map((u, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border">
                  <span className="text-muted">{u.update}</span>
                  <span className="text-muted">{u.date}</span>
                </div>
              ))}
              <p className="text-xs text-muted text-center py-4">No recent updates</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
