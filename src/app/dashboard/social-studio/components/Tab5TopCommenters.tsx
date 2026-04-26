"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Reply, Sparkles, Users } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/modal";
import type { TopCommenter } from "@/lib/social-studio/types";
import PlatformChip from "./PlatformChip";

export default function Tab5TopCommenters() {
  const [commenters, setCommenters] = useState<TopCommenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TopCommenter | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/social/top-commenters");
        if (!res.ok) {
          if (!cancelled) setCommenters([]);
          return;
        }
        const json = await res.json();
        if (!cancelled) setCommenters((json.commenters ?? []) as TopCommenter[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onDraft = async (c: TopCommenter) => {
    setActive(c);
    setDraftReply("");
    setDrafting(true);
    try {
      const res = await fetch("/api/social/top-commenters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: c.commenter_handle,
          platform: c.platform,
          last_comment: c.most_recent_comment,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "AI couldn't draft");
        return;
      }
      const json = await res.json();
      setDraftReply(json.reply ?? "");
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/40 bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-gold" />
          <h3 className="text-sm font-semibold tracking-tight">Top commenters — last 30 days</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted">
            <Loader2 size={12} className="animate-spin mr-2" />
            Loading commenters…
          </div>
        ) : commenters.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare size={20} className="mx-auto text-muted/50 mb-2" />
            <p className="text-xs text-muted">
              No comments yet. Once Zernio webhooks start dropping comments here, they&apos;ll appear ranked by activity.
            </p>
            <p className="text-[10px] text-muted/70 mt-2">
              {/* TODO: real Zernio data — wire /api/webhooks/zernio/comment to insert into social_comments */}
              Coming soon: live comment feed from Instagram, TikTok, Facebook + LinkedIn.
            </p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left py-2 font-medium">Commenter</th>
                <th className="text-left py-2 font-medium">Platform</th>
                <th className="text-right py-2 font-medium">Comments</th>
                <th className="text-left py-2 font-medium pl-3">Most recent</th>
                <th className="text-right py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commenters.map((c) => (
                <tr key={`${c.platform}:${c.commenter_handle}`} className="border-t border-border/20 hover:bg-elevated/40">
                  <td className="py-2 pr-2 font-medium">@{c.commenter_handle}</td>
                  <td className="py-2 pr-2">
                    <PlatformChip platform={c.platform} />
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{c.total_comments}</td>
                  <td className="py-2 pl-3 max-w-[280px] truncate text-muted" title={c.most_recent_comment}>
                    {c.most_recent_comment}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onDraft(c)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gold/10 border border-gold/30 text-[10px] text-gold hover:bg-gold/20"
                    >
                      <Sparkles size={10} />
                      Reply with AI
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={!!active}
        onClose={() => setActive(null)}
        title={active ? `Reply to @${active.commenter_handle}` : "Reply"}
        size="md"
      >
        {active && (
          <div className="px-5 py-4 space-y-3">
            <div className="rounded-md bg-elevated p-3 text-xs">
              <span className="text-[10px] uppercase tracking-wider text-muted">Their comment</span>
              <p className="text-foreground mt-1 leading-relaxed">{active.most_recent_comment}</p>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted">Your draft reply</label>
              {drafting && !draftReply ? (
                <div className="flex items-center gap-2 py-3 text-xs text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  AI drafting…
                </div>
              ) : (
                <textarea
                  value={draftReply}
                  onChange={(e) => setDraftReply(e.target.value)}
                  rows={5}
                  className="w-full mt-1 px-3 py-2 rounded-md bg-elevated border border-border/40 text-sm"
                />
              )}
              <p className="text-[10px] text-muted mt-1">
                Tweak this and copy/paste — v2 will post it to {active.platform} automatically.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
              <button
                type="button"
                onClick={() => setActive(null)}
                className="px-3 py-1.5 text-xs rounded-md border border-border/40 hover:bg-elevated"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!draftReply) return;
                  try {
                    await navigator.clipboard.writeText(draftReply);
                    toast.success("Reply copied to clipboard");
                  } catch {
                    toast.error("Couldn't copy — select manually");
                  }
                }}
                disabled={!draftReply}
                className="px-3 py-1.5 text-xs rounded-md bg-gold/20 border border-gold/40 text-gold inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Reply size={10} />
                Copy reply
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
