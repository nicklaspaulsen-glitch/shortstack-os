"use client";

import { useState } from "react";
import Image from "next/image";
import { CheckCircle } from "lucide-react";

export default function SurveyPage() {
  const [step, setStep] = useState<"rate" | "feedback" | "done">("rate");
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await fetch("/api/surveys/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          feedback,
          client_id: new URLSearchParams(window.location.search).get("client"),
        }),
      });
      setStep("done");
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0b0d12" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image src="/icons/shortstack-logo.svg" alt="ShortStack" width={36} height={36} className="mx-auto mb-3" />
          <h1 className="text-lg font-bold text-white">How are we doing?</h1>
          <p className="text-sm text-gray-400 mt-1">Your feedback helps us improve</p>
        </div>

        {step === "rate" && (
          <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-sm text-gray-300 mb-4">How likely are you to recommend ShortStack to a friend?</p>
            <div className="flex justify-center gap-1.5 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button key={n} onClick={() => { setScore(n); setStep("feedback"); }}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                    score === n ? "text-black" : "text-gray-400 hover:text-white"
                  }`}
                  style={{
                    background: score === n
                      ? n >= 9 ? "#10b981" : n >= 7 ? "#c8a855" : "#ef4444"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${score === n ? "transparent" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-gray-600 px-2">
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
          </div>
        )}

        {step === "feedback" && (
          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              <span className="text-2xl font-bold" style={{ color: score && score >= 9 ? "#10b981" : score && score >= 7 ? "#c8a855" : "#ef4444" }}>
                {score}/10
              </span>
              <span className="text-sm text-gray-400">
                {score && score >= 9 ? "Amazing!" : score && score >= 7 ? "Good!" : "We can do better"}
              </span>
            </div>

            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              rows={3} placeholder="What could we improve? (optional)"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white resize-none mb-4"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />

            <div className="flex gap-2">
              <button onClick={() => setStep("rate")} className="flex-1 py-2.5 rounded-lg text-sm text-gray-400"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                Back
              </button>
              <button onClick={submit} disabled={submitting}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
                {submitting ? "Sending..." : "Submit"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
              <CheckCircle size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Thank you!</h2>
            <p className="text-sm text-gray-400">Your feedback means a lot to us.</p>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-600 mt-8">Powered by ShortStack</p>
      </div>
    </div>
  );
}
