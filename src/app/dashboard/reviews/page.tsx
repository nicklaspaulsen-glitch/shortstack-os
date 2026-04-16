"use client";

import { useState } from "react";
import {
  Star, MessageSquare, Send, Sparkles, TrendingUp, Users, Clock,
  BarChart3, QrCode, Code, Bell, Eye,
  Copy, Award, Smile, Frown, Meh,
  Mail, Phone, AlertTriangle
} from "lucide-react";
import EmptyState from "@/components/empty-state";

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */

const MOCK_REVIEWS: { id: number; name: string; rating: number; text: string; date: string; source: string; responded: boolean; sentiment: string }[] = [];

const RESPONSE_TEMPLATES = [
  { id: "rt1", name: "5-Star Thank You", text: "Thank you so much for the wonderful review, {name}! We're thrilled to hear about your positive experience. Your support means the world to us!" },
  { id: "rt2", name: "4-Star Appreciation", text: "Thank you for the great feedback, {name}! We're glad you had a positive experience. We'll keep working to exceed your expectations." },
  { id: "rt3", name: "3-Star Improvement", text: "Thank you for your honest feedback, {name}. We appreciate your time and will use your input to improve. Please reach out so we can make it right." },
  { id: "rt4", name: "Negative Response", text: "We're sorry to hear about your experience, {name}. This isn't the standard we hold ourselves to. Please contact us directly so we can resolve this." },
  { id: "rt5", name: "Follow-Up Request", text: "Thank you for choosing us, {name}! We'd love to hear more about your experience. If you have a moment, a review on Google would mean a lot to us." },
];

const COMPETITOR_DATA: { name: string; rating: number; reviews: number; responseRate: number }[] = [];

const REVIEW_CAMPAIGNS: { id: string; name: string; sent: number; received: number; rate: string; active: boolean }[] = [];

const MONITORING_ALERTS: { id: string; type: string; message: string; time: string }[] = [];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function ReviewsPage() {
  const [reviews] = useState(MOCK_REVIEWS);
  const [activeTab, setActiveTab] = useState<"reviews" | "campaigns" | "widgets" | "analytics" | "competitors" | "testimonials">("reviews");
  const [aiResponses, setAiResponses] = useState<Record<number, string>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [filterSource, setFilterSource] = useState("all");
  const [filterRating, setFilterRating] = useState(0);
  const [requestName, setRequestName] = useState("");
  const [requestContact, setRequestContact] = useState("");
  const [requestMethod, setRequestMethod] = useState<"sms" | "email">("sms");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showQR, setShowQR] = useState(false);
  const [widgetStyle, setWidgetStyle] = useState<"badge" | "carousel" | "grid">("badge");

  const avgRating = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "0.0";
  const responseRate = reviews.length ? Math.round((reviews.filter(r => r.responded).length / reviews.length) * 100) : 0;
  const sentimentPositive = reviews.filter(r => r.sentiment === "positive").length;
  const sentimentNeutral = reviews.filter(r => r.sentiment === "neutral").length;
  const sentimentNegative = reviews.filter(r => r.sentiment === "negative").length;

  function handleAISuggest(review: typeof MOCK_REVIEWS[0]) {
    setLoadingId(review.id);
    setTimeout(() => {
      const templates: Record<number, string> = {
        5: `Thank you so much for the amazing review, ${review.name}! We're absolutely thrilled to hear you had such a great experience. Your kind words motivate our team every day!`,
        4: `Thank you for the wonderful feedback, ${review.name}! We're glad you enjoyed working with us. We'll keep pushing to make every experience even better!`,
        3: `Thanks for your honest feedback, ${review.name}. We value your input and are working on improving the areas you mentioned. Please don't hesitate to reach out!`,
        2: `We're sorry to hear about your experience, ${review.name}. This falls short of our standards. Please contact us directly so we can make things right.`,
        1: `We sincerely apologize for your experience, ${review.name}. We take this very seriously and would like to resolve this. Please reach out to our team.`,
      };
      setAiResponses(prev => ({ ...prev, [review.id]: templates[review.rating] || templates[3] }));
      setLoadingId(null);
    }, 1000);
  }

  const renderStars = (rating: number, size: number = 14) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={size} className={i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted/30"} />
      ))}
    </div>
  );

  const filteredReviews = reviews.filter(r => {
    if (filterSource !== "all" && r.source !== filterSource) return false;
    if (filterRating > 0 && r.rating !== filterRating) return false;
    return true;
  });

  const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
    rating: r,
    count: reviews.filter(rev => rev.rating === r).length,
    pct: reviews.length ? Math.round((reviews.filter(rev => rev.rating === r).length / reviews.length) * 100) : 0,
  }));

  const tabs = [
    { id: "reviews" as const, label: "Reviews", icon: Star },
    { id: "campaigns" as const, label: "Campaigns", icon: Send },
    { id: "widgets" as const, label: "Widgets", icon: Code },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "competitors" as const, label: "Competitors", icon: Eye },
    { id: "testimonials" as const, label: "Testimonials", icon: Award },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold flex items-center gap-2"><Star size={18} className="text-gold" /> Review Management</h1>
        <p className="text-xs text-muted">Monitor, respond to, and collect reviews across platforms</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-yellow-400/10"><TrendingUp size={14} className="text-yellow-400" /></div>
            <div>
              <p className="text-[9px] text-muted uppercase">Avg Rating</p>
              <div className="flex items-center gap-1">
                <p className="text-lg font-bold">{avgRating}</p>
                {renderStars(Math.round(Number(avgRating)), 10)}
              </div>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-400/10"><Users size={14} className="text-blue-400" /></div>
            <div>
              <p className="text-[9px] text-muted uppercase">Total Reviews</p>
              <p className="text-lg font-bold">{reviews.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-400/10"><Clock size={14} className="text-green-400" /></div>
            <div>
              <p className="text-[9px] text-muted uppercase">Response Rate</p>
              <p className="text-lg font-bold">{responseRate}%</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-400/10"><Smile size={14} className="text-green-400" /></div>
            <div>
              <p className="text-[9px] text-muted uppercase">Positive</p>
              <p className="text-lg font-bold text-green-400">{sentimentPositive}</p>
            </div>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-400/10"><Frown size={14} className="text-red-400" /></div>
            <div>
              <p className="text-[9px] text-muted uppercase">Negative</p>
              <p className="text-lg font-bold text-red-400">{sentimentNegative}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MONITORING_ALERTS.map(a => (
          <div key={a.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] whitespace-nowrap shrink-0 ${
            a.type === "warning" ? "bg-red-400/5 border-red-400/15 text-red-400" :
            a.type === "new" ? "bg-green-400/5 border-green-400/15 text-green-400" :
            a.type === "milestone" ? "bg-gold/5 border-gold/15 text-gold" :
            "bg-blue-400/5 border-blue-400/15 text-blue-400"
          }`}>
            {a.type === "warning" ? <AlertTriangle size={10} /> : a.type === "new" ? <Star size={10} /> : <Bell size={10} />}
            {a.message}
            <span className="text-muted">{a.time}</span>
          </div>
        ))}
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

      {/* ---- TAB: Reviews ---- */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          {/* Rating Distribution */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Star Rating Distribution</h3>
            <div className="space-y-1.5">
              {ratingDistribution.map(r => (
                <div key={r.rating} className="flex items-center gap-2">
                  <span className="text-xs w-8 text-right font-mono">{r.rating}<Star size={8} className="inline text-yellow-400 ml-0.5" /></span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-yellow-400/40" style={{ width: `${r.pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted w-16 text-right">{r.count} ({r.pct}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="flex gap-1">
              {["all", "Google", "Facebook", "Yelp"].map(s => (
                <button key={s} onClick={() => setFilterSource(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all capitalize ${
                    filterSource === s ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                  }`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-1">
              {[0, 5, 4, 3, 2, 1].map(r => (
                <button key={r} onClick={() => setFilterRating(r)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                    filterRating === r ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                  }`}>{r === 0 ? "All" : `${r}★`}</button>
              ))}
            </div>
          </div>

          {/* Reviews list */}
          {filteredReviews.length === 0 && (
            <EmptyState
              icon={<Star size={24} />}
              title="No reviews yet"
              description="Connect Google Business to start monitoring reviews"
              actionLabel="Connect Google Business"
              actionHref="/dashboard/google-business"
            />
          )}
          <div className="space-y-3">
            {filteredReviews.map(review => (
              <div key={review.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-xs font-semibold">{review.name}</span>
                      {renderStars(review.rating)}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{review.source}</span>
                      <span className="text-[10px] text-muted">{review.date}</span>
                      {review.responded && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-400/10 text-green-400">Responded</span>}
                      {review.sentiment === "positive" ? <Smile size={12} className="text-green-400" /> :
                       review.sentiment === "negative" ? <Frown size={12} className="text-red-400" /> :
                       <Meh size={12} className="text-yellow-400" />}
                    </div>
                    <p className="text-xs leading-relaxed">{review.text}</p>
                    {aiResponses[review.id] && (
                      <div className="mt-2 p-2 rounded-lg bg-gold/5 border border-gold/15">
                        <p className="text-[10px] text-gold font-medium mb-1 flex items-center gap-1"><Sparkles size={8} /> AI Suggested Response:</p>
                        <p className="text-xs text-muted">{aiResponses[review.id]}</p>
                        <div className="flex gap-1.5 mt-2">
                          <button onClick={() => navigator.clipboard.writeText(aiResponses[review.id])} className="text-[9px] px-2 py-0.5 rounded border border-border text-muted flex items-center gap-1"><Copy size={8} /> Copy</button>
                          <button className="text-[9px] px-2 py-0.5 rounded bg-gold text-black font-medium flex items-center gap-1"><Send size={8} /> Post Reply</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleAISuggest(review)} disabled={loadingId === review.id}
                    className="px-3 py-1.5 rounded-lg bg-gold text-black text-[10px] font-semibold flex items-center gap-1 shrink-0">
                    <Sparkles size={10} /> {loadingId === review.id ? "Generating..." : "AI Respond"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Request Review */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Request a Review</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input value={requestName} onChange={e => setRequestName(e.target.value)} placeholder="Client Name" className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              <input value={requestContact} onChange={e => setRequestContact(e.target.value)} placeholder="Phone or Email" className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground" />
              <div className="flex gap-1">
                <button onClick={() => setRequestMethod("sms")} className={`p-2 rounded-lg border ${requestMethod === "sms" ? "border-gold/30 text-gold" : "border-border text-muted"}`}><Phone size={14} /></button>
                <button onClick={() => setRequestMethod("email")} className={`p-2 rounded-lg border ${requestMethod === "email" ? "border-gold/30 text-gold" : "border-border text-muted"}`}><Mail size={14} /></button>
              </div>
              <button className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-semibold flex items-center gap-1"><Send size={12} /> Send Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Campaigns ---- */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Send size={12} className="text-gold" /> Review Request Campaigns</h3>
            <div className="space-y-2">
              {REVIEW_CAMPAIGNS.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-xs font-medium">{c.name}</p>
                    <p className="text-[10px] text-muted">{c.sent} sent &middot; {c.received} received &middot; {c.rate} conversion</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded ${c.active ? "bg-green-400/10 text-green-400" : "bg-white/5 text-muted"}`}>
                    {c.active ? "Active" : "Paused"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Templates */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><MessageSquare size={12} className="text-gold" /> Response Templates</h3>
            <div className="space-y-2">
              {RESPONSE_TEMPLATES.map(t => (
                <div key={t.id} className="p-3 rounded-lg border border-border">
                  <p className="text-xs font-medium mb-1">{t.name}</p>
                  <p className="text-[10px] text-muted">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Widgets ---- */}
      {activeTab === "widgets" && (
        <div className="space-y-4">
          {/* QR Code */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><QrCode size={12} className="text-gold" /> QR Code Generator</h3>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 bg-[#1a1c23] rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <QrCode size={48} className="text-foreground mx-auto" />
                  <p className="text-[8px] text-foreground mt-1">Scan to review</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted mb-2">Print this QR code and place it at your location. Customers can scan to leave a Google review.</p>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted flex items-center gap-1"><Copy size={10} /> Copy Link</button>
                  <button className="px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-semibold">Download QR</button>
                </div>
              </div>
            </div>
          </div>

          {/* Embeddable Widget */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Code size={12} className="text-gold" /> Embeddable Review Widget</h3>
            <div className="flex gap-1.5 mb-3">
              {(["badge", "carousel", "grid"] as const).map(s => (
                <button key={s} onClick={() => setWidgetStyle(s)}
                  className={`text-[10px] px-3 py-1 rounded-lg border capitalize transition-all ${
                    widgetStyle === s ? "border-gold/30 bg-gold/[0.05] text-gold" : "border-border text-muted"
                  }`}>{s}</button>
              ))}
            </div>
            {/* Widget preview */}
            <div className="p-4 rounded-lg border border-border bg-white/[0.02]">
              {widgetStyle === "badge" && (
                <div className="flex items-center gap-3 justify-center">
                  <Star size={24} className="fill-yellow-400 text-yellow-400" />
                  <div>
                    <p className="text-lg font-bold">{avgRating}</p>
                    <p className="text-[10px] text-muted">{reviews.length} reviews on Google</p>
                  </div>
                </div>
              )}
              {widgetStyle === "carousel" && (
                <div className="flex gap-2 overflow-x-auto">
                  {reviews.slice(0, 3).map(r => (
                    <div key={r.id} className="min-w-[200px] p-3 rounded-lg border border-border">
                      {renderStars(r.rating, 10)}
                      <p className="text-[10px] text-muted mt-1 line-clamp-2">{r.text}</p>
                      <p className="text-[9px] text-gold mt-1">- {r.name}</p>
                    </div>
                  ))}
                </div>
              )}
              {widgetStyle === "grid" && (
                <div className="grid grid-cols-2 gap-2">
                  {reviews.slice(0, 4).map(r => (
                    <div key={r.id} className="p-2 rounded-lg border border-border">
                      {renderStars(r.rating, 8)}
                      <p className="text-[9px] text-muted mt-1 line-clamp-2">{r.text}</p>
                      <p className="text-[8px] text-gold mt-1">- {r.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3">
              <p className="text-[10px] text-muted mb-1">Embed code:</p>
              <code className="block text-[9px] p-2 rounded-lg bg-white/[0.02] border border-border text-muted font-mono break-all">
                {`<script src="https://shortstackos.com/widget.js" data-style="${widgetStyle}"></script>`}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Analytics ---- */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><BarChart3 size={12} className="text-gold" /> Review Analytics</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-2xl font-bold text-green-400">{sentimentPositive}</p>
                <p className="text-[10px] text-muted flex items-center justify-center gap-1"><Smile size={10} /> Positive</p>
              </div>
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-2xl font-bold text-yellow-400">{sentimentNeutral}</p>
                <p className="text-[10px] text-muted flex items-center justify-center gap-1"><Meh size={10} /> Neutral</p>
              </div>
              <div className="p-3 rounded-lg border border-border text-center">
                <p className="text-2xl font-bold text-red-400">{sentimentNegative}</p>
                <p className="text-[10px] text-muted flex items-center justify-center gap-1"><Frown size={10} /> Negative</p>
              </div>
            </div>
          </div>

          {/* Reviews over time */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3">Reviews Over Time</h3>
            <div className="flex items-end gap-1 h-24">
              {["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"].map((m, i) => {
                const count = [0, 0, 0, 0, 0, 0, 0][i];
                const maxCount = Math.max(...[0, 0, 0, 0, 0, 0, 0], 1);
                return (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-muted">{count}</span>
                    <div className="w-full rounded-t bg-gold/30" style={{ height: `${(count / maxCount) * 100}%` }} />
                    <span className="text-[8px] text-muted">{m}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---- TAB: Competitors ---- */}
      {activeTab === "competitors" && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Eye size={12} className="text-gold" /> Competitor Comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted">Business</th>
                  <th className="text-center py-2 text-muted">Rating</th>
                  <th className="text-center py-2 text-muted">Total Reviews</th>
                  <th className="text-center py-2 text-muted">Response Rate</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_DATA.map(c => (
                  <tr key={c.name} className="border-b border-border/30">
                    <td className={`py-2 font-medium ${c.name === "Your Business" ? "text-gold" : ""}`}>{c.name}</td>
                    <td className="text-center py-2">{c.rating} <Star size={8} className="inline fill-yellow-400 text-yellow-400" /></td>
                    <td className="text-center py-2">{c.reviews}</td>
                    <td className="text-center py-2">{c.responseRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- TAB: Testimonials ---- */}
      {activeTab === "testimonials" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2"><Award size={12} className="text-gold" /> Testimonial Collector</h3>
            <p className="text-[10px] text-muted mb-3">Select reviews to feature as testimonials on your website.</p>
            <div className="space-y-2">
              {reviews.filter(r => r.rating >= 4).map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    {renderStars(r.rating, 10)}
                    <p className="text-[10px] text-muted mt-0.5 line-clamp-1">{r.text}</p>
                    <p className="text-[9px] text-gold">- {r.name}, {r.source}</p>
                  </div>
                  <button className="text-[10px] text-muted hover:text-foreground flex items-center gap-1"><Copy size={8} /> Use</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
