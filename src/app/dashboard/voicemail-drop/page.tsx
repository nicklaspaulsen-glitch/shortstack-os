"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Voicemail, Plus, Play, Pause, Trash2, Upload, Loader2, Phone, X, ShieldAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

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
  const [tcpaConsent, setTcpaConsent] = useState(false);

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
    if (!tcpaConsent) { toast.error("Confirm TCPA consent before dropping a voicemail"); return; }
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
      setTcpaConsent(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drop failed");
    } finally {
      setDropping(false);
    }
  }

  return (
    <MotionPage className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">{/* -- Voicemail Drop command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">VOICEMAIL DROPS</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Voicemail Drop</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-indigo-500 hover:bg-indigo-500/90 text-white transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Upload
                  </button>
                </motion.div>
      </div>
    </div>{/* Upload modal */}{showUpload && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-md  border border-black/10 bg-white shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
                    <p className="font-semibold text-[#0A0A0B]">Upload voicemail</p>
                    <button onClick={() => setShowUpload(false)} className="text-black/40 hover:text-[#0A0A0B]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-1.5 block">Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sales follow-up"
                        className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-[#0A0A0B] text-sm placeholder:text-black/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-1.5 block">Audio file (mp3 or wav, max 5 MB)</label>
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/wave"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full text-black/65 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[rgba(37,99,235,0.08)] file:text-[#2563EB] hover:file:bg-[rgba(37,99,235,0.14)]"
                      />
                      {file && (
                        <p className="text-xs text-black/40 mt-1.5">
                          {file.name} — {(file.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-black/8">
                    <button
                      onClick={() => setShowUpload(false)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-black/60 hover:text-[#0A0A0B] bg-black/5 hover:bg-black/8"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleUpload}
                      disabled={uploading || !name.trim() || !file}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white disabled:opacity-50"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? "Uploading…" : "Upload"}
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            )}{/* Drop modal */}{showDrop && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="w-full max-w-md  border border-black/10 bg-white shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
                    <p className="font-semibold text-[#0A0A0B]">Drop &quot;{showDrop.name}&quot;</p>
                    <button onClick={() => setShowDrop(null)} className="text-black/40 hover:text-[#0A0A0B]">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-5 flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-1.5 block">Recipient phone</label>
                      <input
                        value={dropTo}
                        onChange={(e) => setDropTo(e.target.value)}
                        placeholder="+15551234567"
                        className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-[#0A0A0B] text-sm font-mono placeholder:text-black/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-black/60 uppercase tracking-wider mb-1.5 block">From number (optional)</label>
                      <input
                        value={dropFrom}
                        onChange={(e) => setDropFrom(e.target.value)}
                        placeholder="Leave blank to use TWILIO_DEFAULT_NUMBER"
                        className="w-full px-3 py-2.5 rounded-lg bg-black/5 border border-black/10 text-[#0A0A0B] text-sm font-mono placeholder:text-black/30"
                      />
                    </div>
                    {/* TCPA compliance gate — required before any voicemail drop */}
                    <label className="flex items-start gap-2.5 cursor-pointer rounded-lg bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.25)] p-3">
                      <input
                        type="checkbox"
                        checked={tcpaConsent}
                        onChange={(e) => setTcpaConsent(e.target.checked)}
                        className="mt-0.5 accent-amber-400 shrink-0"
                      />
                      <span className="text-[11px] text-[#6B7280] leading-relaxed">
                        <ShieldAlert className="inline w-3 h-3 mr-1 text-[#2563EB]" />
                        I confirm I have prior express written consent to contact this recipient by phone (TCPA). Dropping a voicemail without consent may violate US federal law.
                      </span>
                    </label>
                    <p className="text-[11px] text-black/30">
                      The call is initiated immediately. When answered or routed to voicemail, the pre-recorded audio plays via Twilio TwiML.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-black/8">
                    <button
                      onClick={() => { setShowDrop(null); setTcpaConsent(false); }}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-black/60 hover:text-[#0A0A0B] bg-black/5 hover:bg-black/8"
                    >
                      Cancel
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDrop}
                      disabled={dropping || !dropTo.trim() || !tcpaConsent}
                      className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-500 text-white disabled:opacity-50"
                    >
                      {dropping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                      {dropping ? "Dropping…" : "Drop voicemail"}
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            )}{/* List */}{loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
              </div>
            ) : templates.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="glass rounded-xl border-2 border-dashed border-black/8 flex flex-col items-center justify-center py-14 gap-3 text-center"
              >
                <Voicemail className="w-10 h-10 text-black/20" />
                <p className="text-black/40 text-sm">No voicemail templates yet</p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-500 text-white"
                >
                  <Upload className="w-4 h-4" />
                  Upload your first
                </motion.button>
              </motion.div>
            ) : (
              <div className="glass rounded-xl overflow-hidden flex flex-col">
                {templates.map((t, index) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.18, delay: index * 0.04 }}
                    whileHover={{ backgroundColor: "rgba(0,0,0,0.03)" }}
                    className="border-b border-black/8 last:border-b-0 p-4 flex items-center gap-3 transition-colors"
                  >
                    <button
                      onClick={() => togglePlay(t)}
                      className="w-10 h-10 rounded-full bg-[rgba(37,99,235,0.10)] flex items-center justify-center text-[#2563EB] hover:bg-[rgba(37,99,235,0.14)] transition-all"
                      aria-label={playingId === t.id ? "Pause" : "Play"}
                    >
                      {playingId === t.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0A0A0B] truncate">{t.name}</p>
                      <p className="text-xs text-black/40">
                        {t.duration_seconds ? `${t.duration_seconds}s` : "—"} · {new Date(t.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowDrop(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(37,99,235,0.08)] text-[#2563EB] hover:bg-[rgba(37,99,235,0.14)] transition-all"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Drop
                    </motion.button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-black/40 hover:text-red-500 p-1.5"
                      aria-label="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}</MotionPage>
  );
}
