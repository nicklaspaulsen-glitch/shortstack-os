"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar, Clock, Users, Link2, Copy, Globe,
  Plus, Settings, Mail, Shuffle, BarChart3, Shield,
  X, Check, ExternalLink, Edit3, AlertCircle, Loader2
} from "lucide-react";
import EmptyState from "@/components/empty-state";

type ScheduleTab = "booking_pages" | "availability" | "analytics" | "settings";

interface MeetingType {
  id: string;
  name: string;
  duration: number;
  description: string | null;
  location_type: string;
  color: string | null;
  price: number | null;
  active: boolean;
  buffer_time: number;
  max_bookings_per_day: number | null;
  available_days: string[];
  available_hours_start: string;
  available_hours_end: string;
  created_at: string;
}

interface Booking {
  id: string;
  meeting_type_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string | null;
  date: string;
  time: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  notes: string | null;
  created_at: string;
  meeting_types: { name: string; duration: number; color: string | null } | null;
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30",
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-emerald-400/10 text-emerald-400",
  pending: "bg-yellow-400/10 text-yellow-400",
  cancelled: "bg-red-400/10 text-red-400",
  completed: "bg-blue-400/10 text-blue-400",
  no_show: "bg-orange-400/10 text-orange-400",
};

const LOCATION_OPTIONS = [
  { value: "zoom", label: "Zoom" },
  { value: "google_meet", label: "Google Meet" },
  { value: "phone", label: "Phone Call" },
  { value: "in_person", label: "In Person" },
];

const COLOR_OPTIONS = [
  "#C9A84C", "#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4",
];

export default function SchedulingPage() {
  const [tab, setTab] = useState<ScheduleTab>("booking_pages");
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [showLinkGen, setShowLinkGen] = useState(false);
  const [selectedLink, setSelectedLink] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { enabled: d !== "Saturday" && d !== "Sunday", start: "09:00", end: "17:00" }]))
  );
  const [roundRobin, setRoundRobin] = useState(true);
  const [autoTimezone, setAutoTimezone] = useState(true);
  const [reschedulePolicy, setReschedulePolicy] = useState("24h");
  const [cancelPolicy, setCancelPolicy] = useState("24h");

  // Create form state
  const [newMeeting, setNewMeeting] = useState({
    name: "",
    duration: 30,
    description: "",
    location_type: "zoom",
    color: "#C9A84C",
    buffer_time: 0,
    max_bookings_per_day: "",
  });

  // ── Fetch meeting types ──
  const fetchMeetingTypes = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduling");
      if (!res.ok) return;
      const json = await res.json();
      setMeetingTypes(json.meeting_types ?? []);
    } catch {
      // silent
    }
  }, []);

  // ── Fetch bookings ──
  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/scheduling/bookings");
      if (!res.ok) return;
      const json = await res.json();
      setBookings(json.bookings ?? []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchMeetingTypes(), fetchBookings()]).finally(() => setLoading(false));
  }, [fetchMeetingTypes, fetchBookings]);

  // ── Create meeting type ──
  const handleCreate = async () => {
    if (!newMeeting.name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/scheduling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMeeting.name,
          duration: newMeeting.duration,
          description: newMeeting.description || null,
          location_type: newMeeting.location_type,
          color: newMeeting.color,
          buffer_time: newMeeting.buffer_time,
          max_bookings_per_day: newMeeting.max_bookings_per_day ? parseInt(newMeeting.max_bookings_per_day) : null,
        }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewMeeting({ name: "", duration: 30, description: "", location_type: "zoom", color: "#C9A84C", buffer_time: 0, max_bookings_per_day: "" });
        fetchMeetingTypes();
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Toggle meeting type active/inactive ──
  const toggleMeetingType = async (id: string) => {
    const mt = meetingTypes.find(m => m.id === id);
    if (!mt) return;
    // Optimistic update
    setMeetingTypes(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));
    const res = await fetch("/api/scheduling", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: !mt.active }),
    });
    if (!res.ok) {
      // Revert on failure
      setMeetingTypes(prev => prev.map(m => m.id === id ? { ...m, active: mt.active } : m));
    }
  };

  // ── Delete meeting type ──
  const deleteMeetingType = async (id: string) => {
    setMeetingTypes(prev => prev.filter(m => m.id !== id));
    const res = await fetch("/api/scheduling", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      fetchMeetingTypes(); // Refetch on failure
    }
  };

  // ── Update booking status ──
  const updateBookingStatus = async (id: string, status: string) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking["status"] } : b));
    const res = await fetch("/api/scheduling/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      fetchBookings();
    }
  };

  const bookingLink = (mtId: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/book/${mtId}`;

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === "confirmed").length;
  const conversionRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0;

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); };

  const TABS: { id: ScheduleTab; label: string; icon: React.ReactNode }[] = [
    { id: "booking_pages", label: "Booking Pages", icon: <Calendar size={13} /> },
    { id: "availability", label: "Availability", icon: <Clock size={13} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> },
  ];

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Scheduling</h1>
            <p className="text-xs text-muted">Manage booking pages, availability, and meetings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLinkGen(true)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Link2 size={12} /> Get Booking Link
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New Meeting Type
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{meetingTypes.filter(m => m.active).length}</p>
          <p className="text-[10px] text-muted">Active Types</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{totalBookings}</p>
          <p className="text-[10px] text-muted">Total Bookings</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{confirmedBookings}</p>
          <p className="text-[10px] text-muted">Confirmed</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{conversionRate}%</p>
          <p className="text-[10px] text-muted">Conversion Rate</p>
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

      {/* Booking Pages Tab */}
      {tab === "booking_pages" && (
        <div className="space-y-4">
          {/* Meeting Types */}
          {meetingTypes.length === 0 ? (
            <EmptyState
              icon={<Calendar size={24} />}
              title="No meeting types"
              description="Create a booking link to get started"
              actionLabel="Create Meeting Type"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {meetingTypes.map(mt => (
                <div key={mt.id} className={`card p-4 ${!mt.active ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-full rounded-full shrink-0 mt-1" style={{ background: mt.color || "#C9A84C", minHeight: 40 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold">{mt.name}</p>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => toggleMeetingType(mt.id)}
                            className={`text-[9px] px-2 py-0.5 rounded-full ${mt.active ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
                            {mt.active ? "Active" : "Inactive"}
                          </button>
                          <button onClick={() => setEditingType(editingType === mt.id ? null : mt.id)} className="btn-ghost p-1">
                            <Edit3 size={10} className="text-muted" />
                          </button>
                        </div>
                      </div>
                      {mt.description && <p className="text-[10px] text-muted mb-2">{mt.description}</p>}
                      <div className="flex items-center gap-3 text-[10px] text-muted mb-2">
                        <span className="flex items-center gap-1"><Clock size={9} /> {mt.duration} min</span>
                        <span className="flex items-center gap-1"><Shield size={9} /> {mt.buffer_time}m buffer</span>
                        {mt.max_bookings_per_day && (
                          <span className="flex items-center gap-1"><Users size={9} /> Max {mt.max_bookings_per_day}/day</span>
                        )}
                        <span className="text-[9px] capitalize">{mt.location_type.replace("_", " ")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => copyLink(bookingLink(mt.id))} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                          <Copy size={10} /> Copy Link
                        </button>
                        <a href={bookingLink(mt.id)} target="_blank" rel="noopener" className="btn-ghost text-[10px] px-2 py-1 flex items-center gap-1 text-muted hover:text-foreground">
                          <ExternalLink size={10} /> Preview
                        </a>
                      </div>

                      {/* Edit Expanded */}
                      {editingType === mt.id && (
                        <div className="mt-3 pt-3 border-t border-border space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] text-muted mb-1">Buffer Time</label>
                              <select className="input w-full text-[10px]" defaultValue={mt.buffer_time}
                                onChange={async (e) => {
                                  const buffer_time = parseInt(e.target.value);
                                  await fetch("/api/scheduling", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: mt.id, buffer_time }),
                                  });
                                  setMeetingTypes(prev => prev.map(m => m.id === mt.id ? { ...m, buffer_time } : m));
                                }}>
                                <option value={0}>None</option>
                                <option value={5}>5 min</option>
                                <option value={10}>10 min</option>
                                <option value={15}>15 min</option>
                                <option value={30}>30 min</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] text-muted mb-1">Duration</label>
                              <select className="input w-full text-[10px]" defaultValue={mt.duration}
                                onChange={async (e) => {
                                  const duration = parseInt(e.target.value);
                                  await fetch("/api/scheduling", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: mt.id, duration }),
                                  });
                                  setMeetingTypes(prev => prev.map(m => m.id === mt.id ? { ...m, duration } : m));
                                }}>
                                <option value={15}>15 min</option>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>60 min</option>
                                <option value={90}>90 min</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[9px] text-muted mb-1">Max/Day</label>
                              <input type="number" className="input w-full text-[10px]" defaultValue={mt.max_bookings_per_day ?? ""}
                                placeholder="No limit"
                                onBlur={async (e) => {
                                  const val = e.target.value ? parseInt(e.target.value) : null;
                                  await fetch("/api/scheduling", {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ id: mt.id, max_bookings_per_day: val }),
                                  });
                                  setMeetingTypes(prev => prev.map(m => m.id === mt.id ? { ...m, max_bookings_per_day: val } : m));
                                }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => deleteMeetingType(mt.id)}
                              className="text-[10px] px-2 py-1 rounded bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
                              Delete Meeting Type
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Bookings */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-gold" /> Recent Bookings</h2>
            {bookings.length === 0 ? (
              <div className="py-6 text-center">
                <Users size={24} className="mx-auto text-muted/30 mb-2" />
                <p className="text-xs text-muted">No bookings yet. Share your booking links to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.map(b => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-[9px] text-muted">{new Date(b.date).toLocaleDateString("en-US", { month: "short" })}</p>
                      <p className="text-lg font-bold leading-none">{new Date(b.date).getDate()}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{b.guest_name}</p>
                      <p className="text-[10px] text-muted">
                        {b.meeting_types?.name ?? "Meeting"} at {b.time}
                      </p>
                      <p className="text-[9px] text-muted/70">{b.guest_email}</p>
                      {b.notes && <p className="text-[9px] text-muted/50 mt-0.5">{b.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {b.status === "confirmed" && (
                        <button onClick={() => updateBookingStatus(b.id, "cancelled")}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 hover:bg-red-400/20">
                          Cancel
                        </button>
                      )}
                      {b.status === "confirmed" && (
                        <button onClick={() => updateBookingStatus(b.id, "completed")}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 hover:bg-blue-400/20">
                          Complete
                        </button>
                      )}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status] ?? "text-muted"}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Confirmation Email Preview */}
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="section-header flex items-center gap-2 mb-0"><Mail size={13} className="text-gold" /> Confirmation Email Preview</h2>
              <button onClick={() => setShowEmailPreview(!showEmailPreview)} className="btn-ghost text-[10px]">
                {showEmailPreview ? "Hide" : "Show"} Preview
              </button>
            </div>
            {showEmailPreview && (
              <div className="mt-3 rounded-xl bg-[#1a1c23] p-5 text-foreground text-xs">
                <p className="font-bold text-base mb-2" style={{ color: "#C9A84C" }}>ShortStack Creative</p>
                <p className="mb-3">Hi <strong>[Client Name]</strong>,</p>
                <p className="mb-2">Your <strong>[Meeting Type]</strong> has been confirmed!</p>
                <div className="bg-white/5 rounded-lg p-3 mb-3">
                  <p><strong>Date:</strong> [Date]</p>
                  <p><strong>Time:</strong> [Time] ([Timezone])</p>
                  <p><strong>Duration:</strong> [Duration] minutes</p>
                  <p><strong>Join Link:</strong> <span className="text-blue-500">[Video Link]</span></p>
                </div>
                <p className="text-muted text-[10px]">Need to reschedule? Click the link in this email to find a new time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Availability Tab */}
      {tab === "availability" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-gold" /> Weekly Availability</h2>
            <div className="space-y-2">
              {DAYS.map(day => {
                const dayAvail = availability[day];
                return (
                  <div key={day} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                    <label className="flex items-center gap-2 w-28 cursor-pointer">
                      <input type="checkbox" checked={dayAvail.enabled}
                        onChange={e => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], enabled: e.target.checked } }))}
                        className="accent-gold" />
                      <span className={`text-xs font-medium ${dayAvail.enabled ? "" : "text-muted"}`}>{day}</span>
                    </label>
                    {dayAvail.enabled ? (
                      <div className="flex items-center gap-2">
                        <select value={dayAvail.start}
                          onChange={e => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], start: e.target.value } }))}
                          className="input text-[10px] w-24">
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <span className="text-muted text-xs">to</span>
                        <select value={dayAvail.end}
                          onChange={e => setAvailability(prev => ({ ...prev, [day]: { ...prev[day], end: e.target.value } }))}
                          className="input text-[10px] w-24">
                          {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time Slots Grid Visual */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-blue-400" /> Available Slots This Week</h2>
            <div className="grid grid-cols-8 gap-px text-[9px]">
              <div />
              {DAYS.slice(0, 7).map(d => (
                <div key={d} className="text-center text-muted font-semibold py-1">{d.slice(0, 3)}</div>
              ))}
              {["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00"].map(slot => (
                <div key={slot} className="contents">
                  <div className="text-muted pr-2 text-right py-1">{slot}</div>
                  {DAYS.slice(0, 7).map(day => {
                    const avail = availability[day];
                    const inRange = avail.enabled && slot >= avail.start && slot < avail.end;
                    const booked = bookings.some(b => {
                      const dayIdx = DAYS.indexOf(day);
                      const bookDate = new Date(b.date);
                      return bookDate.getDay() === (dayIdx + 1) % 7 && b.time === slot;
                    });
                    return (
                      <div key={`${day}-${slot}`}
                        className={`text-center py-1 rounded ${booked ? "bg-gold/20 text-gold" : inRange ? "bg-emerald-400/10 text-emerald-400" : "bg-surface-light text-muted/20"}`}>
                        {booked ? "Booked" : inRange ? "Open" : "-"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Integration Status */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-gold" /> Calendar Integration</h2>
            <div className="space-y-2">
              {[
                { name: "Google Calendar", connected: true, icon: "G" },
                { name: "Outlook Calendar", connected: false, icon: "O" },
                { name: "Apple Calendar", connected: false, icon: "A" },
              ].map(cal => (
                <div key={cal.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light border border-border">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${cal.connected ? "bg-emerald-400/10 text-emerald-400" : "bg-surface text-muted"}`}>
                    {cal.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{cal.name}</p>
                    <p className="text-[9px] text-muted">{cal.connected ? "Connected and syncing" : "Not connected"}</p>
                  </div>
                  <button className={`text-[10px] px-3 py-1 rounded-lg ${cal.connected ? "btn-secondary" : "btn-primary"}`}>
                    {cal.connected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Bookings This Week</p>
              <p className="text-2xl font-bold text-gold">{totalBookings}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Show Rate</p>
              <p className="text-2xl font-bold text-emerald-400">
                {totalBookings > 0 ? Math.round((bookings.filter(b => b.status === "completed").length / totalBookings) * 100) : 0}%
              </p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Confirmed</p>
              <p className="text-2xl font-bold text-blue-400">{confirmedBookings}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Cancellation Rate</p>
              <p className="text-2xl font-bold text-red-400">
                {totalBookings > 0 ? Math.round((bookings.filter(b => b.status === "cancelled").length / totalBookings) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* Bookings by Type Chart */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Bookings by Meeting Type</h2>
            {meetingTypes.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Create meeting types to see analytics.</p>
            ) : (
              <div className="space-y-2">
                {meetingTypes.map(mt => {
                  const count = bookings.filter(b => b.meeting_type_id === mt.id).length;
                  const pct = totalBookings > 0 ? (count / totalBookings) * 100 : 0;
                  return (
                    <div key={mt.id} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: mt.color || "#C9A84C" }} />
                      <span className="text-xs w-32 truncate">{mt.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: mt.color || "#C9A84C" }} />
                      </div>
                      <span className="text-xs font-bold w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Popular Times */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Popular Booking Times</h2>
            {bookings.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">Booking data will appear here once you have bookings.</p>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {(() => {
                  const timeCounts: Record<string, number> = {};
                  bookings.forEach(b => { timeCounts[b.time] = (timeCounts[b.time] || 0) + 1; });
                  const sorted = Object.entries(timeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  const max = sorted[0]?.[1] || 1;
                  return sorted.map(([time, count]) => (
                    <div key={time} className="text-center">
                      <div className="h-20 rounded-lg bg-surface-light flex items-end justify-center overflow-hidden mb-1">
                        <div className="w-full rounded-t-lg bg-gold/20" style={{ height: `${(count / max) * 100}%` }} />
                      </div>
                      <p className="text-[9px] text-muted">{time}</p>
                      <p className="text-[10px] font-bold">{count}</p>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* Status Distribution */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-purple-400" /> Bookings by Status</h2>
            <div className="grid grid-cols-4 gap-3">
              {(["confirmed", "completed", "cancelled", "no_show"] as const).map(status => {
                const count = bookings.filter(b => b.status === status).length;
                const pct = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
                return (
                  <div key={status} className="p-3 rounded-lg bg-surface-light text-center border border-border">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-[10px] text-muted capitalize">{status.replace("_", " ")} ({pct}%)</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Shuffle size={13} className="text-gold" /> Team Round-Robin</h2>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light">
              <div>
                <p className="text-xs font-semibold">Enable Round-Robin Scheduling</p>
                <p className="text-[10px] text-muted">Automatically distribute bookings among team members</p>
              </div>
              <button onClick={() => setRoundRobin(!roundRobin)}
                className={`w-10 h-5 rounded-full transition-all relative ${roundRobin ? "bg-gold" : "bg-surface"}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${roundRobin ? "left-5.5" : "left-0.5"}`} style={{ left: roundRobin ? 22 : 2 }} />
              </button>
            </div>
            {roundRobin && (
              <div className="mt-2 space-y-1.5">
                {["Nicklas", "Sarah", "Maria"].map(name => (
                  <div key={name} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light text-xs">
                    <Check size={12} className="text-emerald-400" />
                    <span>{name}</span>
                    <span className="text-muted ml-auto">Active in rotation</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-blue-400" /> Timezone Detection</h2>
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-light">
              <div>
                <p className="text-xs font-semibold">Auto-detect Client Timezone</p>
                <p className="text-[10px] text-muted">Show available times in the booker&apos;s local timezone</p>
              </div>
              <button onClick={() => setAutoTimezone(!autoTimezone)}
                className={`w-10 h-5 rounded-full transition-all relative ${autoTimezone ? "bg-gold" : "bg-surface"}`}>
                <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all`} style={{ left: autoTimezone ? 22 : 2 }} />
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="section-header flex items-center gap-2"><AlertCircle size={13} className="text-red-400" /> Reschedule / Cancel Policy</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Minimum Reschedule Notice</label>
                <select value={reschedulePolicy} onChange={e => setReschedulePolicy(e.target.value)} className="input w-full text-xs">
                  <option value="none">No minimum</option>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="48h">48 hours</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Minimum Cancel Notice</label>
                <select value={cancelPolicy} onChange={e => setCancelPolicy(e.target.value)} className="input w-full text-xs">
                  <option value="none">No minimum</option>
                  <option value="1h">1 hour</option>
                  <option value="4h">4 hours</option>
                  <option value="24h">24 hours</option>
                  <option value="48h">48 hours</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link Generator Modal */}
      {showLinkGen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLinkGen(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Link2 size={14} className="text-gold" /> Booking Link Generator</h3>
              <button onClick={() => setShowLinkGen(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>
            {meetingTypes.filter(m => m.active).length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No active meeting types. Create one first.</p>
            ) : (
              <>
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Select Meeting Type</label>
                  <select value={selectedLink} onChange={e => setSelectedLink(e.target.value)} className="input w-full text-xs">
                    <option value="">Choose...</option>
                    {meetingTypes.filter(m => m.active).map(mt => (
                      <option key={mt.id} value={bookingLink(mt.id)}>{mt.name} ({mt.duration} min)</option>
                    ))}
                  </select>
                </div>
                {selectedLink && (
                  <div>
                    <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Your Link</label>
                    <div className="flex gap-2">
                      <code className="flex-1 text-[10px] p-2.5 rounded-lg bg-surface-light border border-border truncate">{selectedLink}</code>
                      <button onClick={() => copyLink(selectedLink)} className="btn-primary text-xs px-3">
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Create Meeting Type Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-surface rounded-2xl border border-border w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2"><Plus size={14} className="text-gold" /> New Meeting Type</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted hover:text-foreground"><X size={16} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Name *</label>
                <input type="text" className="input w-full text-xs" placeholder="e.g. Discovery Call"
                  value={newMeeting.name} onChange={e => setNewMeeting(prev => ({ ...prev, name: e.target.value }))} />
              </div>

              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Description</label>
                <textarea className="input w-full text-xs" rows={2} placeholder="Brief description of this meeting type..."
                  value={newMeeting.description} onChange={e => setNewMeeting(prev => ({ ...prev, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Duration</label>
                  <select className="input w-full text-xs" value={newMeeting.duration}
                    onChange={e => setNewMeeting(prev => ({ ...prev, duration: parseInt(e.target.value) }))}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Location</label>
                  <select className="input w-full text-xs" value={newMeeting.location_type}
                    onChange={e => setNewMeeting(prev => ({ ...prev, location_type: e.target.value }))}>
                    {LOCATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Buffer Time</label>
                  <select className="input w-full text-xs" value={newMeeting.buffer_time}
                    onChange={e => setNewMeeting(prev => ({ ...prev, buffer_time: parseInt(e.target.value) }))}>
                    <option value={0}>No buffer</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Max/Day</label>
                  <input type="number" className="input w-full text-xs" placeholder="No limit"
                    value={newMeeting.max_bookings_per_day}
                    onChange={e => setNewMeeting(prev => ({ ...prev, max_bookings_per_day: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setNewMeeting(prev => ({ ...prev, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${newMeeting.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={handleCreate} disabled={!newMeeting.name || creating} className="btn-primary text-xs flex items-center gap-1.5">
                {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
