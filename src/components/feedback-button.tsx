"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { MessageCirclePlus, X, Bug, Sparkles, Heart, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

/**
 * Floating feedback button + modal.
 * - bottom-right, always visible
 * - modal with type picker, message, screenshot opt-in
 * - POSTs to /api/feedback
 * - on success, plays a CSS/Framer-Motion confetti burst and closes
 */

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";

type FeedbackType = "bug" | "feature" | "praise" | "question";

type LucideLike = React.ComponentType<{ size?: number | string; className?: string }>;

const TYPE_OPTIONS: Array<{
  value: FeedbackType;
  label: string;
  Icon: LucideLike;
}> = [
  { value: "bug", label: "Bug", Icon: Bug as LucideLike },
  { value: "feature", label: "Feature Request", Icon: Sparkles as LucideLike },
  { value: "praise", label: "Praise", Icon: Heart as LucideLike },
  { value: "question", label: "Question", Icon: HelpCircle as LucideLike },
];

function ConfettiBurst() {
  // 24 particles radiating outward, each with random angle + gold tint.
  const particles = Array.from({ length: 24 }).map((_, i) => {
    const angle = (i / 24) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 120 + Math.random() * 80;
    const size = 6 + Math.random() * 6;
    const colors = [GOLD, GOLD_LIGHT, "#fff", "#ffe9b0"];
    const color = colors[i % colors.length];
    return { angle, distance, size, color, id: i };
  });

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, background: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            opacity: 0,
            scale: 1,
            rotate: Math.random() * 360,
          }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSubmit = useCallback(async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    setSubmitting(true);

    let screenshot: string | undefined;
    if (includeScreenshot) {
      try {
        // Dynamic import — keeps html2canvas out of the initial bundle.
        const html2canvas = (await import("html2canvas")).default;
        // Hide the modal for the capture so it doesn't show in the screenshot.
        if (modalRef.current) modalRef.current.style.visibility = "hidden";
        const canvas = await html2canvas(document.body, {
          backgroundColor: null,
          scale: 0.75,
          logging: false,
          useCORS: true,
        });
        if (modalRef.current) modalRef.current.style.visibility = "";
        screenshot = canvas.toDataURL("image/jpeg", 0.7);
      } catch (err) {
        if (modalRef.current) modalRef.current.style.visibility = "";
        // eslint-disable-next-line no-console
        console.warn("Screenshot capture failed:", err);
        toast.error("Could not capture screenshot, submitting without it");
      }
    }

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page_url: typeof window !== "undefined" ? window.location.href : undefined,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          screenshot_data_url: screenshot,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }
      setCelebrate(true);
      toast.success("Thanks! We read every one of these.");
      // Let confetti play, then close.
      setTimeout(() => {
        setOpen(false);
        setCelebrate(false);
        setMessage("");
        setIncludeScreenshot(false);
        setType("bug");
      }, 1100);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }, [message, type, includeScreenshot]);

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
          color: "#0b0d12",
          boxShadow: `0 8px 24px rgba(200,168,85,0.35), 0 0 0 1px rgba(200,168,85,0.25)`,
        }}
      >
        <MessageCirclePlus size={20} strokeWidth={2.2} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <motion.div
              ref={modalRef}
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(180deg, #131620 0%, #0b0d12 100%)",
                border: "1px solid rgba(200,168,85,0.15)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
              }}
            >
              {celebrate && <ConfettiBurst />}

              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">Send feedback</h3>
                  <p className="text-gray-500 text-xs mt-0.5">
                    We read every message. Usually reply within 24 hours.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Type
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {TYPE_OPTIONS.map((o) => {
                      const active = type === o.value;
                      const Icon = o.Icon;
                      return (
                        <button
                          key={o.value}
                          onClick={() => setType(o.value)}
                          type="button"
                          className="flex flex-col items-center gap-1 py-2.5 rounded-lg transition-all"
                          style={{
                            background: active ? "rgba(200,168,85,0.15)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${active ? "rgba(200,168,85,0.4)" : "rgba(255,255,255,0.05)"}`,
                            color: active ? GOLD : "#888",
                          }}
                        >
                          <Icon size={14} />
                          <span className="text-[10px] font-medium">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">
                    Your message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's going on? Be as specific as possible."
                    rows={5}
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-gray-600 resize-none outline-none focus:ring-2"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeScreenshot}
                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    className="w-4 h-4 rounded accent-yellow-600"
                  />
                  <span className="text-xs text-gray-400 group-hover:text-gray-300">
                    Include a screenshot of the current page
                  </span>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setOpen(false)}
                    type="button"
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:bg-white/5"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    type="button"
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                    style={{
                      background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})`,
                      color: "#0b0d12",
                    }}
                  >
                    {submitting ? "Sending…" : "Send feedback"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
