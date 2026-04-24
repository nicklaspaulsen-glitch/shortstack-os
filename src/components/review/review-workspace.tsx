"use client";

// Unified 3-pane review workspace used by both authenticated dashboard
// (`/dashboard/review/[sessionId]`) and anonymous client-side magic-link
// (`/review/[token]`). The difference between the two is driven purely by
// props: which endpoints to hit + whether certain actions are available.

import { useEffect, useMemo, useState } from "react";
import AssetViewer from "./asset-viewer";
import CommentsPane from "./comments-pane";
import type {
  ReviewAssetType,
  ReviewComment,
  ReviewRegion,
  ReviewStatus,
  ReviewVersion,
} from "@/lib/review/types";

interface SessionLike {
  id: string;
  title: string;
  asset_url: string;
  asset_type: ReviewAssetType;
  version: number;
  status: ReviewStatus;
  approved_by_name?: string | null;
}

interface PendingPin {
  timestamp_seconds?: number;
  region?: ReviewRegion;
  page_number?: number;
}

interface Props {
  session: SessionLike;
  versions: Array<Pick<ReviewVersion, "version" | "asset_url" | "uploaded_at" | "release_notes">>;
  initialComments: ReviewComment[];
  mode: "agency" | "client";
  /** Endpoint for comment POST/GET and resolve */
  commentsEndpoint: string;
  /** Optional extra header to include on requests (e.g. X-Review-Token) */
  extraHeaders?: Record<string, string>;
  /** Called when client changes status via approve/revisions */
  onStatusChange?: (status: ReviewStatus) => void;
  /** Approve / revisions endpoint (for client mode) */
  approveEndpoint?: string;
  /** Top bar action strip (agency-only buttons live here) */
  topBarActions?: React.ReactNode;
}

export default function ReviewWorkspace({
  session,
  versions,
  initialComments,
  mode,
  commentsEndpoint,
  extraHeaders = {},
  onStatusChange,
  approveEndpoint,
  topBarActions,
}: Props) {
  const [comments, setComments] = useState<ReviewComment[]>(initialComments);
  const [selectedVersion, setSelectedVersion] = useState<number>(session.version);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<PendingPin | null>(null);
  const [storedIdentity, setStoredIdentity] = useState<{ name: string; email: string } | null>(null);
  const [approving, setApproving] = useState(false);
  const [showRevisionBox, setShowRevisionBox] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  // Load stored client identity from localStorage once
  useEffect(() => {
    if (mode !== "client") return;
    try {
      const raw = localStorage.getItem(`review-identity:${session.id}`);
      if (raw) setStoredIdentity(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [mode, session.id]);

  function saveIdentity(id: { name: string; email: string }) {
    setStoredIdentity(id);
    try {
      localStorage.setItem(`review-identity:${session.id}`, JSON.stringify(id));
    } catch {
      /* ignore */
    }
  }

  // Track new-comment count per version for diff indicator
  const newCountByVersion = useMemo(() => {
    const currentV = session.version;
    const map = new Map<number, number>();
    for (const c of comments) {
      if (c.version < currentV) {
        map.set(c.version, (map.get(c.version) ?? 0) + 1);
      }
    }
    return map;
  }, [comments, session.version]);

  const currentAssetUrl =
    selectedVersion === session.version
      ? session.asset_url
      : versions.find((v) => v.version === selectedVersion)?.asset_url ?? session.asset_url;

  async function submitComment(payload: {
    content: string;
    author_name: string;
    author_email?: string;
    pin: PendingPin | null;
    thread_parent_id?: string | null;
    page_number?: number;
  }) {
    const body = {
      content: payload.content,
      author_name: payload.author_name,
      author_email: payload.author_email,
      version: selectedVersion,
      thread_parent_id: payload.thread_parent_id ?? null,
      timestamp_seconds: payload.pin?.timestamp_seconds ?? null,
      region: payload.pin?.region ?? null,
      page_number: payload.pin?.page_number ?? payload.page_number ?? null,
    };
    const res = await fetch(commentsEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to post comment");
      return;
    }
    const j = await res.json();
    if (j.comment) {
      setComments((prev) => [...prev, j.comment as ReviewComment]);
      setPendingPin(null);
    }
  }

  async function toggleResolved(commentId: string, resolved: boolean) {
    const res = await fetch(`${commentsEndpoint}/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify({ resolved }),
    });
    if (!res.ok) return;
    const j = await res.json();
    if (j.comment) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? (j.comment as ReviewComment) : c)),
      );
    }
  }

  async function doApprove() {
    if (!approveEndpoint) return;
    const name =
      storedIdentity?.name ||
      (mode === "client" ? window.prompt("Your name (for the approval record)?") : null);
    if (mode === "client" && !name) return;
    setApproving(true);
    try {
      const res = await fetch(approveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({ approved_by_name: name }),
      });
      if (res.ok) {
        onStatusChange?.("approved");
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to approve");
      }
    } finally {
      setApproving(false);
    }
  }

  async function doRequestRevisions() {
    if (!approveEndpoint) return;
    const name =
      storedIdentity?.name ||
      (mode === "client" ? window.prompt("Your name?") : null) ||
      "Client";
    setApproving(true);
    try {
      const res = await fetch(approveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({
          request_revisions: true,
          revision_notes: revisionNote,
          approved_by_name: name,
        }),
      });
      if (res.ok) {
        setShowRevisionBox(false);
        setRevisionNote("");
        onStatusChange?.("revisions_requested");
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to request revisions");
      }
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 p-3 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="font-semibold text-white truncate">{session.title}</h2>
          <StatusBadge status={session.status} />
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(Number(e.target.value))}
            className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-white"
          >
            {[
              { version: session.version, asset_url: session.asset_url },
              ...versions.filter((v) => v.version !== session.version),
            ]
              .sort((a, b) => b.version - a.version)
              .map((v) => {
                const newCount = newCountByVersion.get(v.version);
                return (
                  <option key={v.version} value={v.version}>
                    v{v.version} {v.version === session.version ? "(current)" : ""}
                    {newCount ? ` — ${newCount} comments` : ""}
                  </option>
                );
              })}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {mode === "client" && session.status !== "approved" && (
            <>
              <button
                type="button"
                onClick={() => setShowRevisionBox((v) => !v)}
                disabled={approving}
                className="px-3 py-1.5 text-xs rounded border border-white/20 text-white hover:bg-white/5"
              >
                Request revisions
              </button>
              <button
                type="button"
                onClick={doApprove}
                disabled={approving}
                className="px-3 py-1.5 text-xs rounded bg-green-500 text-white font-semibold hover:bg-green-600"
              >
                {approving ? "Approving..." : "Approve"}
              </button>
            </>
          )}
          {mode === "client" && session.status === "approved" && session.approved_by_name && (
            <span className="text-xs text-green-400">
              Approved by {session.approved_by_name}
            </span>
          )}
          {topBarActions}
        </div>
      </div>

      {showRevisionBox && (
        <div className="p-3 border-b border-white/10 bg-black/30 space-y-2">
          <textarea
            value={revisionNote}
            onChange={(e) => setRevisionNote(e.target.value)}
            placeholder="What needs to change? (optional)"
            rows={2}
            className="w-full px-2 py-1.5 text-sm rounded bg-white/5 border border-white/10 text-white placeholder-white/40"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowRevisionBox(false)}
              className="px-3 py-1 text-xs rounded border border-white/20 text-white/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doRequestRevisions}
              disabled={approving}
              className="px-3 py-1 text-xs rounded bg-orange-500 text-white font-semibold"
            >
              {approving ? "Sending..." : "Send revision request"}
            </button>
          </div>
        </div>
      )}

      {/* Main area: viewer | comments */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-0">
        <div className="p-4 overflow-auto flex items-center justify-center bg-black/20">
          <AssetViewer
            assetUrl={currentAssetUrl}
            assetType={session.asset_type}
            comments={comments}
            version={selectedVersion}
            onAddPin={(pin) => setPendingPin(pin)}
            activeCommentId={activeCommentId}
            onSelectComment={(id) => setActiveCommentId(id)}
            pendingPin={pendingPin}
          />
        </div>
        <div className="border-l border-white/10 bg-black/30 min-h-0 flex flex-col">
          <CommentsPane
            comments={comments}
            version={selectedVersion}
            activeCommentId={activeCommentId}
            onSelectComment={setActiveCommentId}
            pendingPin={pendingPin}
            onClearPendingPin={() => setPendingPin(null)}
            onSubmitComment={submitComment}
            onToggleResolved={mode === "agency" ? toggleResolved : undefined}
            storedIdentity={storedIdentity}
            onSetIdentity={saveIdentity}
            canResolve={mode === "agency"}
            showPageNumberPicker={session.asset_type === "pdf"}
          />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-white/10 text-white/70" },
    in_review: { label: "In review", cls: "bg-blue-500/20 text-blue-300" },
    approved: { label: "Approved", cls: "bg-green-500/20 text-green-300" },
    revisions_requested: { label: "Revisions", cls: "bg-orange-500/20 text-orange-300" },
    archived: { label: "Archived", cls: "bg-white/5 text-white/40" },
  };
  const m = map[status];
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded ${m.cls}`}>{m.label}</span>
  );
}
