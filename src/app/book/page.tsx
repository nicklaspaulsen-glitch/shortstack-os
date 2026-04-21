"use client";

import { useState } from "react";
import { Calendar, Clock, Video, CheckCircle, ArrowRight } from "lucide-react";
import Image from "next/image";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00",
];

export default function PublicBookingPage() {
  const [step, setStep] = useState<"select" | "form" | "done">("select");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", business: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  // Generate next 14 days
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter(d => d.getDay() !== 0 && d.getDay() !== 6); // Exclude weekends

  async function submitBooking() {
    if (!form.name || !form.email) return;
    setSubmitting(true);

    try {
      await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: "booking",
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          business_name: form.business,
          booking_date: selectedDate,
          booking_time: selectedTime,
          notes: form.notes,
        }),
      });
      setStep("done");
    } catch {
      // Show error on the page instead of toast (no toast provider on public page)
      alert("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#0b0d12" }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Image src="/icons/shortstack-logo.svg" alt="ShortStack" width={40} height={40} className="mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">Book a Free Strategy Call</h1>
          <p className="text-sm text-gray-400 mt-1">30-minute video call to discuss your marketing goals</p>
        </div>

        {step === "select" && (
          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar size={14} className="text-[#c8a855]" /> Select a Date
            </h2>
            <div className="grid grid-cols-5 gap-2 mb-5">
              {dates.map(d => {
                const dateStr = d.toISOString().split("T")[0];
                const isSelected = selectedDate === dateStr;
                return (
                  <button key={dateStr} onClick={() => setSelectedDate(dateStr)}
                    className={`p-2 rounded-lg text-center transition-all ${
                      isSelected ? "bg-[#c8a855]/10 border-[#c8a855]/30 text-[#c8a855]" : "border-white/[0.05] text-gray-400 hover:text-white"
                    }`} style={{ border: `1px solid ${isSelected ? "rgba(200,168,85,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                    <p className="text-[9px] uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                    <p className="text-lg font-bold">{d.getDate()}</p>
                    <p className="text-[8px]">{d.toLocaleDateString("en-US", { month: "short" })}</p>
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock size={14} className="text-[#c8a855]" /> Select a Time
                </h2>
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {TIME_SLOTS.map(time => (
                    <button key={time} onClick={() => setSelectedTime(time)}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedTime === time ? "bg-[#c8a855]/10 text-[#c8a855] border-[#c8a855]/30" : "text-gray-400 hover:text-white border-white/[0.05]"
                      }`} style={{ border: `1px solid ${selectedTime === time ? "rgba(200,168,85,0.3)" : "rgba(255,255,255,0.05)"}` }}>
                      {time}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selectedDate && selectedTime && (
              <button onClick={() => setStep("form")}
                className="w-full py-3 rounded-lg font-semibold text-sm text-black flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
                Continue <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}

        {step === "form" && (
          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <Video size={14} className="text-[#c8a855]" />
              <span className="text-xs text-gray-400">
                {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {selectedTime}
              </span>
              <button onClick={() => setStep("select")} className="text-[10px] text-[#c8a855] ml-auto">Change</button>
            </div>

            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Full Name *" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Email *" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Phone" />
              <input value={form.business} onChange={e => setForm({ ...form, business: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Business Name" />
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white resize-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                placeholder="Anything we should know before the call?" />

              <button onClick={submitBooking} disabled={submitting || !form.name || !form.email}
                className="w-full py-3 rounded-lg font-semibold text-sm text-black disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #c8a855, #b89840)" }}>
                {submitting ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.1)" }}>
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">You&apos;re Booked!</h2>
            <p className="text-sm text-gray-400 mb-4">
              {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {selectedTime}
            </p>
            <p className="text-xs text-gray-500">We&apos;ll send a calendar invite and video link to {form.email}</p>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-600 mt-6">Powered by ShortStack</p>
      </div>
    </div>
  );
}
