"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ReviewWorkspace from "@/components/review/review-workspace";
import type {
  PublicReviewSession,
  ReviewComment,
  ReviewStatus,
} from "@/lib/review/types";

export default function PublicReviewPage({
  params,
}: {
  params: { magicToken: string };
}) {
  const [session, setSession] = useState<PublicReviewSession | null>(null);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/review/public/${params.magicToken}`);
    if (!res.ok) {
      setError("This review link is invalid or no longer available.");
      setLoading(false);
      return;
    }
    const j = await res.json();
    setSession(j.session);
    setComments(j.comments ?? []);
    setLoading(false);
  }, [params.magicToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0a08] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }
  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0a08] text-white">
        <div className="max-w-md text-center p-6">
          <h1 className="text-xl font-bold mb-2">Review unavailable</h1>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0a08] text-white flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/10 bg-black/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/40 flex items-center justify-center font-bold text-[#C9A84C]">
            S
          </div>
          <div>
            <div className="text-sm font-semibold">ShortStack Review</div>
            <div className="text-[11px] text-white/50">
              Shared review — leave comments, approve, or request revisions.
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <ReviewWorkspace
          session={{
            id: session.id,
            title: session.title,
            asset_url: session.asset_url,
            asset_type: session.asset_type,
            version: session.version,
            status: session.status,
            approved_by_name: session.approved_by_name,
          }}
          versions={session.versions}
          initialComments={comments}
          mode="client"
          commentsEndpoint={`/api/review/sessions/${session.id}/comments`}
          approveEndpoint={`/api/review/sessions/${session.id}/approve`}
          extraHeaders={{ "X-Review-Token": params.magicToken }}
          onStatusChange={(s: ReviewStatus) =>
            setSession((prev) => (prev ? { ...prev, status: s } : prev))
          }
        />
      </main>
    </div>
  );
}
