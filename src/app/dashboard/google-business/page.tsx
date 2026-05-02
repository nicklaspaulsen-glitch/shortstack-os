"use client";

import { useState } from "react";
import {
  MapPin, Star, Send, RefreshCw, Reply, PenTool, Eye,
  BarChart3, Image, Clock, Calendar, Plus,
  TrendingUp, Globe, Settings, CheckCircle,
  ArrowUpRight, Sparkles, MessageSquare, Tag,
  Globe as GlobeIcon,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
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

const CATEGORIES = ["Marketing Agency", "Digital Marketing Service", "Social Media Agency", "Advertising Agency", "SEO Service"];
const SELECTED_CATEGORIES = ["Marketing Agency", "Digital Marketing Service"];

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
  const [reviews] = useState<Review[]>([]);
  const [posts] = useState<{ id: string; content: string; date: string; views: number; clicks: number; type: string }[]>([]);

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.stars, 0) / reviews.length).toFixed(1) : "0.0";
  const needsReply = reviews.filter(r => !r.replied).length;

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
      <PageHero
        icon={<GlobeIcon size={28} />}
        title="Google Business"
        subtitle="Listings, reviews, posts & local SEO."
        gradient="blue"
        actions={
          <button className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white text-xs hover:bg-white/20 transition-all flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{avgRating}</p>
          <p className="text-[10px] text-muted flex items-center justify-center gap-0.5">{renderStars(Math.round(Number(avgRating)))} Avg</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{reviews.length}</p>
          <p className="text-[10px] text-muted">Total Reviews</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-yellow-400">{needsReply}</p>
          <p className="text-[10px] text-muted">Needs Reply</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-green-400">—</p>
          <p className="text-[10px] text-muted">Profile Views</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-[#4285F4]">—</p>
          <p className="text-[10px] text-muted">Actions Taken</p>
        </div>
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
                const count = reviews.filter(rev => rev.stars === r).length;
                const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
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
          {reviews.map(review => (
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
              <p className="text-xs text-muted text-center py-2">No scheduled posts.</p>
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
            {posts.map(p => (
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 size={24} className="text-muted mb-2" />
          <p className="text-sm text-muted">No insights data available yet.</p>
          <p className="text-[10px] text-muted mt-1">Connect your Google Business Profile to see performance data.</p>
        </div>
      )}

      {/* ---- TAB: Q&A ---- */}
      {activeTab === "qa" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><MessageSquare size={12} className="text-[#4285F4]" /> Q&A Manager</h3>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare size={24} className="text-muted mb-2" />
            <p className="text-xs text-muted">No questions yet.</p>
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
            <p className="text-[10px] text-muted mt-2">No photos uploaded yet.</p>
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
              <p className="text-xs text-muted text-center py-2">No holiday hours configured.</p>
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
