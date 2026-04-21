"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Clock, Plus, Phone, Video, MapPin,
  ChevronLeft, ChevronRight, Check, X, Filter,
  Users,
  Repeat, Eye, Star, AlertCircle, Loader2
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { GoogleIcon, OutlookIcon } from "@/components/ui/platform-icons";
import toast from "react-hot-toast";

type ViewMode = "month" | "week" | "day";
type EventCategory = "meeting" | "deadline" | "content" | "call";
type CalendarTab = "calendar" | "agenda" | "deadlines";

interface CalEvent {
  id: string;
  title: string;
  client: string;
  date: string;
  time: string;
  duration: number;
  type: "call" | "video" | "in_person";
  category: EventCategory;
  recurring: boolean;
  teamMember: string;
  color: string;
}

const CATEGORY_CONFIG: Record<EventCategory, { label: string; color: string; bg: string }> = {
  meeting: { label: "Meeting", color: "text-blue-400", bg: "bg-blue-400/10" },
  deadline: { label: "Deadline", color: "text-red-400", bg: "bg-red-400/10" },
  content: { label: "Content", color: "text-purple-400", bg: "bg-purple-400/10" },
  call: { label: "Call", color: "text-emerald-400", bg: "bg-emerald-400/10" },
};

const TEAM_MEMBERS = ["All", "Nicklas"];
const CLIENTS = ["All"];
const TIMEZONES = [
  { label: "EST (UTC-5)", value: "America/New_York" },
  { label: "CST (UTC-6)", value: "America/Chicago" },
  { label: "PST (UTC-8)", value: "America/Los_Angeles" },
  { label: "GMT (UTC+0)", value: "Europe/London" },
  { label: "CET (UTC+1)", value: "Europe/Berlin" },
];

function categoryToColor(category: EventCategory): string {
  switch (category) {
    case "meeting": return "#3b82f6";
    case "deadline": return "#ef4444";
    case "content": return "#8b5cf6";
    case "call": return "#10b981";
    default: return "#3b82f6";
  }
}

interface DbCalendarEvent {
  id: string;
  user_id: string;
  title: string;
  client: string | null;
  team_member: string;
  date: string;
  time: string;
  duration: string;
  category: string;
  type: string;
  recurring: boolean;
  created_at: string;
}

function dbToCalEvent(row: DbCalendarEvent): CalEvent {
  return {
    id: row.id,
    title: row.title,
    client: row.client || "",
    date: row.date,
    time: row.time,
    duration: parseInt(row.duration, 10) || 30,
    type: row.type as CalEvent["type"],
    category: row.category as EventCategory,
    recurring: row.recurring,
    teamMember: row.team_member,
    color: categoryToColor(row.category as EventCategory),
  };
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  call: <Phone size={10} />,
  video: <Video size={10} />,
  in_person: <MapPin size={10} />,
};

export default function CalendarPage() {
  const [tab, setTab] = useState<CalendarTab>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("All");
  const [selectedClient, setSelectedClient] = useState("All");
  const [selectedCategories, setSelectedCategories] = useState<EventCategory[]>(["meeting", "deadline", "content", "call"]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<string | null>(null);
  // Sync status is TBD — no OAuth wiring for Google/Outlook/Apple calendars yet.
  // We surface "Not Connected" for all three until those integrations ship.
  const syncStatus: Record<string, boolean> = { google: false, outlook: false, apple: false };
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const monday = new Date(now);
    // Monday of the current week (treat Sunday as the end of the previous week).
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);
    return monday;
  });
  const [newEvent, setNewEvent] = useState({
    title: "", client: "", date: "", time: "10:00",
    duration: 30, type: "video" as CalEvent["type"], category: "meeting" as EventCategory,
    recurring: false, teamMember: "",
  });

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const json = await res.json();
        setEvents((json.events as DbCalendarEvent[]).map(dbToCalEvent));
      }
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const toggleCategory = (cat: EventCategory) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const filteredEvents = events.filter(e => {
    if (selectedTeam !== "All" && e.teamMember !== selectedTeam) return false;
    if (selectedClient !== "All" && e.client !== selectedClient) return false;
    if (!selectedCategories.includes(e.category)) return false;
    return true;
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeek);
    d.setDate(currentWeek.getDate() + i);
    return d;
  });

  const prevWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() - 7); setCurrentWeek(d); };
  const nextWeek = () => { const d = new Date(currentWeek); d.setDate(d.getDate() + 7); setCurrentWeek(d); };
  const goToday = () => {
    const now = new Date();
    const monday = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(now.getDate() + diff);
    setCurrentWeek(monday);
  };

  const today = new Date().toISOString().slice(0, 10);

  const todaysEvents = filteredEvents.filter(e => e.date === today).sort((a, b) => a.time.localeCompare(b.time));
  const upcomingDeadlines = filteredEvents.filter(e => e.category === "deadline" && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  // Mark an event as completed/removed. No dedicated status column exists yet,
  // so we just delete the row server-side and drop it from the view.
  const confirmEvent = (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    toast.success("Event marked complete");
    fetch("/api/calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(err => console.error("[calendar] delete failed:", err));
  };

  const declineEvent = (id: string) => {
    if (!confirm("Remove this event from your calendar?")) return;
    confirmEvent(id);
  };

  // Build a simple ICS file from the filtered events and trigger a download.
  const exportIcs = (label: "google" | "outlook") => {
    if (filteredEvents.length === 0) {
      toast.error("No events to export yet");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmtIcsDate = (dateStr: string, timeStr: string, mins: number) => {
      const start = new Date(`${dateStr}T${timeStr || "09:00"}:00`);
      const end = new Date(start.getTime() + mins * 60000);
      const fmt = (d: Date) =>
        `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
      return [fmt(start), fmt(end)];
    };
    const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Trinity//Calendar//EN"];
    filteredEvents.forEach(e => {
      const [dtstart, dtend] = fmtIcsDate(e.date, e.time, e.duration);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${e.id}@trinity`);
      lines.push(`DTSTAMP:${dtstart}`);
      lines.push(`DTSTART:${dtstart}`);
      lines.push(`DTEND:${dtend}`);
      lines.push(`SUMMARY:${e.title.replace(/\n/g, " ")}`);
      if (e.client) lines.push(`DESCRIPTION:Client: ${e.client} · Assigned: ${e.teamMember}`);
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trinity-calendar-${label}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"} — import the .ics into ${label === "google" ? "Google Calendar" : "Outlook"}`);
  };

  const handleDragStart = (eventId: string) => { setDraggedEvent(eventId); };
  const handleDrop = async (dateStr: string) => {
    if (!draggedEvent) return;
    // Optimistic update
    setEvents(prev => prev.map(e => e.id === draggedEvent ? { ...e, date: dateStr } : e));
    const id = draggedEvent;
    setDraggedEvent(null);
    try {
      await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, date: dateStr }),
      });
    } catch (err) {
      console.error("Failed to update event date:", err);
      fetchEvents(); // re-sync on failure
    }
  };

  const createEvent = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEvent.title,
          client: newEvent.client,
          team_member: newEvent.teamMember,
          date: newEvent.date,
          time: newEvent.time,
          duration: String(newEvent.duration),
          category: newEvent.category,
          type: newEvent.type,
          recurring: newEvent.recurring,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const saved = dbToCalEvent(json.event);
        setEvents(prev => [...prev, saved]);
        setShowCreate(false);
        setNewEvent({ title: "", client: "", date: new Date().toISOString().slice(0, 10), time: "10:00", duration: 30, type: "video", category: "meeting", recurring: false, teamMember: "" });
      } else {
        console.error("Failed to create event:", await res.text());
      }
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setSaving(false);
    }
  };

  // Month view: build a 6-week grid
  const monthStart = new Date(currentWeek.getFullYear(), currentWeek.getMonth(), 1);
  const monthGrid: Date[] = [];
  const startDay = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  for (let i = -startDay; i < 42 - startDay; i++) {
    const d = new Date(monthStart);
    d.setDate(1 + i);
    monthGrid.push(d);
  }

  const TABS: { id: CalendarTab; label: string; icon: React.ReactNode }[] = [
    { id: "calendar", label: "Calendar", icon: <Calendar size={13} /> },
    { id: "agenda", label: "Today's Agenda", icon: <Clock size={13} /> },
    { id: "deadlines", label: "Deadlines", icon: <AlertCircle size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Hero Header */}
      <PageHero
        icon={<Calendar size={22} />}
        title="Calendar"
        subtitle="Schedule appointments, calls, and meetings. AI avoids conflicts automatically."
        gradient="gold"
      />
      <div className="flex items-center justify-end flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Filter size={12} /> Filters
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New Event
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-gold" />
          <span className="ml-2 text-sm text-muted">Loading events...</span>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* View Mode Toggle */}
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">View</label>
              <div className="flex gap-1">
                {(["month", "week", "day"] as const).map(v => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`px-2.5 py-1 text-[10px] rounded-md capitalize transition-all ${viewMode === v ? "bg-gold text-black font-medium" : "bg-surface-light text-muted"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Filter */}
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Team Member</label>
              <select value={selectedTeam} onChange={e => setSelectedTeam(e.target.value)} className="input w-full text-xs">
                {TEAM_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Client Filter */}
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className="input w-full text-xs">
                {CLIENTS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input w-full text-xs">
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
          </div>

          {/* Category Filters */}
          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider font-semibold">Categories</label>
            <div className="flex gap-2">
              {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map(cat => (
                <button key={cat} onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    selectedCategories.includes(cat) ? `${CATEGORY_CONFIG[cat].bg} ${CATEGORY_CONFIG[cat].color} border-transparent` : "border-border text-muted"
                  }`}>
                  <div className="w-2 h-2 rounded-full" style={{ background: cat === "meeting" ? "#3b82f6" : cat === "deadline" ? "#ef4444" : cat === "content" ? "#8b5cf6" : "#10b981" }} />
                  {CATEGORY_CONFIG[cat].label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Sync Status */}
          <div>
            <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider font-semibold">Calendar Sync</label>
            <div className="flex gap-3">
              {Object.entries(syncStatus).map(([name, connected]) => (
                <div key={name} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
                  <span className="capitalize text-muted">{name}</span>
                  <span className={`text-[9px] ${connected ? "text-emerald-400" : "text-red-400"}`}>
                    {connected ? "Synced" : "Not Connected"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="flex gap-2">
            <button onClick={() => exportIcs("google")} className="btn-secondary text-[10px] flex items-center gap-1.5">
              <GoogleIcon size={12} /> Export to Google
            </button>
            <button onClick={() => exportIcs("outlook")} className="btn-secondary text-[10px] flex items-center gap-1.5">
              <OutlookIcon size={12} /> Export to Outlook
            </button>
          </div>
        </div>
      )}

      {!loading && tab === "calendar" && (
        <>
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <button onClick={prevWeek} className="btn-ghost p-2"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">
                {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <button onClick={goToday} className="btn-secondary text-[10px] px-2 py-0.5">Today</button>
            </div>
            <button onClick={nextWeek} className="btn-ghost p-2"><ChevronRight size={16} /></button>
          </div>

          {/* Month View */}
          {viewMode === "month" && (
            <div>
              <div className="grid grid-cols-7 gap-px mb-px">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-center text-[10px] text-muted py-1 font-semibold">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((day, idx) => {
                  const dateStr = day.toISOString().split("T")[0];
                  const dayEvts = filteredEvents.filter(e => e.date === dateStr);
                  const isToday = dateStr === today;
                  const isCurrentMonth = day.getMonth() === currentWeek.getMonth();
                  return (
                    <div key={idx}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDrop(dateStr)}
                      className={`rounded-lg p-1.5 min-h-[80px] border transition-all ${
                        isToday ? "ring-1 ring-gold/20 bg-gold/[0.04] border-gold/10" : "border-border"
                      } ${!isCurrentMonth ? "opacity-30" : "bg-surface-light"}`}>
                      <p className={`text-[10px] font-medium text-center ${isToday ? "text-gold" : ""}`}>{day.getDate()}</p>
                      {dayEvts.slice(0, 3).map(evt => (
                        <div key={evt.id} draggable onDragStart={() => handleDragStart(evt.id)}
                          className="text-[8px] px-1 py-0.5 rounded mt-0.5 truncate cursor-move"
                          style={{ background: `${evt.color}20`, color: evt.color, borderLeft: `2px solid ${evt.color}` }}>
                          {evt.time} {evt.title}
                        </div>
                      ))}
                      {dayEvts.length > 3 && (
                        <p className="text-[8px] text-muted text-center mt-0.5">+{dayEvts.length - 3} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Week View */}
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map(day => {
                const dateStr = day.toISOString().split("T")[0];
                const dayAppts = filteredEvents.filter(a => a.date === dateStr);
                const isToday = dateStr === today;
                return (
                  <div key={dateStr}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(dateStr)}
                    className={`rounded-xl p-3 min-h-[220px] border border-border ${
                      isToday ? "ring-1 ring-gold/20 bg-gold/[0.04]" : "bg-surface-light"
                    }`}>
                    <div className="text-center mb-2">
                      <p className="text-[10px] text-muted uppercase">{day.toLocaleDateString("en-US", { weekday: "short" })}</p>
                      <p className={`text-lg font-bold ${isToday ? "text-gold" : "text-foreground"}`}>{day.getDate()}</p>
                    </div>
                    <div className="space-y-1.5">
                      {dayAppts.map(appt => {
                        const catConfig = CATEGORY_CONFIG[appt.category];
                        return (
                          <div key={appt.id} draggable onDragStart={() => handleDragStart(appt.id)}
                            className="p-2 rounded-lg text-[10px] cursor-move hover:opacity-80 transition-opacity border"
                            style={{ background: `${appt.color}10`, borderColor: `${appt.color}20` }}>
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className={catConfig.color}>{TYPE_ICONS[appt.type]}</span>
                              <span className="font-semibold truncate">{appt.time}</span>
                              {appt.recurring && <Repeat size={7} className="text-muted" />}
                            </div>
                            <p className="truncate font-medium">{appt.client}</p>
                            <p className="text-muted truncate">{appt.title}</p>
                          </div>
                        );
                      })}
                      {dayAppts.length === 0 && (
                        <button onClick={() => { setNewEvent({ ...newEvent, date: dateStr }); setShowCreate(true); }}
                          className="w-full py-3 text-[9px] text-muted/30 hover:text-muted transition-colors text-center rounded-lg border border-dashed border-white/5 hover:border-white/10">
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Day View */}
          {viewMode === "day" && (
            <div className="card">
              <h2 className="section-header flex items-center gap-2">
                <Eye size={13} className="text-gold" />
                {new Date(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              <div className="space-y-1">
                {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map(slot => {
                  const slotEvents = filteredEvents.filter(e => e.date === today && e.time === slot);
                  return (
                    <div key={slot} className="flex gap-3 py-2 border-b border-border">
                      <span className="text-[10px] text-muted w-12 shrink-0 pt-0.5">{slot}</span>
                      <div className="flex-1 min-h-[32px]">
                        {slotEvents.map(evt => (
                          <div key={evt.id} className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: `${evt.color}10`, borderLeft: `3px solid ${evt.color}` }}>
                            <span className={CATEGORY_CONFIG[evt.category].color}>{TYPE_ICONS[evt.type]}</span>
                            <span className="font-medium">{evt.title}</span>
                            <span className="text-muted">with {evt.client}</span>
                            <span className="text-[10px] text-muted ml-auto">{evt.duration}min</span>
                            {evt.recurring && <Repeat size={10} className="text-muted" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Today's Agenda Tab */}
      {!loading && tab === "agenda" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-gold" /> Today&apos;s Schedule</h2>
              {todaysEvents.length === 0 ? (
                <EmptyState
                  type="no-calendar"
                  size={140}
                  title="No events today"
                  description="Your schedule is clear — enjoy the quiet."
                />
              ) : (
                <div className="space-y-2">
                  {todaysEvents.map(evt => (
                    <div key={evt.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-white/[0.02] transition-colors">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${CATEGORY_CONFIG[evt.category].bg}`}>
                        <span className={CATEGORY_CONFIG[evt.category].color}>{TYPE_ICONS[evt.type]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{evt.title}</p>
                        <p className="text-[10px] text-muted">{evt.client} - {evt.teamMember} - {evt.duration}min</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium">{evt.time}</p>
                        <div className="flex items-center gap-1">
                          {evt.recurring && <Repeat size={9} className="text-muted" />}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${CATEGORY_CONFIG[evt.category].bg} ${CATEGORY_CONFIG[evt.category].color}`}>
                            {CATEGORY_CONFIG[evt.category].label}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => confirmEvent(evt.id)} title="Mark complete" className="p-1.5 rounded-md hover:bg-emerald-500/10 text-emerald-500/60 hover:text-emerald-500 transition-colors"><Check size={12} /></button>
                        <button onClick={() => declineEvent(evt.id)} title="Remove" className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500/60 hover:text-red-500 transition-colors"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Star size={13} className="text-gold" /> Quick Stats</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-xs p-2 rounded-lg bg-surface-light">
                  <span className="text-muted">Today</span>
                  <span className="font-bold">{todaysEvents.length} events</span>
                </div>
                <div className="flex justify-between text-xs p-2 rounded-lg bg-surface-light">
                  <span className="text-muted">This Week</span>
                  <span className="font-bold">{filteredEvents.filter(e => weekDays.some(d => d.toISOString().split("T")[0] === e.date)).length} events</span>
                </div>
                <div className="flex justify-between text-xs p-2 rounded-lg bg-surface-light">
                  <span className="text-muted">Calls Today</span>
                  <span className="font-bold text-emerald-400">{todaysEvents.filter(e => e.category === "call").length}</span>
                </div>
                <div className="flex justify-between text-xs p-2 rounded-lg bg-surface-light">
                  <span className="text-muted">Recurring</span>
                  <span className="font-bold text-purple-400">{events.filter(e => e.recurring).length} events</span>
                </div>
              </div>
            </div>
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Users size={13} className="text-gold" /> Team Today</h2>
              <div className="space-y-1.5">
                {TEAM_MEMBERS.filter(m => m !== "All").map(member => {
                  const count = todaysEvents.filter(e => e.teamMember === member).length;
                  return (
                    <div key={member} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-white/[0.02]">
                      <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-[9px] font-bold text-gold">{member[0]}</div>
                      <span className="flex-1">{member}</span>
                      <span className="text-muted">{count} event{count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deadlines Tab */}
      {!loading && tab === "deadlines" && (
        <div className="space-y-3">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><AlertCircle size={13} className="text-red-400" /> Upcoming Deadlines</h2>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-muted text-center py-8">No upcoming deadlines</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map(dl => {
                  const daysLeft = Math.ceil((new Date(dl.date).getTime() - new Date(today).getTime()) / 86400000);
                  return (
                    <div key={dl.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${daysLeft <= 1 ? "bg-red-400/10" : daysLeft <= 3 ? "bg-yellow-400/10" : "bg-blue-400/10"}`}>
                        <AlertCircle size={16} className={daysLeft <= 1 ? "text-red-400" : daysLeft <= 3 ? "text-yellow-400" : "text-blue-400"} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold">{dl.title}</p>
                        <p className="text-[10px] text-muted">{dl.client} - {dl.teamMember}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{dl.date}</p>
                        <p className={`text-[10px] font-bold ${daysLeft <= 1 ? "text-red-400" : daysLeft <= 3 ? "text-yellow-400" : "text-muted"}`}>
                          {daysLeft === 0 ? "Today!" : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Recurring Events */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Repeat size={13} className="text-purple-400" /> Recurring Events</h2>
            <div className="space-y-2">
              {events.filter(e => e.recurring).length === 0 ? (
                <p className="text-xs text-muted text-center py-8">No recurring events</p>
              ) : (
                events.filter(e => e.recurring).map(evt => (
                  <div key={evt.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                    <Repeat size={12} className="text-purple-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{evt.title}</p>
                      <p className="text-[10px] text-muted">{evt.client} - Every {new Date(evt.date).toLocaleDateString("en-US", { weekday: "long" })} at {evt.time}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${CATEGORY_CONFIG[evt.category].bg} ${CATEGORY_CONFIG[evt.category].color}`}>
                      {CATEGORY_CONFIG[evt.category].label}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-lg p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} className="text-gold" /> New Event</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Title</label>
              <input value={newEvent.title} onChange={e => setNewEvent({ ...newEvent, title: e.target.value })}
                className="input w-full text-xs" placeholder="Event title" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client</label>
                <select value={newEvent.client} onChange={e => setNewEvent({ ...newEvent, client: e.target.value })} className="input w-full text-xs">
                  {CLIENTS.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Team Member</label>
                <select value={newEvent.teamMember} onChange={e => setNewEvent({ ...newEvent, teamMember: e.target.value })} className="input w-full text-xs">
                  {TEAM_MEMBERS.filter(m => m !== "All").map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Date</label>
                <input type="date" value={newEvent.date} onChange={e => setNewEvent({ ...newEvent, date: e.target.value })} className="input w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Time</label>
                <input type="time" value={newEvent.time} onChange={e => setNewEvent({ ...newEvent, time: e.target.value })} className="input w-full text-xs" />
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Duration</label>
                <select value={newEvent.duration} onChange={e => setNewEvent({ ...newEvent, duration: parseInt(e.target.value) })} className="input w-full text-xs">
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                  <option value={90}>90 min</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Category</label>
              <div className="flex gap-2">
                {(Object.keys(CATEGORY_CONFIG) as EventCategory[]).map(cat => (
                  <button key={cat} onClick={() => setNewEvent({ ...newEvent, category: cat })}
                    className={`flex-1 p-2 rounded-lg border text-xs text-center transition-all ${
                      newEvent.category === cat ? `${CATEGORY_CONFIG[cat].bg} ${CATEGORY_CONFIG[cat].color} border-transparent` : "border-border text-muted"
                    }`}>
                    {CATEGORY_CONFIG[cat].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Type</label>
              <div className="flex gap-2">
                {([
                  { id: "call" as const, label: "Phone", icon: <Phone size={12} /> },
                  { id: "video" as const, label: "Video", icon: <Video size={12} /> },
                  { id: "in_person" as const, label: "In Person", icon: <MapPin size={12} /> },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setNewEvent({ ...newEvent, type: t.id })}
                    className={`flex-1 flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs transition-all ${
                      newEvent.type === t.id ? "border-gold/20 bg-gold/[0.04] text-gold" : "border-border text-muted"
                    }`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={newEvent.recurring} onChange={e => setNewEvent({ ...newEvent, recurring: e.target.checked })} className="accent-gold" />
              <Repeat size={12} /> Make recurring (weekly)
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={createEvent} disabled={!newEvent.title || saving} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Calendar size={12} />}
                {saving ? "Saving..." : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
