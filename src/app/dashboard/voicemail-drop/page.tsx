"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Voicemail, Plus, Play, Pause, Trash2, Upload, Loader2, Phone, X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

interface VoicemailTemplate {
  id: string;
  name: string;
  audio_url: string;
  duration_seconds: number | null;
  created_at: string;
}

export default function VoicemailDropPage() {
  const [templates, setTemplates] = useState<VoicemailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [showDrop, setShowDrop] = useState<VoicemailTemplate | null>(null);
  const [dropTo, setDropTo] = useState("");
  const [dropFrom, setDropFrom] = useState("");
  const [dropping, setDropping] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voicemail/templates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setTemplates((json.templates || []) as VoicemailTemplate[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  async function handleUpload() {
    if (!name.trim()) { toast.error("Name required"); return; }
    if (!file) { toast.error("Pick an audio file"); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("audio", file);

      const res = await fetch("/api/voicemail/templates", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      toast.success("Voicemail uploaded");
      setName("");
      setFile(null);
      setShowUpload(false);
      fetchTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this voicemail template?")) return;
    try {
      const res = await fetch(`/api/voicemail/templates?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Delete failed");
      toast.success("Deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  function togglePlay(t: VoicemailTemplate) {
    if (playingId === t.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const a = new Audio(t.audio_url);
    a.addEventListener("ended", () => setPlayingId(null));
    a.play().catch(() => toast.error("Could not play audio"));
    audioRef.current = a;
    setPlayingId(t.id);
  }

  async function handleDrop() {
    if (!showDrop) return;
    if (!dropTo.trim()) { toast.error("Recipient phone required"); return; }
    setDropping(true);
    try {
      const res = await fetch("/api/voicemail/drop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: showDrop.id,
          to_number: dropTo.trim(),
          from_number: dropFrom.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Drop failed");
      toast.success(`Voicemail dropped — call SID ${json.twilio_call_sid?.slice(0, 8)}…`);
      setShowDrop(null);
      setDropTo("");
      setDropFrom("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drop failed");
    } finally {
      setDropping(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHero
        title="Voicemail Drop"
        subtitle="Upload pre-recorded voicemails and drop them straight to a contact's inbox."
        icon={<Voicemail className="w-6 h-6" />}
        gradient="purple"
        actions={
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-gold hover:bg-gold/90 text-black transition-all"
          >
            <Plus className="w-4 h-4" />
            Upload
          </button>
        }
      />

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <p className="font-semibold text-white">Upload voicemail</p>
              <button onClick={() => setShowUpload(false)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5 block">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales follow-up"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5 block">Audio file (mp3 or wav, max 5 MB)</label>
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/wave"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full text-white/70 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gold/10 file:text-gold hover:file:bg-gold/20"
                />
                {file && (
                  <p className="text-xs text-white/40 mt-1.5">
                    {file.name} — {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/8">
              <button
                onClick={() => setShowUpload(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !name.trim() || !file}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-gold text-black disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop modal */}
      {showDrop && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <p className="font-semibold text-white">Drop &quot;{showDrop.name}&quot;</p>
              <button onClick={() => setShowDrop(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5 block">Recipient phone</label>
                <input
                  value={dropTo}
                  onChange={(e) => setDropTo(e.target.value)}
                  placeholder="+15551234567"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/30"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5 block">From number (optional)</label>
                <input
                  value={dropFrom}
                  onChange={(e) => setDropFrom(e.target.value)}
                  placeholder="Leave blank to use TWILIO_DEFAULT_NUMBER"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono placeholder:text-white/30"
                />
              </div>
              <p className="text-[11px] text-white/40">
                The call will be initiated immediately. When the call connects (or hits voicemail),
                the recorded audio plays automatically via Twilio TwiML.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/8">
              <button
                onClick={() => setShowDrop(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleDrop}
                disabled={dropping || !dropTo.trim()}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-gold text-black disabled:opacity-50"
              >
                {dropping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {dropping ? "Dropping…" : "Drop voicemail"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/8 flex flex-col items-center justify-center py-14 gap-3 text-center">
          <Voicemail className="w-10 h-10 text-white/20" />
          <p className="text-white/40 text-sm">No voicemail templates yet</p>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-gold text-black"
          >
            <Upload className="w-4 h-4" />
            Upload your first
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 p-4 flex items-center gap-3 transition-all"
            >
              <button
                onClick={() => togglePlay(t)}
                className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold hover:bg-gold/25 transition-all"
                aria-label={playingId === t.id ? "Pause" : "Play"}
              >
                {playingId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{t.name}</p>
                <p className="text-xs text-white/40">
                  {t.duration_seconds ? `${t.duration_seconds}s` : "—"} · {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowDrop(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition-all"
              >
                <Phone className="w-3.5 h-3.5" />
                Drop
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="text-white/40 hover:text-red-400 p-1.5"
                aria-label="Delete template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
