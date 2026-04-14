"use client";

import { useState } from "react";
import {
  Calendar, Clock, Users, Link2, Copy, Globe,
  Plus, Settings, Mail, Shuffle, BarChart3, Shield,
  X, Check, ExternalLink, Edit3, AlertCircle
} from "lucide-react";

type ScheduleTab = "booking_pages" | "availability" | "analytics" | "settings";

interface MeetingType {
  id: string;
  name: string;
  duration: number;
  color: string;
  description: string;
  active: boolean;
  bufferBefore: number;
  bufferAfter: number;
  maxPerDay: number;
  link: string;
  questions: { id: string; text: string; required: boolean }[];
}

interface BookingData {
  id: string;
  name: string;
  email: string;
  meetingType: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled" | "rescheduled";
  notes: string;
  timezone: string;
}

const MOCK_MEETING_TYPES: MeetingType[] = [
  { id: "1", name: "Discovery Call", duration: 30, color: "#10b981", description: "Initial consultation for prospective clients", active: true, bufferBefore: 5, bufferAfter: 10, maxPerDay: 6, link: "https://cal.shortstack.io/nicklas/discovery", questions: [{ id: "q1", text: "What is your business?", required: true }, { id: "q2", text: "What are your goals?", required: false }] },
  { id: "2", name: "Strategy Session", duration: 60, color: "#3b82f6", description: "Deep dive into marketing strategy", active: true, bufferBefore: 10, bufferAfter: 15, maxPerDay: 3, link: "https://cal.shortstack.io/nicklas/strategy", questions: [{ id: "q3", text: "Current monthly revenue?", required: true }] },
  { id: "3", name: "Quick Check-in", duration: 15, color: "#f59e0b", description: "Fast sync with existing clients", active: true, bufferBefore: 0, bufferAfter: 5, maxPerDay: 10, link: "https://cal.shortstack.io/nicklas/checkin", questions: [] },
  { id: "4", name: "Content Review", duration: 45, color: "#8b5cf6", description: "Review content calendar and assets", active: true, bufferBefore: 5, bufferAfter: 10, maxPerDay: 4, link: "https://cal.shortstack.io/nicklas/content-review", questions: [{ id: "q4", text: "Which platforms?", required: true }] },
  { id: "5", name: "Onboarding Session", duration: 60, color: "#ec4899", description: "Welcome session for new clients", active: false, bufferBefore: 15, bufferAfter: 15, maxPerDay: 2, link: "https://cal.shortstack.io/nicklas/onboarding", questions: [{ id: "q5", text: "Login credentials ready?", required: true }] },
];

const MOCK_BOOKINGS: BookingData[] = [
  { id: "b1", name: "Dr. Smith", email: "smith@dental.com", meetingType: "Discovery Call", date: "2026-04-14", time: "09:00", status: "confirmed", notes: "Dentist in Portland", timezone: "PST" },
  { id: "b2", name: "Lisa Wong", email: "lisa@luxesalon.com", meetingType: "Content Review", date: "2026-04-14", time: "11:00", status: "confirmed", notes: "Monthly review", timezone: "EST" },
  { id: "b3", name: "Mark Johnson", email: "mark@fitpro.com", meetingType: "Strategy Session", date: "2026-04-15", time: "14:00", status: "pending", notes: "Wants to scale ads", timezone: "CST" },
  { id: "b4", name: "Anna Davis", email: "anna@greeneats.com", meetingType: "Quick Check-in", date: "2026-04-15", time: "16:00", status: "rescheduled", notes: "Moved from Monday", timezone: "EST" },
  { id: "b5", name: "Tom Baker", email: "tom@metrorealty.com", meetingType: "Onboarding Session", date: "2026-04-16", time: "10:00", status: "confirmed", notes: "New client onboarding", timezone: "EST" },
];

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
  rescheduled: "bg-blue-400/10 text-blue-400",
};

export default function SchedulingPage() {
  const [tab, setTab] = useState<ScheduleTab>("booking_pages");
  const [meetingTypes, setMeetingTypes] = useState(MOCK_MEETING_TYPES);
  const [bookings] = useState(MOCK_BOOKINGS);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [showLinkGen, setShowLinkGen] = useState(false);
  const [selectedLink, setSelectedLink] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [availability, setAvailability] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(
    Object.fromEntries(DAYS.map(d => [d, { enabled: d !== "Saturday" && d !== "Sunday", start: "09:00", end: "17:00" }]))
  );
  const [roundRobin, setRoundRobin] = useState(true);
  const [autoTimezone, setAutoTimezone] = useState(true);
  const [reschedulePolicy, setReschedulePolicy] = useState("24h");
  const [cancelPolicy, setCancelPolicy] = useState("24h");

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter(b => b.status === "confirmed").length;
  const conversionRate = totalBookings > 0 ? Math.round((confirmedBookings / totalBookings) * 100) : 0;

  const copyLink = (url: string) => { navigator.clipboard.writeText(url); };

  const toggleMeetingType = (id: string) => {
    setMeetingTypes(prev => prev.map(mt => mt.id === id ? { ...mt, active: !mt.active } : mt));
  };

  const TABS: { id: ScheduleTab; label: string; icon: React.ReactNode }[] = [
    { id: "booking_pages", label: "Booking Pages", icon: <Calendar size={13} /> },
    { id: "availability", label: "Availability", icon: <Clock size={13} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> },
  ];

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
          <button className="btn-primary text-xs flex items-center gap-1.5">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {meetingTypes.map(mt => (
              <div key={mt.id} className={`card p-4 ${!mt.active ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="w-3 h-full rounded-full shrink-0 mt-1" style={{ background: mt.color, minHeight: 40 }} />
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
                    <p className="text-[10px] text-muted mb-2">{mt.description}</p>
                    <div className="flex items-center gap-3 text-[10px] text-muted mb-2">
                      <span className="flex items-center gap-1"><Clock size={9} /> {mt.duration} min</span>
                      <span className="flex items-center gap-1"><Shield size={9} /> {mt.bufferBefore}m before / {mt.bufferAfter}m after</span>
                      <span className="flex items-center gap-1"><Users size={9} /> Max {mt.maxPerDay}/day</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyLink(mt.link)} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
                        <Copy size={10} /> Copy Link
                      </button>
                      <a href={mt.link} target="_blank" rel="noopener" className="btn-ghost text-[10px] px-2 py-1 flex items-center gap-1 text-muted hover:text-foreground">
                        <ExternalLink size={10} /> Preview
                      </a>
                    </div>

                    {/* Edit Expanded */}
                    {editingType === mt.id && (
                      <div className="mt-3 pt-3 border-t border-border space-y-3">
                        {/* Custom Questions */}
                        <div>
                          <p className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Custom Questions</p>
                          {mt.questions.length === 0 ? (
                            <p className="text-[10px] text-muted/50">No custom questions</p>
                          ) : (
                            <div className="space-y-1">
                              {mt.questions.map(q => (
                                <div key={q.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-surface-light">
                                  <span className="flex-1">{q.text}</span>
                                  <span className={`text-[8px] px-1.5 py-0.5 rounded ${q.required ? "bg-gold/10 text-gold" : "text-muted"}`}>
                                    {q.required ? "Required" : "Optional"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Buffer Settings */}
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9px] text-muted mb-1">Buffer Before</label>
                            <select className="input w-full text-[10px]" defaultValue={mt.bufferBefore}>
                              <option value={0}>None</option>
                              <option value={5}>5 min</option>
                              <option value={10}>10 min</option>
                              <option value={15}>15 min</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] text-muted mb-1">Buffer After</label>
                            <select className="input w-full text-[10px]" defaultValue={mt.bufferAfter}>
                              <option value={0}>None</option>
                              <option value={5}>5 min</option>
                              <option value={10}>10 min</option>
                              <option value={15}>15 min</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9px] text-muted mb-1">Max/Day</label>
                            <input type="number" className="input w-full text-[10px]" defaultValue={mt.maxPerDay} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recent Bookings */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Calendar size={13} className="text-gold" /> Recent Bookings</h2>
            <div className="space-y-2">
              {bookings.map(b => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-light border border-border">
                  <div className="text-center shrink-0 w-12">
                    <p className="text-[9px] text-muted">{new Date(b.date).toLocaleDateString("en-US", { month: "short" })}</p>
                    <p className="text-lg font-bold leading-none">{new Date(b.date).getDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{b.name}</p>
                    <p className="text-[10px] text-muted">{b.meetingType} at {b.time} ({b.timezone})</p>
                    {b.notes && <p className="text-[9px] text-muted/50 mt-0.5">{b.notes}</p>}
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${STATUS_COLORS[b.status]}`}>{b.status}</span>
                </div>
              ))}
            </div>
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
              <p className="text-2xl font-bold text-emerald-400">87%</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Booking Time</p>
              <p className="text-2xl font-bold text-blue-400">2.3d</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Cancellation Rate</p>
              <p className="text-2xl font-bold text-red-400">8%</p>
            </div>
          </div>

          {/* Bookings by Type Chart */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Bookings by Meeting Type</h2>
            <div className="space-y-2">
              {meetingTypes.map(mt => {
                const count = bookings.filter(b => b.meetingType === mt.name).length;
                const pct = totalBookings > 0 ? (count / totalBookings) * 100 : 0;
                return (
                  <div key={mt.id} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: mt.color }} />
                    <span className="text-xs w-32 truncate">{mt.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: mt.color }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Popular Times */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Clock size={13} className="text-blue-400" /> Popular Booking Times</h2>
            <div className="grid grid-cols-5 gap-2">
              {[
                { time: "9:00 AM", pct: 85 }, { time: "10:00 AM", pct: 95 },
                { time: "11:00 AM", pct: 70 }, { time: "2:00 PM", pct: 90 },
                { time: "3:00 PM", pct: 60 },
              ].map(slot => (
                <div key={slot.time} className="text-center">
                  <div className="h-20 rounded-lg bg-surface-light flex items-end justify-center overflow-hidden mb-1">
                    <div className="w-full rounded-t-lg bg-gold/20" style={{ height: `${slot.pct}%` }} />
                  </div>
                  <p className="text-[9px] text-muted">{slot.time}</p>
                  <p className="text-[10px] font-bold">{slot.pct}%</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timezone Distribution */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-purple-400" /> Bookings by Timezone</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { tz: "EST", count: 12, pct: 48 },
                { tz: "CST", count: 7, pct: 28 },
                { tz: "PST", count: 6, pct: 24 },
              ].map(t => (
                <div key={t.tz} className="p-3 rounded-lg bg-surface-light text-center border border-border">
                  <p className="text-lg font-bold">{t.count}</p>
                  <p className="text-[10px] text-muted">{t.tz} ({t.pct}%)</p>
                </div>
              ))}
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
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Select Meeting Type</label>
              <select value={selectedLink} onChange={e => setSelectedLink(e.target.value)} className="input w-full text-xs">
                <option value="">Choose...</option>
                {meetingTypes.filter(m => m.active).map(mt => (
                  <option key={mt.id} value={mt.link}>{mt.name} ({mt.duration} min)</option>
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
          </div>
        </div>
      )}
    </div>
  );
}
