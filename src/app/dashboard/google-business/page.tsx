"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  MapPin, Star, Send, Loader, RefreshCw,
  Reply, PenTool
} from "lucide-react";
import toast from "react-hot-toast";

interface Review {
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl: string };
  starRating: string;
  comment: string;
  createTime: string;
  updateTime: string;
  name: string;
  reviewReply?: { comment: string; updateTime: string };
}

export default function GoogleBusinessPage() {
  useAuth();
  const supabase = createClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [tab, setTab] = useState<"reviews" | "post">("reviews");
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }) => {
      setClients(data || []);
      if (data?.[0]) setSelectedClient(data[0].id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClient) fetchReviews();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  async function fetchReviews() {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/google-business?client_id=${selectedClient}&action=reviews`);
      const data = await res.json();
      if (data.error?.includes("not connected") || data.connected === false) {
        setConnected(false);
      } else {
        setReviews(data.reviews || []);
        setTotalReviews(data.total || 0);
      }
    } catch { setConnected(false); }
    setLoading(false);
  }

  async function replyToReview(reviewName: string) {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      const res = await fetch("/api/integrations/google-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, action: "reply_review", review_name: reviewName, comment: replyText }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reply posted!");
        setReplyingTo(null);
        setReplyText("");
        fetchReviews();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Error"); }
    setReplying(false);
  }

  async function createPost() {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/integrations/google-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: selectedClient, action: "create_post", summary: postContent }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Post published to Google Business!");
        setPostContent("");
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Error"); }
    setPosting(false);
  }

  async function generateReply(review: Review) {
    setGenerating(true);
    setReplyingTo(review.name);
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write a short, professional reply to this Google Business review. Be grateful and warm. Review: "${review.comment}" (${review.starRating} stars by ${review.reviewer.displayName}). Keep it under 100 words.`,
          max_tokens: 200,
        }),
      });
      const data = await res.json();
      if (data.text) setReplyText(data.text);
    } catch { toast.error("Failed to generate reply"); }
    setGenerating(false);
  }

  const starMap: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (starMap[r.starRating] || 0), 0) / reviews.length).toFixed(1)
    : "0";

  if (!connected && !loading) {
    return (
      <div className="fade-in space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4285F4]/10 rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-[#4285F4]" />
          </div>
          <div>
            <h1 className="page-header mb-0">Google Business</h1>
            <p className="text-xs text-muted">Manage reviews and local presence</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <MapPin size={32} className="text-muted/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold mb-1">Google Business Not Connected</h2>
          <p className="text-xs text-muted mb-3">Connect a client&apos;s Google Business account via OAuth in the Integrations page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4285F4]/10 rounded-xl flex items-center justify-center">
            <MapPin size={20} className="text-[#4285F4]" />
          </div>
          <div>
            <h1 className="page-header mb-0">Google Business</h1>
            <p className="text-xs text-muted">Reviews, posts & local SEO management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input text-xs py-1.5 min-w-[160px]">
            {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
          </select>
          <button onClick={fetchReviews} className="btn-secondary text-xs flex items-center gap-1.5">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{avgRating}</p>
          <p className="text-[10px] text-muted flex items-center justify-center gap-0.5"><Star size={9} /> Avg Rating</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{totalReviews}</p>
          <p className="text-[10px] text-muted">Total Reviews</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-success">{reviews.filter(r => !r.reviewReply).length}</p>
          <p className="text-[10px] text-muted">Needs Reply</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {([
          { id: "reviews", label: "Reviews", icon: <Star size={13} /> },
          { id: "post", label: "Create Post", icon: <PenTool size={13} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-[#4285F4]/10 text-[#4285F4] font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader size={20} className="animate-spin text-[#4285F4]" /></div>
      ) : (
        <>
          {/* Reviews */}
          {tab === "reviews" && (
            <div className="space-y-2">
              {reviews.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">No reviews found</div>
              ) : (
                reviews.map((review, i) => {
                  const stars = starMap[review.starRating] || 0;
                  return (
                    <div key={i} className="card p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold text-gold shrink-0">
                          {review.reviewer.displayName?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs font-semibold">{review.reviewer.displayName}</span>
                              <div className="flex items-center gap-0.5 mt-0.5">
                                {Array.from({ length: 5 }).map((_, si) => (
                                  <Star key={si} size={10} className={si < stars ? "text-gold fill-gold" : "text-muted/30"} />
                                ))}
                              </div>
                            </div>
                            <span className="text-[9px] text-muted">{formatRelativeTime(review.createTime)}</span>
                          </div>
                          {review.comment && <p className="text-xs text-muted mt-2 leading-relaxed">{review.comment}</p>}

                          {/* Existing reply */}
                          {review.reviewReply && (
                            <div className="mt-2 pl-3 border-l-2 border-gold/20">
                              <p className="text-[10px] text-muted"><span className="font-medium text-gold">Your reply:</span> {review.reviewReply.comment}</p>
                            </div>
                          )}

                          {/* Reply form */}
                          {replyingTo === review.name ? (
                            <div className="mt-2 space-y-2">
                              <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                                className="input w-full h-16 text-xs" placeholder="Write a reply..." />
                              <div className="flex gap-1.5">
                                <button onClick={() => replyToReview(review.name)} disabled={replying}
                                  className="btn-primary text-[10px] px-2 py-1 flex items-center gap-1">
                                  {replying ? <Loader size={10} className="animate-spin" /> : <Send size={10} />} Reply
                                </button>
                                <button onClick={() => generateReply(review)} disabled={generating}
                                  className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                                  {generating ? <Loader size={10} className="animate-spin" /> : <Star size={10} />} AI Reply
                                </button>
                                <button onClick={() => { setReplyingTo(null); setReplyText(""); }}
                                  className="btn-ghost text-[10px] px-2 py-1">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            !review.reviewReply && (
                              <button onClick={() => setReplyingTo(review.name)}
                                className="mt-2 text-[10px] text-[#4285F4] hover:underline flex items-center gap-1">
                                <Reply size={10} /> Reply
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Create Post */}
          {tab === "post" && (
            <div className="card space-y-4">
              <h2 className="section-header">Create Google Business Post</h2>
              <p className="text-[10px] text-muted">Posts appear on your Google Business listing and in Google Maps/Search.</p>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Post Content *</label>
                <textarea value={postContent} onChange={e => setPostContent(e.target.value)}
                  className="input w-full h-28 text-xs" placeholder="Share an update, promotion, or news about the business..." />
              </div>
              <button onClick={createPost} disabled={posting || !postContent.trim()}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                {posting ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                Publish Post
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
