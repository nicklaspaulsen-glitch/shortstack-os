"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, Mic, FileAudio } from "lucide-react";
import toast from "react-hot-toast";
import { ALLOWED_VOICE_SAMPLE, buildAccept, validateFile } from "@/lib/file-types";
import { useAuth } from "@/lib/auth-context";

export default function NewMeetingPage() {
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<
    "idle" | "creating" | "uploading" | "transcribing" | "done"
  >("idle");
  const [dragOver, setDragOver] = useState(false);

  // Keep in sync with src/app/api/meetings/[id]/upload/route.ts MAX_BYTES.
  // Previously the client said 500 MB while the server capped at 250 MB,
  // so files 250-500 MB passed validation and 400'd at upload. Codex
  // round-1 catch.
  const MEETINGS_MAX_BYTES = 250 * 1024 * 1024;

  function pick(f: File | undefined) {
    if (!f) return;
    const err = validateFile(f, ALLOWED_VOICE_SAMPLE, MEETINGS_MAX_BYTES);
    if (err) { toast.error(err); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function run() {
    if (!file || !title.trim()) {
      toast.error("Pick an audio file and give the meeting a title.");
      return;
    }
    setBusy(true);
    setProgress(0);
    setStage("creating");
    try {
      // 1. Create meeting row.
      const createRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!createRes.ok) throw new Error("Couldn't create meeting");
      const { meeting } = await createRes.json();

      // 2. Upload audio with progress via XHR (fetch doesn't stream upload progress).
      setStage("uploading");
      await new Promise<void>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/meetings/${meeting.id}/upload`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else {
            let msg = `Upload failed (${xhr.status})`;
            try {
              const parsed = JSON.parse(xhr.responseText);
              if (parsed.error) msg = parsed.error;
            } catch {}
            reject(new Error(msg));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.send(form);
      });

      // 3. Kick off transcription (non-blocking UX: don't stall on long calls).
      setStage("transcribing");
      setProgress(100);
      const transRes = await fetch(`/api/meetings/${meeting.id}/transcribe`, {
        method: "POST",
      });
      if (transRes.status === 501) {
        toast(
          isPlatformAdmin
            ? "Transcription disabled — configure OPENAI_API_KEY to enable."
            : "Transcription isn't enabled on this workspace yet. Reach out to your platform admin to switch it on.",
          {
            icon: "⚙️",
            duration: 7000,
          }
        );
      } else if (!transRes.ok) {
        const err = await transRes.json().catch(() => ({}));
        toast.error(err.error || "Transcription failed — you can retry on the meeting page.");
      } else {
        toast.success("Transcription complete");
      }

      setStage("done");
      router.push(`/dashboard/meetings/${meeting.id}`);
    } catch (err) {
      console.error("[new meeting] error:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  const stageLabel = {
    idle: "",
    creating: "Creating meeting...",
    uploading: `Uploading audio ${progress}%`,
    transcribing: "Transcribing with Whisper...",
    done: "Done",
  }[stage];

  return (
    <div className="fade-in space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/meetings"
          className="text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-bold">New meeting</h1>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., 'Strategy kickoff — Acme Co'"
            className="input w-full text-xs"
          />
        </div>

        <div>
          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
            Audio file
          </label>
          <div
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-gold bg-gold/5"
                : file
                ? "border-green-400/30 bg-green-400/5"
                : "border-border hover:border-gold/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={buildAccept(ALLOWED_VOICE_SAMPLE)}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0] ?? undefined)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-[11px]">
                <FileAudio size={14} className="text-green-400" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted">
                  ({(file.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-[11px] font-medium">Drop an audio file here</p>
                <p className="text-[10px] text-muted mt-1">
                  MP3, WAV, M4A, OGG, WebM up to 250 MB
                </p>
              </>
            )}
          </div>
        </div>

        {busy && (
          <div className="space-y-2">
            <div className="h-1.5 bg-surface-light rounded-full overflow-hidden">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-muted flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" /> {stageLabel}
            </p>
          </div>
        )}

        <button
          onClick={run}
          disabled={busy || !file || !title.trim()}
          className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Mic size={12} />
          )}
          {busy ? stageLabel : "Upload + transcribe"}
        </button>
      </div>
    </div>
  );
}
