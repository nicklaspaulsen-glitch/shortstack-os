"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Phone, PhoneCall, PhoneOff, SkipForward, Loader2, AlertTriangle,
  CheckCircle, Mic, MicOff, Voicemail, X, Plus, Trash2,
} from "lucide-react";
import StatCard from "@/components/ui/stat-card";

// ── Types ────────────────────────────────────────────────────────────
interface Contact {
  id: string;
  name: string;
  phone: string;
  notes?: string;
}

type Disposition =
  | "connected"
  | "voicemail"
  | "no_answer"
  | "wrong_number"
  | "do_not_call"
  | "other";

interface CallStats {
  dialed: number;
  connected: number;
  voicemails: number;
}

type CallStatus = "idle" | "connecting" | "ringing" | "in_progress" | "ended" | "failed";

// Twilio Voice SDK types (loaded dynamically). We type them loosely so
// SSR doesn't choke on the @twilio/voice-sdk module which references
// browser globals at import time.
interface TwilioDevice {
  register: () => Promise<void>;
  destroy: () => void;
  connect: (opts: { params: Record<string, string> }) => Promise<TwilioCall>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
}

interface TwilioCall {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  disconnect: () => void;
  mute: (m: boolean) => void;
}

const DISPOSITION_LABELS: Record<Disposition, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  do_not_call: "Do not call",
  other: "Other",
};

const DISPOSITION_ICONS: Record<Disposition, React.ReactNode> = {
  connected: <CheckCircle size={14} />,
  voicemail: <Voicemail size={14} />,
  no_answer: <PhoneOff size={14} />,
  wrong_number: <X size={14} />,
  do_not_call: <AlertTriangle size={14} />,
  other: <Phone size={14} />,
};

function toE164Display(raw: string): string {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (!cleaned) return raw;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

export default function DialerTab() {
  // ── Contact list state ─────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pasteValue, setPasteValue] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── Call lifecycle state ───────────────────────────────────────────
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [notes, setNotes] = useState("");

  // ── Stats (session-local, resets on reload) ────────────────────────
  const [stats, setStats] = useState<CallStats>({
    dialed: 0,
    connected: 0,
    voicemails: 0,
  });

  // ── Twilio Device state ────────────────────────────────────────────
  const deviceRef = useRef<TwilioDevice | null>(null);
  const callRef = useRef<TwilioCall | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);

  // ── Init Twilio Device on mount ────────────────────────────────────
  // We dynamically import @twilio/voice-sdk so the SSR build doesn't try
  // to evaluate browser-only globals during page-data collection.
  useEffect(() => {
    let cancelled = false;

    async function initDevice() {
      try {
        const tokenRes = await fetch("/api/dialer/token", { method: "POST" });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.configured) {
          if (!cancelled) {
            setTokenError(
              tokenData.error ||
                "Calls aren't available yet on this workspace. Reach out to your platform admin to enable Twilio voice.",
            );
          }
          return;
        }

        const { Device } = await import("@twilio/voice-sdk");
        if (cancelled) return;

        const device = new Device(tokenData.token, {
          codecPreferences: ["opus", "pcmu"] as never[],
          logLevel: 1,
        }) as unknown as TwilioDevice;

        device.on("registered", () => {
          if (!cancelled) setDeviceReady(true);
        });
        device.on("error", (...args: unknown[]) => {
          const err = args[0];
          console.error("[dialer] device error:", err);
          if (!cancelled) {
            const msg =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: string }).message)
                : "Twilio device error";
            setTokenError(msg);
          }
        });

        await device.register();
        if (!cancelled) deviceRef.current = device;
      } catch (err) {
        console.error("[dialer] init failed:", err);
        if (!cancelled) {
          setTokenError(err instanceof Error ? err.message : "Failed to init Twilio Voice");
        }
      }
    }

    initDevice();
    return () => {
      cancelled = true;
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          // teardown errors aren't actionable
        }
        deviceRef.current = null;
      }
    };
  }, []);

  // ── Live duration timer ────────────────────────────────────────────
  useEffect(() => {
    if (callStatus !== "in_progress" || !callStartTime) return;
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
    }, 500);
    return () => clearInterval(interval);
  }, [callStatus, callStartTime]);

  // ── Add contacts from textarea ─────────────────────────────────────
  // Accepts one phone per line, optionally "Name, +1 555..." format.
  const handleAddPasted = useCallback(() => {
    if (!pasteValue.trim()) return;
    const lines = pasteValue.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const next: Contact[] = [];
    for (const line of lines) {
      const [first, second] = line.split(/[,;\t]/).map((s) => s.trim());
      const phonePart = second || first;
      const namePart = second ? first : "";
      const cleaned = phonePart.replace(/[^\d+]/g, "");
      if (cleaned.length < 7) continue;
      next.push({
        id: `paste-${Date.now()}-${next.length}`,
        name: namePart || "Unknown",
        phone: toE164Display(phonePart),
      });
    }
    if (next.length === 0) return;
    setContacts((prev) => [...prev, ...next]);
    setPasteValue("");
  }, [pasteValue]);

  const handleClearList = useCallback(() => {
    setContacts([]);
    setCurrentIndex(0);
  }, []);

  // ── Place a call ────────────────────────────────────────────────────
  const startCall = useCallback(async (contact: Contact) => {
    if (!deviceRef.current || !deviceReady) {
      setTokenError("Voice device not ready yet — wait a moment and retry.");
      return;
    }

    setCallStatus("connecting");
    setNotes("");
    setCallDuration(0);
    setMuted(false);

    // Insert the voice_calls row first so we can attach disposition later.
    let callId: string | null = null;
    try {
      const res = await fetch("/api/dialer/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: contact.phone,
          contact_name: contact.name,
          contact_id: contact.id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        callId = data.id;
        setActiveCallId(callId);
      } else {
        throw new Error(data.error || "Failed to record call");
      }
    } catch (err) {
      console.error("[dialer] call record failed:", err);
      setCallStatus("failed");
      setTokenError(err instanceof Error ? err.message : "Failed to start call");
      return;
    }

    // Dial via the browser SDK. The TwiML app on the server side is
    // responsible for forwarding the call to the actual To number.
    try {
      const call = await deviceRef.current.connect({
        params: { To: contact.phone, CallId: callId || "" },
      });
      callRef.current = call;

      call.on("accept", () => {
        setCallStatus("in_progress");
        setCallStartTime(Date.now());
      });
      call.on("ringing", () => setCallStatus("ringing"));
      call.on("disconnect", () => {
        setCallStatus("ended");
        callRef.current = null;
      });
      call.on("error", (...args: unknown[]) => {
        console.error("[dialer] call error:", args[0]);
        setCallStatus("failed");
      });

      setStats((s) => ({ ...s, dialed: s.dialed + 1 }));
    } catch (err) {
      console.error("[dialer] dial failed:", err);
      setCallStatus("failed");
    }
  }, [deviceReady]);

  const hangUp = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.disconnect();
      } catch {
        // ignore — already disconnected
      }
      callRef.current = null;
    }
    setCallStatus("ended");
  }, []);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      callRef.current.mute(!muted);
      setMuted(!muted);
    }
  }, [muted]);

  // ── Save disposition + advance ─────────────────────────────────────
  const saveDisposition = useCallback(
    async (disposition: Disposition) => {
      if (!activeCallId) return;
      try {
        await fetch("/api/dialer/disposition", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            call_id: activeCallId,
            disposition,
            notes: notes || null,
            duration_seconds: callDuration,
          }),
        });
        if (disposition === "connected") {
          setStats((s) => ({ ...s, connected: s.connected + 1 }));
        } else if (disposition === "voicemail") {
          setStats((s) => ({ ...s, voicemails: s.voicemails + 1 }));
        }
      } catch (err) {
        console.error("[dialer] disposition save failed:", err);
      }
      setActiveCallId(null);
      setCallStatus("idle");
      setCallDuration(0);
      setCallStartTime(null);
      setNotes("");
    },
    [activeCallId, notes, callDuration],
  );

  const nextCall = useCallback(() => {
    if (currentIndex < contacts.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, contacts.length]);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setCurrentIndex((i) => Math.max(0, Math.min(i, contacts.length - 2)));
  }, [contacts.length]);

  const currentContact = contacts[currentIndex] || null;
  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const inCall = callStatus === "connecting" || callStatus === "ringing" || callStatus === "in_progress";
  const callJustEnded = callStatus === "ended" || callStatus === "failed";

  return (
    <div className="space-y-6">
      {tokenError && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/40 p-4 text-sm text-amber-200">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium">Voice not ready</div>
            <div className="mt-1 text-amber-200/80">{tokenError}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Dialed today"
          value={stats.dialed}
          icon={<PhoneCall size={16} />}
        />
        <StatCard
          label="Connected"
          value={stats.connected}
          icon={<CheckCircle size={16} />}
        />
        <StatCard
          label="Voicemails"
          value={stats.voicemails}
          icon={<Voicemail size={16} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Contact list ─────────────────────────────── */}
        <section className="lg:col-span-1">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Call list ({contacts.length})</h2>
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearList}
                  className="text-xs text-white/60 hover:text-white"
                >
                  Clear all
                </button>
              )}
            </div>

            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder="Paste phone numbers, one per line.&#10;Optional format: Name, +1 555 123 4567"
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddPasted}
              disabled={!pasteValue.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40"
            >
              <Plus size={14} /> Add to list
            </button>

            {contacts.length > 0 && (
              <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto pr-1">
                {contacts.map((c, i) => (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs ${
                      i === currentIndex
                        ? "bg-orange-500/15 text-orange-200"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentIndex(i)}
                      className="flex-1 truncate text-left"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-white/40">{c.phone}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeContact(c.id)}
                      className="ml-2 text-white/40 hover:text-white"
                      aria-label={`Remove ${c.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Right: Active call panel ─────────────────────────── */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            {!currentContact ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Phone size={36} className="text-white/30" />
                <h3 className="mt-4 text-base font-medium text-white">No contact loaded</h3>
                <p className="mt-1 max-w-xs text-sm text-white/50">
                  Paste numbers in the list and click a contact to start dialing.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-white/40">
                      Now dialing
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-white">
                      {currentContact.name}
                    </div>
                    <div className="mt-1 font-mono text-base text-white/70">
                      {currentContact.phone}
                    </div>
                  </div>
                  <div className="text-right">
                    <CallStatusBadge status={callStatus} />
                    {callStatus === "in_progress" && (
                      <div className="mt-2 font-mono text-lg text-orange-200">
                        {formatDuration(callDuration)}
                      </div>
                    )}
                  </div>
                </div>

                {currentContact.notes && (
                  <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                    <span className="text-xs uppercase tracking-wider text-white/40">
                      Previous notes
                    </span>
                    <p className="mt-1">{currentContact.notes}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {!inCall && callStatus !== "ended" && callStatus !== "failed" && (
                    <button
                      type="button"
                      onClick={() => startCall(currentContact)}
                      disabled={!deviceReady}
                      className="flex items-center gap-2 rounded-lg bg-emerald-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/40"
                    >
                      <PhoneCall size={14} /> Call
                    </button>
                  )}
                  {inCall && (
                    <>
                      <button
                        type="button"
                        onClick={hangUp}
                        className="flex items-center gap-2 rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
                      >
                        <PhoneOff size={14} /> Hang up
                      </button>
                      <button
                        type="button"
                        onClick={toggleMute}
                        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                      >
                        {muted ? <MicOff size={14} /> : <Mic size={14} />}
                        {muted ? "Unmute" : "Mute"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={nextCall}
                    disabled={currentIndex >= contacts.length - 1 || inCall}
                    className="ml-auto flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next <SkipForward size={14} />
                  </button>
                </div>

                <div className="mt-6">
                  <label className="text-xs uppercase tracking-wider text-white/40">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes from this call (saved with disposition)..."
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none"
                  />
                </div>

                {(callJustEnded || activeCallId) && (
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-wider text-white/40">
                      Disposition
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {(Object.keys(DISPOSITION_LABELS) as Disposition[]).map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => saveDisposition(d)}
                          className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:border-orange-400/40 hover:bg-orange-500/10"
                        >
                          {DISPOSITION_ICONS[d]} {DISPOSITION_LABELS[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CallStatusBadge({ status }: { status: CallStatus }) {
  const map: Record<CallStatus, { label: string; cls: string; icon?: React.ReactNode }> = {
    idle: { label: "Idle", cls: "bg-white/10 text-white/60" },
    connecting: {
      label: "Connecting",
      cls: "bg-amber-500/15 text-amber-200",
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    ringing: {
      label: "Ringing",
      cls: "bg-amber-500/15 text-amber-200",
      icon: <Loader2 size={12} className="animate-spin" />,
    },
    in_progress: {
      label: "Live",
      cls: "bg-emerald-500/15 text-emerald-200",
    },
    ended: { label: "Ended", cls: "bg-white/10 text-white/60" },
    failed: { label: "Failed", cls: "bg-rose-500/15 text-rose-200" },
  };
  const { label, cls, icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}
    >
      {icon}
      {label}
    </span>
  );
}
