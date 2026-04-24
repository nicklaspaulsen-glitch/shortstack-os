"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Upload, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ReviewWorkspace from "@/components/review/review-workspace";
import type { ReviewComment, ReviewSession, ReviewVersion } from "@/lib/review/types";

export default function DashboardReviewDetail({
  params,
}: {
  params: { sessionId: string };
}) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [versions, setVersions] = useState<ReviewVersion[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/review/sessions/${params.sessionId}`);
    if (res.ok) {
      const j = await res.json();
      setSession(j.session);
      setVersions(j.versions ?? []);
      setComments(j.comments ?? []);
    }
    setLoading(false);
  }, [params.sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function copyShareLink() {
    if (!session) return;
    const url = `${window.location.origin}/review/${session.magic_link_token}`;
    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function handleNewVersion(file: File) {
    if (!session) return;
    setUploadingVersion(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${session.id}/v${session.version + 1}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("review-assets")
        .upload(path, file, { cacheControl: "3600" });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from("review-assets").getPublicUrl(path);

      const notes = window.prompt("Release notes for this version (optional)") || "";

      const res = await fetch(
        `/api/review/sessions/${session.id}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset_url: publicUrl, release_notes: notes }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to save new version");
        return;
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingVersion(false);
    }
  }

  async function changeStatus(status: ReviewSession["status"]) {
    if (!session) return;
    const res = await fetch(`/api/review/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const j = await res.json();
      setSession(j.session);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
      </div>
    );
  }
  if (!session) {
    return (
      <div className="py-20 text-center text-white/60">
        Review session not found.
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <Link
          href="/dashboard/review"
          className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> All reviews
        </Link>
      </div>

      <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
        <ReviewWorkspace
          session={session}
          versions={versions}
          initialComments={comments}
          mode="agency"
          commentsEndpoint={`/api/review/sessions/${session.id}/comments`}
          approveEndpoint={`/api/review/sessions/${session.id}/approve`}
          onStatusChange={(s) => setSession((prev) => (prev ? { ...prev, status: s } : prev))}
          topBarActions={
            <>
              <input
                id="review-new-version-upload"
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleNewVersion(f);
                }}
              />
              <label
                htmlFor="review-new-version-upload"
                className="px-3 py-1.5 text-xs rounded border border-white/20 text-white hover:bg-white/5 cursor-pointer flex items-center gap-1"
              >
                {uploadingVersion ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" /> New version
                  </>
                )}
              </label>
              <button
                type="button"
                onClick={copyShareLink}
                className="px-3 py-1.5 text-xs rounded border border-white/20 text-white hover:bg-white/5 flex items-center gap-1"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3 h-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> Share link
                  </>
                )}
              </button>
              {session.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => changeStatus("approved")}
                  className="px-3 py-1.5 text-xs rounded bg-green-500 text-white font-semibold hover:bg-green-600"
                >
                  Mark approved
                </button>
              )}
              {session.status !== "revisions_requested" && session.status !== "approved" && (
                <button
                  type="button"
                  onClick={() => changeStatus("revisions_requested")}
                  className="px-3 py-1.5 text-xs rounded bg-orange-500 text-white font-semibold hover:bg-orange-600"
                >
                  Mark revisions
                </button>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
