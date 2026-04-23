"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import StatusBadge from "@/components/ui/status-badge";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Upload, FolderOpen, Film, FileText, Link2,
  Globe, Eye, Download, Loader,
  ImageIcon, Music, File, ChevronRight, ExternalLink,
  TrendingUp, Users, Heart, Share2
} from "lucide-react";
import toast from "react-hot-toast";
import { getMaxStorageUpload, formatBytes } from "@/lib/plan-config";

interface ClientUpload {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string | null;
  category: string;
  status: string;
  created_at: string;
}

interface PublishedItem {
  id: string;
  video_title: string;
  description: string | null;
  platforms: string[];
  status: string;
  published_urls: Record<string, string>;
  published_at: string | null;
  created_at: string;
}

interface ContentItem {
  id: string;
  title: string;
  script_type: string;
  status: string;
  drive_folder_url: string | null;
  target_platform: string | null;
  created_at: string;
}

interface Analytics {
  totalPublished: number;
  totalContent: number;
  totalUploads: number;
  platformBreakdown: Record<string, number>;
  recentActivity: number;
}

interface ZernioProfile {
  id: string;
  platform: string;
  username: string;
  status: string;
  profileName: string;
}

export default function ClientUploadsPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [clientId, setClientId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<ClientUpload[]>([]);
  const [published, setPublished] = useState<PublishedItem[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [zernioProfiles, setZernioProfiles] = useState<ZernioProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"uploads" | "published" | "content" | "social">("uploads");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }

    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id, zernio_profile_id")
        .eq("profile_id", profile.id)
        .single();

      if (!clientData) { setLoading(false); return; }
      setClientId(clientData.id);

      const [legacyRes, portalRes] = await Promise.all([
        fetch(`/api/uploads?client_id=${clientData.id}`),
        fetch(`/api/portal/uploads`),
      ]);
      const data = await legacyRes.json();
      setPublished(data.published || []);
      setContent(data.content || []);

      // Prefer portal_uploads (new flow) — merge with legacy client_uploads
      const portalData = await portalRes.json().catch(() => ({ uploads: [] }));
      const portalMapped: ClientUpload[] = (portalData.uploads || []).map(
        (u: { id: string; file_name: string; content_type: string | null; file_size_bytes: number; signed_url: string | null; uploaded_at: string }) => ({
          id: u.id,
          file_name: u.file_name,
          file_type: (u.content_type || "").split("/")[1] || "bin",
          file_size: u.file_size_bytes,
          file_url: u.signed_url,
          category: (u.content_type || "").startsWith("image") ? "image"
            : (u.content_type || "").startsWith("video") ? "video"
            : (u.content_type || "").startsWith("audio") ? "audio"
            : "general",
          status: "uploaded",
          created_at: u.uploaded_at,
        }),
      );
      setUploads([...portalMapped, ...(data.uploads || [])]);

      // Fetch Zernio profiles
      if (clientData.zernio_profile_id) {
        try {
          const zRes = await fetch(`/api/social/zernio?client_id=${clientData.id}`);
          const zData = await zRes.json();
          setZernioProfiles(zData.profiles || []);
        } catch { /* Zernio not configured */ }
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile, fetchData]);

  const maxUpload = getMaxStorageUpload(profile?.plan_tier);
  const maxUploadLabel = formatBytes(maxUpload);

  async function handleFileUpload(files: File[]) {
    if (!clientId) return;
    setUploading(true);

    for (const file of files) {
      if (maxUpload !== -1 && file.size > maxUpload) {
        toast.error(`${file.name} is too large (max ${maxUploadLabel})`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 100 MB portal limit`);
        continue;
      }
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/portal/uploads", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(`${file.name}: ${err.error || "Upload failed"}`);
          continue;
        }
        toast.success(`Uploaded: ${file.name}`);
      } catch {
        toast.error(`Error uploading: ${file.name}`);
      }
    }

    setUploading(false);
    fetchData();
  }

  function getFileCategory(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.includes("pdf") || mimeType.includes("document")) return "document";
    return "general";
  }

  function getFileIcon(type: string) {
    if (type.startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(type)) return <ImageIcon size={14} className="text-blue-400" />;
    if (type.startsWith("video") || ["mp4", "mov", "avi", "webm"].includes(type)) return <Film size={14} className="text-purple-400" />;
    if (type.startsWith("audio") || ["mp3", "wav", "ogg"].includes(type)) return <Music size={14} className="text-pink-400" />;
    if (["pdf", "doc", "docx", "txt"].includes(type)) return <FileText size={14} className="text-gold" />;
    return <File size={14} className="text-muted" />;
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleFileUpload(files);
  }

  const analytics: Analytics = {
    totalPublished: published.filter(p => p.status === "published").length,
    totalContent: content.length,
    totalUploads: uploads.length,
    platformBreakdown: published.reduce((acc, p) => {
      p.platforms?.forEach(plat => { acc[plat] = (acc[plat] || 0) + 1; });
      return acc;
    }, {} as Record<string, number>),
    recentActivity: [...uploads, ...published, ...content].filter(item =>
      new Date(item.created_at) > new Date(Date.now() - 7 * 86400000)
    ).length,
  };

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
          <FolderOpen size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="page-header mb-0">My Uploads & Media</h1>
          <p className="text-xs text-muted">Your files, published content, and social media analytics</p>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Upload size={14} className="text-gold" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Uploads</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.totalUploads}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Film size={14} className="text-purple-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Content</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.totalContent}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe size={14} className="text-success" />
            <span className="text-[9px] text-muted uppercase tracking-wider">Published</span>
          </div>
          <p className="text-2xl font-bold font-mono text-success">{analytics.totalPublished}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-blue-400" />
            <span className="text-[9px] text-muted uppercase tracking-wider">This Week</span>
          </div>
          <p className="text-2xl font-bold font-mono">{analytics.recentActivity}</p>
        </div>
      </div>

      {/* Platform breakdown */}
      {Object.keys(analytics.platformBreakdown).length > 0 && (
        <div className="card p-4">
          <h3 className="text-[10px] text-muted uppercase tracking-wider mb-2">Platform Distribution</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(analytics.platformBreakdown).map(([platform, count]) => (
              <div key={platform} className="flex items-center gap-2 bg-surface-light px-3 py-1.5 rounded-lg">
                <span className="text-[10px] font-medium capitalize">{platform.replace(/_/g, " ")}</span>
                <span className="text-[10px] text-gold font-bold font-mono">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["uploads", "published", "content", "social"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "uploads" ? `Uploads (${uploads.length})` :
             t === "published" ? `Published (${published.length})` :
             t === "content" ? `Content (${content.length})` :
             `Social (${zernioProfiles.length})`}
          </button>
        ))}
      </div>

      {/* Uploads Tab */}
      {tab === "uploads" && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragOver ? "border-gold bg-gold/5" : "border-border hover:border-gold/30"
            }`}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                if (files.length > 0) handleFileUpload(files);
              };
              input.click();
            }}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader size={24} className="animate-spin text-gold" />
                <p className="text-xs text-muted">Uploading files...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center">
                  <Upload size={20} className="text-gold" />
                </div>
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-[10px] text-muted">Images, videos, documents, brand assets — max {maxUploadLabel} per file</p>
              </div>
            )}
          </div>

          {/* File list */}
          {uploads.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={24} />}
              title="No uploads yet"
              description="Upload files to share with your agency team"
            />
          ) : (
            <div className="space-y-2">
              {uploads.map(upload => (
                <div key={upload.id} className="card card-hover p-3 flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface-light rounded-lg flex items-center justify-center shrink-0">
                    {getFileIcon(upload.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{upload.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted">{formatFileSize(upload.file_size)}</span>
                      <span className="text-[9px] text-muted">{upload.category}</span>
                      <span className="text-[9px] text-muted">{formatRelativeTime(upload.created_at)}</span>
                    </div>
                  </div>
                  <StatusBadge status={upload.status} />
                  {upload.file_url && (
                    <a href={upload.file_url} target="_blank" rel="noopener noreferrer"
                      className="btn-ghost text-[10px] p-1.5">
                      <Download size={12} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Published Tab */}
      {tab === "published" && (
        <div className="space-y-2">
          {published.length === 0 ? (
            <EmptyState
              icon={<Globe size={24} />}
              title="No published content yet"
              description="Content published by your agency will appear here"
            />
          ) : (
            published.map(item => (
              <div key={item.id} className="card card-hover p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold truncate">{item.video_title}</h3>
                    {item.description && (
                      <p className="text-[10px] text-muted mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={item.status} />
                      {item.platforms?.map(p => (
                        <span key={p} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded capitalize">
                          {p.replace(/_/g, " ")}
                        </span>
                      ))}
                      <span className="text-[9px] text-muted">
                        {item.published_at ? formatDate(item.published_at) : formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                  {item.published_urls && Object.keys(item.published_urls).length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {Object.entries(item.published_urls).map(([platform, url]) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          className="btn-secondary text-[9px] py-1 px-2 flex items-center gap-1">
                          <ExternalLink size={9} /> {platform}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Content Tab */}
      {tab === "content" && (
        <div className="space-y-2">
          {content.length === 0 ? (
            <EmptyState
              icon={<FileText size={24} />}
              title="No content yet"
              description="Content scripts and projects will appear here as your agency creates them"
            />
          ) : (
            content.map(item => (
              <div key={item.id} className="card card-hover p-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                  <Film size={14} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] bg-surface-light px-1.5 py-0.5 rounded text-muted">{item.script_type}</span>
                    {item.target_platform && (
                      <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded capitalize">
                        {item.target_platform.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-[9px] text-muted">{formatRelativeTime(item.created_at)}</span>
                  </div>
                </div>
                <StatusBadge status={item.status} />
                {item.drive_folder_url && (
                  <a href={item.drive_folder_url} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost text-[10px] p-1.5">
                    <Link2 size={12} />
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Social / Zernio Tab */}
      {tab === "social" && (
        <div className="space-y-4">
          {zernioProfiles.length === 0 ? (
            <div className="card-static text-center py-12">
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Share2 size={28} className="text-gold" />
              </div>
              <h3 className="text-sm font-semibold mb-1">Social accounts not connected</h3>
              <p className="text-xs text-muted max-w-xs mx-auto mb-4">
                Ask your agency to connect your social media accounts through Zernio for automatic publishing and analytics.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-sm mx-auto">
                {["Instagram", "TikTok", "YouTube", "Facebook", "LinkedIn", "Twitter/X"].map(p => (
                  <div key={p} className="p-3 rounded-xl border border-border text-center">
                    <Globe size={16} className="text-muted mx-auto mb-1" />
                    <p className="text-[10px] text-muted">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="card p-4">
                <h3 className="text-[10px] text-muted uppercase tracking-wider mb-3">Connected Accounts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zernioProfiles.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-light rounded-xl">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        p.status === "active" ? "bg-success/10" : "bg-warning/10"
                      }`}>
                        <Globe size={16} className={p.status === "active" ? "text-success" : "text-warning"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold capitalize">{p.platform}</p>
                        <p className="text-[10px] text-muted truncate">@{p.username}</p>
                      </div>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${
                        p.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analytics placeholder */}
              <div className="card p-4">
                <h3 className="text-[10px] text-muted uppercase tracking-wider mb-3">Social Performance</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-surface-light rounded-xl">
                    <Eye size={16} className="text-blue-400 mx-auto mb-1" />
                    <p className="text-[9px] text-muted">Impressions</p>
                    <p className="text-sm font-bold font-mono">—</p>
                  </div>
                  <div className="text-center p-3 bg-surface-light rounded-xl">
                    <Users size={16} className="text-purple-400 mx-auto mb-1" />
                    <p className="text-[9px] text-muted">Reach</p>
                    <p className="text-sm font-bold font-mono">—</p>
                  </div>
                  <div className="text-center p-3 bg-surface-light rounded-xl">
                    <Heart size={16} className="text-pink-400 mx-auto mb-1" />
                    <p className="text-[9px] text-muted">Engagement</p>
                    <p className="text-sm font-bold font-mono">—</p>
                  </div>
                  <div className="text-center p-3 bg-surface-light rounded-xl">
                    <ChevronRight size={16} className="text-gold mx-auto mb-1" />
                    <p className="text-[9px] text-muted">Clicks</p>
                    <p className="text-sm font-bold font-mono">—</p>
                  </div>
                </div>
                <p className="text-[9px] text-muted text-center mt-3">
                  Live analytics will populate as content is published through Zernio
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
