"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { ContentCalendarEntry } from "@/lib/types";
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Sparkles, Loader,
  Camera, Film, Globe, Send, Phone, Video, ExternalLink, CheckCircle
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

interface BookingSlot {
  start: string;
  end: string;
  label: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Camera size={10} className="text-pink-400" />,
  tiktok: <Film size={10} className="text-white" />,
  facebook: <Send size={10} className="text-blue-400" />,
  youtube: <Film size={10} className="text-red-400" />,
  linkedin: <Globe size={10} className="text-blue-400" />,
};

export default function ContentCalendarPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<ContentCalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [clientId, setClientId] = useState<string | null>(null);
  const [showAIPlan, setShowAIPlan] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [showBookCall, setShowBookCall] = useState(false);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const [bookingProvider, setBookingProvider] = useState<string>("native");
  const [bookingNotes, setBookingNotes] = useState("");
  const [confirmedBooking, setConfirmedBooking] = useState<{ label: string; meet_url: string | null } | null>(null);
  const [fallbackEmbedUrl, setFallbackEmbedUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchCalendar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, currentDate]);

  async function fetchCalendar() {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data: clientData, error: clientError } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
      if (clientError && clientError.code !== "PGRST116") throw clientError;
      if (!clientData) { setLoading(false); return; }
      setClientId(clientData.id);

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data } = await supabase
        .from("content_calendar")
        .select("*")
        .eq("client_id", clientData.id)
        .gte("scheduled_at", startOfMonth)
        .lte("scheduled_at", endOfMonth)
        .order("scheduled_at");

      setEntries(data || []);
    } catch {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }

  async function generateAIPlan() {
    if (!aiPrompt.trim() || !clientId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Create a 30-day content calendar plan. The user says: "${aiPrompt}".
          Return a JSON array of content items. Each item should have: title, platform (instagram/tiktok/facebook/youtube/linkedin), content_type (reel/post/story/video), scheduled_date (YYYY-MM-DD format starting from today), and a brief description.
          Return ONLY valid JSON array, no other text.`,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "";

      // Try to parse JSON from the reply
      const jsonMatch = reply.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        let items;
        try { items = JSON.parse(jsonMatch[0]); } catch { toast.error("AI returned invalid data. Try again."); setGenerating(false); return; }
        let saved = 0;
        for (const item of items) {
          const { error } = await supabase.from("content_calendar").insert({
            client_id: clientId,
            title: item.title,
            platform: item.platform || "instagram",
            content_type: item.content_type || "post",
            status: "idea",
            scheduled_at: item.scheduled_date ? new Date(item.scheduled_date).toISOString() : null,
            metadata: { description: item.description, ai_generated: true },
          });
          if (!error) saved++;
        }
        toast.success(`${saved} content ideas added to your calendar!`);
        setShowAIPlan(false);
        setAiPrompt("");
        fetchCalendar();
      } else {
        toast.error("AI couldn't generate a plan. Try being more specific.");
      }
    } catch {
      toast.error("Failed to generate plan");
    }
    setGenerating(false);
  }

  async function openBookCall() {
    setShowBookCall(true);
    setConfirmedBooking(null);
    setSlotsLoading(true);
    try {
      const res = await fetch(`/api/portal/book-call?duration=30`);
      const data = await res.json();
      setSlots(data.slots || []);
      setBookingProvider(data.provider || "native");
      setFallbackEmbedUrl(data.fallback_embed_url || null);
    } catch {
      toast.error("Failed to load available slots");
    }
    setSlotsLoading(false);
  }

  async function bookSlot(slot: BookingSlot) {
    setBooking(slot.start);
    try {
      const res = await fetch("/api/portal/book-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_iso: slot.start,
          duration: 30,
          notes: bookingNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Booking failed" }));
        toast.error(err.error || "Booking failed");
      } else {
        const data = await res.json();
        toast.success("Call booked!");
        setConfirmedBooking({ label: slot.label, meet_url: data.meet_url });
        fetchCalendar();
      }
    } catch {
      toast.error("Booking failed");
    }
    setBooking(null);
  }

  async function addPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!clientId || !selectedDay) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("content_calendar").insert({
      client_id: clientId,
      title: fd.get("title") as string,
      platform: fd.get("platform") as string,
      content_type: fd.get("content_type") as string || "post",
      status: "idea",
      scheduled_at: selectedDay.toISOString(),
    });
    if (!error) {
      toast.success("Post added!");
      setShowAddPost(false);
      setSelectedDay(null);
      fetchCalendar();
    }
  }

  // Calendar grid logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  function getEntriesForDay(day: number) {
    return entries.filter(e => {
      if (!e.scheduled_at) return false;
      const d = new Date(e.scheduled_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Calendar size={18} className="text-gold" /> Content Calendar
          </h1>
          <p className="text-xs text-muted mt-0.5">Plan, schedule, and track your content</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openBookCall} className="btn-secondary text-xs flex items-center gap-1.5">
            <Phone size={12} /> Book a call
          </button>
          <button onClick={() => setShowAIPlan(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Sparkles size={12} /> AI Plan
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="btn-ghost" aria-label="Previous month"><ChevronLeft size={16} /></button>
        <h2 className="text-sm font-semibold">{monthName}</h2>
        <button onClick={nextMonth} className="btn-ghost" aria-label="Next month"><ChevronRight size={16} /></button>
      </div>

      {/* Calendar grid */}
      <div className="card p-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {DAYS.map(day => (
            <div key={day} className="text-center text-[9px] text-muted font-semibold uppercase tracking-wider py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-px">
          {calendarDays.map((day, i) => {
            if (day === null) return <div key={i} className="min-h-[90px] bg-surface-light rounded-lg" />;
            const dayEntries = getEntriesForDay(day);
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

            return (
              <button
                key={i}
                onClick={() => { setSelectedDay(new Date(year, month, day)); setShowAddPost(true); }}
                className={`min-h-[90px] p-1.5 rounded-lg text-left transition-all duration-200 hover:bg-surface-light/50 hover:border-gold/10 border ${
                  isToday ? "border-gold/20 bg-gold/[0.03]" : "border-transparent"
                }`}
              >
                <div className={`text-[10px] font-medium mb-1 ${isToday ? "text-gold" : "text-muted"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayEntries.slice(0, 3).map((entry, j) => (
                    <div key={j} className={`text-[8px] px-1 py-0.5 rounded flex items-center gap-0.5 truncate ${
                      entry.status === "published" ? "bg-success/10 text-success" :
                      entry.status === "scheduled" ? "bg-gold/10 text-gold" :
                      entry.status === "idea" ? "bg-gold/10 text-gold" :
                      "bg-surface-light text-muted"
                    }`}>
                      {PLATFORM_ICONS[entry.platform] || null}
                      <span className="truncate">{entry.title}</span>
                    </div>
                  ))}
                  {dayEntries.length > 3 && (
                    <div className="text-[8px] text-muted text-center">+{dayEntries.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        {[
          { label: "Idea", color: "bg-gold/10 text-gold" },
          { label: "Scheduled", color: "bg-gold/10 text-gold" },
          { label: "Published", color: "bg-success/10 text-success" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${item.color.split(" ")[0]}`} />
            <span className="text-[9px] text-muted">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card text-center p-3">
          <p className="text-lg font-bold font-mono text-gold count-up">{entries.length}</p>
          <p className="text-[9px] text-muted uppercase tracking-wider">This Month</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-lg font-bold font-mono text-success count-up">{entries.filter(e => e.status === "published").length}</p>
          <p className="text-[9px] text-muted uppercase tracking-wider">Published</p>
        </div>
        <div className="card text-center p-3">
          <p className="text-lg font-bold font-mono text-gold count-up">{entries.filter(e => e.status === "scheduled" || e.status === "idea").length}</p>
          <p className="text-[9px] text-muted uppercase tracking-wider">Upcoming</p>
        </div>
      </div>

      {/* AI Plan Modal */}
      <Modal isOpen={showAIPlan} onClose={() => setShowAIPlan(false)} title="AI Content Planner" size="md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 bg-gold/[0.05] rounded-lg border border-gold/15">
            <Sparkles size={16} className="text-gold shrink-0" />
            <p className="text-[10px] text-muted">Describe your business and goals, and AI will generate a full 30-day content calendar with platform-specific ideas.</p>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Tell us about your content goals</label>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g., I'm a dentist in Miami. I want to grow on Instagram and TikTok. Focus on before/after transformations, dental tips, and patient testimonials. Post 5 times per week."
              className="input w-full h-28 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAIPlan(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={generateAIPlan} disabled={generating || !aiPrompt.trim()} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Planning..." : "Generate 30-Day Plan"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Book a Call Modal */}
      <Modal isOpen={showBookCall} onClose={() => { setShowBookCall(false); setConfirmedBooking(null); setBookingNotes(""); }} title="Book a call with your agency" size="md">
        {confirmedBooking ? (
          <div className="space-y-3 text-center py-4">
            <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-success" />
            </div>
            <h3 className="text-sm font-semibold">You are booked</h3>
            <p className="text-xs text-muted">{confirmedBooking.label}</p>
            {confirmedBooking.meet_url && (
              <a href={confirmedBooking.meet_url} target="_blank" rel="noopener noreferrer"
                className="btn-primary text-xs inline-flex items-center gap-1.5">
                <Video size={12} /> Join Google Meet
              </a>
            )}
            <p className="text-[10px] text-muted">A confirmation has been sent to your agency.</p>
          </div>
        ) : fallbackEmbedUrl && slots.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-muted">Book a call via our calendar:</p>
            <a href={fallbackEmbedUrl} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs inline-flex items-center gap-1.5">
              <ExternalLink size={12} /> Open booking page
            </a>
            <iframe src={fallbackEmbedUrl} className="w-full h-96 rounded-lg border border-border" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2.5 bg-gold/[0.05] rounded-lg border border-gold/15">
              <Calendar size={16} className="text-gold shrink-0" />
              <p className="text-[10px] text-muted">
                Pick a 30-minute slot. {bookingProvider === "google_calendar"
                  ? "You'll receive a Google Meet link."
                  : "Your agency will confirm via email."}
              </p>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Notes (optional)</label>
              <textarea
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                placeholder="Anything we should prepare for the call?"
                className="input w-full h-16 text-xs"
              />
            </div>
            {slotsLoading ? (
              <div className="py-8 flex justify-center">
                <Loader size={20} className="animate-spin text-gold" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">No slots available in the next 2 weeks. Contact your agency directly.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-80 overflow-auto">
                {slots.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => bookSlot(slot)}
                    disabled={!!booking}
                    className={`text-left p-2.5 rounded-lg border text-[10px] transition-all disabled:opacity-50 ${
                      booking === slot.start
                        ? "border-gold bg-gold/10"
                        : "border-border hover:border-gold/30 hover:bg-surface-light"
                    }`}
                  >
                    {booking === slot.start ? (
                      <span className="flex items-center gap-1.5"><Loader size={10} className="animate-spin" /> Booking...</span>
                    ) : (
                      slot.label
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Post Modal */}
      <Modal isOpen={showAddPost} onClose={() => { setShowAddPost(false); setSelectedDay(null); }} title={`Add Content — ${selectedDay?.toLocaleDateString() || ""}`} size="sm">
        <form onSubmit={addPost} className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Title</label>
            <input name="title" className="input w-full text-xs" placeholder="What's the content about?" required />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Platform</label>
            <select name="platform" className="input w-full text-xs">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Type</label>
            <select name="content_type" className="input w-full text-xs">
              <option value="reel">Reel / Short</option>
              <option value="post">Post</option>
              <option value="story">Story</option>
              <option value="video">Long-form Video</option>
              <option value="carousel">Carousel</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowAddPost(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
