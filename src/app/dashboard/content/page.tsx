"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ContentScript, ContentRequest, PublishQueueItem, PersonalBrandIdea, ContentCalendarEntry, PublishPlatform } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Film, FileText, Inbox, Upload, User, Sparkles, Calendar,
  Check, Edit3, Clock, Send
} from "lucide-react";
import toast from "react-hot-toast";

type Tab = "scripts" | "requests" | "publish" | "calendar" | "personal";

export default function ContentPage() {
  const [tab, setTab] = useState<Tab>("scripts");
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [publishQueue, setPublishQueue] = useState<PublishQueueItem[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [personalIdeas, setPersonalIdeas] = useState<PersonalBrandIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showPublishEditor, setShowPublishEditor] = useState<PublishQueueItem | null>(null);
  const [editingPublish, setEditingPublish] = useState<Partial<PublishQueueItem>>({});
  const supabase = createClient();

  useEffect(() => { fetchData(); }, [tab]);

  async function fetchData() {
    setLoading(true);
    if (tab === "scripts") {
      const { data } = await supabase.from("content_scripts").select("*").order("created_at", { ascending: false });
      setScripts(data || []);
    } else if (tab === "requests") {
      const { data } = await supabase.from("content_requests").select("*").order("created_at", { ascending: false });
      setRequests(data || []);
    } else if (tab === "publish") {
      const { data } = await supabase.from("publish_queue").select("*").order("created_at", { ascending: false });
      setPublishQueue(data || []);
    } else if (tab === "calendar") {
      const { data } = await supabase.from("content_calendar").select("*").order("scheduled_at", { ascending: true });
      setCalendar(data || []);
    } else if (tab === "personal") {
      const { data } = await supabase.from("personal_brand_ideas").select("*").order("batch_date", { ascending: false });
      setPersonalIdeas(data || []);
    }
    setLoading(false);
  }

  async function generateScript(formData: FormData) {
    toast.loading("Generating script with AI...");
    try {
      const res = await fetch("/api/content/generate", {
        method: "POST",
        body: JSON.stringify({
          client_id: formData.get("client_id"),
          script_type: formData.get("script_type"),
          topic: formData.get("topic"),
          brand_voice: formData.get("brand_voice"),
          platform: formData.get("platform"),
        }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        toast.dismiss();
        toast.success("Script generated!");
        setShowGenerateModal(false);
        fetchData();
      } else {
        toast.dismiss();
        toast.error("Failed to generate script");
      }
    } catch {
      toast.dismiss();
      toast.error("Error generating script");
    }
  }

  async function approvePublish(item: PublishQueueItem) {
    const { error } = await supabase.from("publish_queue").update({
      status: "approved",
      approved_at: new Date().toISOString(),
      ...editingPublish,
    }).eq("id", item.id);
    if (error) toast.error("Failed to approve");
    else { toast.success("Approved for publishing"); setShowPublishEditor(null); fetchData(); }
  }

  async function approveIdea(id: string) {
    await supabase.from("personal_brand_ideas").update({ is_approved: true }).eq("id", id);
    toast.success("Idea approved");
    fetchData();
  }

  async function addToCalendar(idea: PersonalBrandIdea) {
    await supabase.from("personal_brand_ideas").update({ added_to_calendar: true }).eq("id", idea.id);
    await supabase.from("content_calendar").insert({
      title: idea.title,
      platform: idea.platform_recommendation === "TikTok" ? "tiktok" : idea.platform_recommendation === "Shorts" ? "youtube_shorts" : "instagram_reels",
      status: "scheduled",
    });
    toast.success("Added to calendar");
    fetchData();
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "scripts", label: "Scripts", icon: <FileText size={16} /> },
    { key: "requests", label: "Request Inbox", icon: <Inbox size={16} /> },
    { key: "publish", label: "Publish Queue", icon: <Upload size={16} /> },
    { key: "calendar", label: "Calendar", icon: <Calendar size={16} /> },
    { key: "personal", label: "Personal Brand", icon: <User size={16} /> },
  ];

  if (loading && tab === "scripts") return <PageLoading />;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Content AI Agent</h1>
          <p className="text-muted text-sm">Scripts, requests, publishing & personal brand</p>
        </div>
        <button onClick={() => setShowGenerateModal(true)} className="btn-primary flex items-center gap-2">
          <Sparkles size={16} /> Generate Script
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoading /> : (
        <>
          {/* Scripts */}
          {tab === "scripts" && (
            <DataTable
              columns={[
                { key: "title", label: "Title", render: (s: ContentScript) => (
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-xs text-muted">{s.script_type === "long_form" ? "Long Form" : "Short Form"}</p>
                  </div>
                )},
                { key: "seo_title", label: "SEO Title", render: (s: ContentScript) => (
                  <p className="text-xs max-w-xs truncate">{s.seo_title || "-"}</p>
                )},
                { key: "target_platform", label: "Platform", render: (s: ContentScript) => (
                  <span className="capitalize">{s.target_platform?.replace("_", " ") || "-"}</span>
                )},
                { key: "status", label: "Status", render: (s: ContentScript) => <StatusBadge status={s.status} /> },
                { key: "hashtags", label: "Hashtags", render: (s: ContentScript) => (
                  <span className="text-xs text-muted">{s.hashtags?.length || 0} tags</span>
                )},
                { key: "created_at", label: "Created", render: (s: ContentScript) => formatDate(s.created_at) },
              ]}
              data={scripts}
              emptyMessage="No scripts generated yet. Click 'Generate Script' to start."
            />
          )}

          {/* Content Requests */}
          {tab === "requests" && (
            <DataTable
              columns={[
                { key: "requester_name", label: "From" },
                { key: "source", label: "Source", render: (r: ContentRequest) => <span className="capitalize">{r.source || "-"}</span> },
                { key: "request_text", label: "Request", render: (r: ContentRequest) => (
                  <p className="text-sm max-w-md truncate">{r.request_text}</p>
                )},
                { key: "ai_brief", label: "AI Brief", render: (r: ContentRequest) => r.ai_brief ? (
                  <span className="text-xs text-success flex items-center gap-1"><Check size={12} /> Generated</span>
                ) : <span className="text-xs text-muted">Pending</span> },
                { key: "status", label: "Status", render: (r: ContentRequest) => <StatusBadge status={r.status} /> },
                { key: "created_at", label: "Received", render: (r: ContentRequest) => formatDate(r.created_at) },
              ]}
              data={requests}
              emptyMessage="No content requests yet."
            />
          )}

          {/* Publish Queue — Pre-Publishing Editor */}
          {tab === "publish" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Pending Review" value={publishQueue.filter((p) => p.status === "pending").length} />
                <StatCard label="Approved" value={publishQueue.filter((p) => p.status === "approved").length} />
                <StatCard label="Published" value={publishQueue.filter((p) => p.status === "published").length} />
              </div>
              <DataTable
                columns={[
                  { key: "video_title", label: "Video Title" },
                  { key: "platforms", label: "Platforms", render: (p: PublishQueueItem) => (
                    <div className="flex flex-wrap gap-1">
                      {p.platforms?.map((pl, i) => (
                        <span key={i} className="badge bg-surface-light text-xs capitalize">{pl.replace("_", " ")}</span>
                      ))}
                    </div>
                  )},
                  { key: "scheduled_at", label: "Scheduled", render: (p: PublishQueueItem) => p.scheduled_at ? formatDateTime(p.scheduled_at) : "Not set" },
                  { key: "status", label: "Status", render: (p: PublishQueueItem) => <StatusBadge status={p.status} /> },
                  { key: "actions", label: "", render: (p: PublishQueueItem) => p.status === "pending" ? (
                    <button onClick={() => { setShowPublishEditor(p); setEditingPublish({ video_title: p.video_title, description: p.description, hashtags: p.hashtags, thumbnail_text: p.thumbnail_text, scheduled_at: p.scheduled_at }); }}
                      className="btn-secondary text-xs py-1 px-3">
                      <Edit3 size={12} /> Review
                    </button>
                  ) : null },
                ]}
                data={publishQueue}
                emptyMessage="No videos in the publish queue."
              />
            </div>
          )}

          {/* Calendar */}
          {tab === "calendar" && (
            <DataTable
              columns={[
                { key: "title", label: "Content" },
                { key: "platform", label: "Platform", render: (c: ContentCalendarEntry) => <span className="capitalize">{c.platform.replace("_", " ")}</span> },
                { key: "scheduled_at", label: "Scheduled", render: (c: ContentCalendarEntry) => c.scheduled_at ? formatDateTime(c.scheduled_at) : "TBD" },
                { key: "status", label: "Status", render: (c: ContentCalendarEntry) => <StatusBadge status={c.status} /> },
                { key: "live_url", label: "URL", render: (c: ContentCalendarEntry) => c.live_url ? (
                  <a href={c.live_url} target="_blank" rel="noopener" className="text-gold text-xs">View</a>
                ) : "-" },
              ]}
              data={calendar}
              emptyMessage="No content scheduled yet."
            />
          )}

          {/* Personal Brand */}
          {tab === "personal" && (
            <div className="space-y-6">
              {/* Long Form Ideas */}
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Film size={18} /> Long-Form Ideas (5 per Sunday)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {personalIdeas.filter((i) => i.idea_type === "long_form").length === 0 ? (
                    <EmptyState title="No long-form ideas yet" description="Ideas are generated every Sunday at 09:00 CET" />
                  ) : (
                    personalIdeas.filter((i) => i.idea_type === "long_form").map((idea) => (
                      <div key={idea.id} className="card-hover">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-medium text-sm leading-tight">{idea.title}</h3>
                          {idea.is_approved && <Check size={16} className="text-success shrink-0" />}
                        </div>
                        <p className="text-xs text-muted mb-2">{idea.hook?.slice(0, 100)}...</p>
                        <div className="flex items-center gap-2 text-xs text-muted mb-3">
                          <Clock size={12} /> {idea.estimated_length}
                          <span className="text-gold">#{idea.target_keyword}</span>
                        </div>
                        {idea.thumbnail_concept && (
                          <p className="text-xs text-muted mb-3 bg-surface-light p-2 rounded">
                            Thumbnail: {idea.thumbnail_concept}
                          </p>
                        )}
                        <div className="flex gap-2">
                          {!idea.is_approved && (
                            <button onClick={() => approveIdea(idea.id)} className="btn-primary text-xs py-1 px-3">Approve</button>
                          )}
                          {!idea.added_to_calendar && (
                            <button onClick={() => addToCalendar(idea)} className="btn-secondary text-xs py-1 px-3">Add to Calendar</button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Short Form Ideas */}
              <div>
                <h2 className="section-header flex items-center gap-2">
                  <Send size={18} /> Short-Form Ideas (20 per Sunday)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {personalIdeas.filter((i) => i.idea_type === "short_form").length === 0 ? (
                    <EmptyState title="No short-form ideas yet" description="Ideas are generated every Sunday at 09:00 CET" />
                  ) : (
                    personalIdeas.filter((i) => i.idea_type === "short_form").map((idea) => (
                      <div key={idea.id} className="card-hover p-4">
                        <h3 className="font-medium text-sm mb-1">{idea.title}</h3>
                        <p className="text-xs text-gold mb-1">Hook: {idea.hook}</p>
                        <p className="text-xs text-muted mb-2">{idea.core_concept}</p>
                        <div className="flex items-center justify-between">
                          <span className="badge bg-surface-light text-xs">{idea.platform_recommendation}</span>
                          <div className="flex gap-1">
                            {!idea.is_approved && (
                              <button onClick={() => approveIdea(idea.id)} className="text-xs text-gold hover:text-gold-light">Approve</button>
                            )}
                          </div>
                        </div>
                        {idea.trending_angle && (
                          <p className="text-xs text-muted mt-2 italic">{idea.trending_angle}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Generate Script Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate AI Script" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); generateScript(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Script Type *</label>
              <select name="script_type" className="input w-full" required>
                <option value="long_form">Long Form (8-15 min)</option>
                <option value="short_form">Short Form (30-60 sec)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Platform</label>
              <select name="platform" className="input w-full">
                <option value="">Auto-detect</option>
                <option value="youtube">YouTube</option>
                <option value="youtube_shorts">YouTube Shorts</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram_reels">Instagram Reels</option>
                <option value="facebook_reels">Facebook Reels</option>
                <option value="linkedin_video">LinkedIn Video</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Topic / Idea *</label>
            <input name="topic" className="input w-full" placeholder="What should the video be about?" required />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Brand Voice</label>
            <input name="brand_voice" className="input w-full" placeholder="e.g., professional, casual, energetic" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowGenerateModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Sparkles size={16} /> Generate
            </button>
          </div>
        </form>
      </Modal>

      {/* Publish Editor Modal */}
      <Modal isOpen={!!showPublishEditor} onClose={() => setShowPublishEditor(null)} title="Pre-Publishing Editor" size="xl">
        {showPublishEditor && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Video Title</label>
              <input
                className="input w-full"
                value={editingPublish.video_title || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, video_title: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <textarea
                className="input w-full h-32"
                value={editingPublish.description || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, description: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Hashtags (comma separated)</label>
              <textarea
                className="input w-full h-20"
                value={editingPublish.hashtags?.join(", ") || ""}
                onChange={(e) => setEditingPublish({ ...editingPublish, hashtags: e.target.value.split(",").map((h) => h.trim()) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Thumbnail Text</label>
                <input
                  className="input w-full"
                  value={editingPublish.thumbnail_text || ""}
                  onChange={(e) => setEditingPublish({ ...editingPublish, thumbnail_text: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={editingPublish.scheduled_at?.slice(0, 16) || ""}
                  onChange={(e) => setEditingPublish({ ...editingPublish, scheduled_at: new Date(e.target.value).toISOString() })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted mb-2">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {["youtube", "youtube_shorts", "tiktok", "instagram_reels", "facebook_reels", "linkedin_video"].map((p) => (
                  <label key={p} className="flex items-center gap-2 bg-surface-light px-3 py-2 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPublishEditor.platforms?.includes(p as PublishPlatform) || false}
                      className="accent-gold"
                      readOnly
                    />
                    <span className="text-sm capitalize">{p.replace("_", " ")}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setShowPublishEditor(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => { /* Publish now logic */ }} className="btn-secondary flex items-center gap-2">
                <Send size={16} /> Publish Now
              </button>
              <button onClick={() => approvePublish(showPublishEditor)} className="btn-primary flex items-center gap-2">
                <Check size={16} /> Approve & Schedule
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
