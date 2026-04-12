"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import {
  MessageSquare, Plus, Pin, Heart, Trash2, Send, Loader,
  Megaphone, HelpCircle, Sparkles, BookOpen, Users, ChevronDown
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  type: string;
  pinned: boolean;
  likes: number;
  created_at: string;
  comment_count: number;
  profiles: { full_name: string; avatar_url: string | null; role: string } | null;
}

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  profiles: { full_name: string; avatar_url: string | null; role: string } | null;
}

const POST_TYPES = [
  { id: "all", label: "All", icon: <MessageSquare size={13} /> },
  { id: "announcement", label: "Announcements", icon: <Megaphone size={13} /> },
  { id: "discussion", label: "Discussions", icon: <Users size={13} /> },
  { id: "question", label: "Questions", icon: <HelpCircle size={13} /> },
  { id: "resource", label: "Resources", icon: <BookOpen size={13} /> },
  { id: "showcase", label: "Showcase", icon: <Sparkles size={13} /> },
];

const TYPE_COLORS: Record<string, string> = {
  announcement: "bg-gold/10 text-gold border-gold/20",
  discussion: "bg-info/10 text-info border-info/20",
  question: "bg-warning/10 text-warning border-warning/20",
  resource: "bg-accent/10 text-accent border-accent/20",
  showcase: "bg-success/10 text-success border-success/20",
};

export default function CommunityPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchPosts(); }, [filter]);

  async function fetchPosts() {
    setLoading(true);
    const res = await fetch(`/api/community?type=${filter}`);
    const data = await res.json();
    setPosts(data.posts || []);
    setLoading(false);
  }

  async function createPost(title: string, content: string, type: string) {
    setSubmitting(true);
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_post", title, content, type }),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Post created!");
      setShowNewPost(false);
      fetchPosts();
    } else {
      toast.error(data.error || "Failed");
    }
    setSubmitting(false);
  }

  async function loadComments(postId: string) {
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_comments", post_id: postId }),
    });
    const data = await res.json();
    setComments(prev => ({ ...prev, [postId]: data.comments || [] }));
  }

  async function addComment(postId: string) {
    if (!newComment.trim()) return;
    const res = await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_comment", post_id: postId, content: newComment }),
    });
    const data = await res.json();
    if (data.success) {
      setNewComment("");
      loadComments(postId);
      fetchPosts();
    }
  }

  async function likePost(postId: string) {
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "like_post", post_id: postId }),
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
  }

  async function pinPost(postId: string, pinned: boolean) {
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pin_post", post_id: postId, pinned }),
    });
    fetchPosts();
  }

  async function deletePost(postId: string) {
    if (!confirm("Delete this post?")) return;
    await fetch("/api/community", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_post", post_id: postId }),
    });
    toast.success("Post deleted");
    fetchPosts();
  }

  function toggleExpand(postId: string) {
    if (expandedPost === postId) {
      setExpandedPost(null);
    } else {
      setExpandedPost(postId);
      if (!comments[postId]) loadComments(postId);
    }
  }

  return (
    <div className="fade-in space-y-5 max-w-[900px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
            <Users size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="page-header mb-0">Community</h1>
            <p className="text-xs text-muted">Discussions, announcements & resources for the ShortStack community</p>
          </div>
        </div>
        <button onClick={() => setShowNewPost(true)} className="btn-primary flex items-center gap-2 text-xs">
          <Plus size={14} /> New Post
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {POST_TYPES.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
              filter === t.id ? "bg-gold/10 border-gold/20 text-gold" : "border-border text-muted hover:text-foreground hover:border-border-light"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size={20} className="animate-spin text-gold" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={32} className="text-muted/30 mx-auto mb-2" />
          <p className="text-sm text-muted">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className={`card transition-all ${post.pinned ? "border-gold/20 bg-gold/[0.02]" : ""}`}>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center text-xs font-bold text-gold shrink-0">
                  {post.profiles?.full_name?.charAt(0) || "?"}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold">{post.profiles?.full_name || "Unknown"}</span>
                        {post.profiles?.role === "admin" && (
                          <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">ADMIN</span>
                        )}
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border ${TYPE_COLORS[post.type] || "bg-surface-light text-muted border-border"}`}>
                          {post.type}
                        </span>
                        {post.pinned && <Pin size={10} className="text-gold" />}
                      </div>
                      <h3 className="text-sm font-medium mt-0.5">{post.title}</h3>
                    </div>
                    <span className="text-[9px] text-muted shrink-0">{formatRelativeTime(post.created_at)}</span>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-muted mt-1.5 whitespace-pre-wrap leading-relaxed">
                    {expandedPost === post.id ? post.content : post.content.length > 200 ? post.content.slice(0, 200) + "..." : post.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={() => likePost(post.id)}
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-danger transition-colors">
                      <Heart size={12} /> {post.likes}
                    </button>
                    <button onClick={() => toggleExpand(post.id)}
                      className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground transition-colors">
                      <MessageSquare size={12} /> {post.comment_count} {expandedPost === post.id ? <ChevronDown size={10} className="rotate-180" /> : <ChevronDown size={10} />}
                    </button>
                    {profile?.role === "admin" && (
                      <button onClick={() => pinPost(post.id, !post.pinned)}
                        className={`flex items-center gap-1 text-[10px] transition-colors ${post.pinned ? "text-gold" : "text-muted hover:text-gold"}`}>
                        <Pin size={12} /> {post.pinned ? "Unpin" : "Pin"}
                      </button>
                    )}
                    {(post.author_id === profile?.id || profile?.role === "admin") && (
                      <button onClick={() => deletePost(post.id)}
                        className="flex items-center gap-1 text-[10px] text-muted hover:text-danger transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Comments */}
                  {expandedPost === post.id && (
                    <div className="mt-3 pt-3 border-t border-border space-y-2">
                      {(comments[post.id] || []).map(c => (
                        <div key={c.id} className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-light flex items-center justify-center text-[9px] font-bold text-muted shrink-0">
                            {c.profiles?.full_name?.charAt(0) || "?"}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold">{c.profiles?.full_name}</span>
                              {c.profiles?.role === "admin" && <span className="text-[7px] bg-gold/10 text-gold px-1 py-0.5 rounded">ADMIN</span>}
                              <span className="text-[8px] text-muted">{formatRelativeTime(c.created_at)}</span>
                            </div>
                            <p className="text-[11px] text-muted mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}

                      {/* New comment */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && addComment(post.id)}
                          placeholder="Write a comment..."
                          className="input flex-1 text-xs py-1.5"
                        />
                        <button onClick={() => addComment(post.id)} className="btn-primary text-[10px] px-2 py-1.5">
                          <Send size={12} />
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

      {/* New Post Modal */}
      <Modal isOpen={showNewPost} onClose={() => setShowNewPost(false)} title="New Post">
        <form onSubmit={e => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          createPost(fd.get("title") as string, fd.get("content") as string, fd.get("type") as string);
        }} className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Type</label>
            <select name="type" className="input w-full text-xs">
              <option value="discussion">Discussion</option>
              <option value="question">Question</option>
              <option value="resource">Resource</option>
              <option value="showcase">Showcase</option>
              {profile?.role === "admin" && <option value="announcement">Announcement</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Title *</label>
            <input name="title" className="input w-full" required placeholder="What's on your mind?" />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Content *</label>
            <textarea name="content" className="input w-full h-32 text-xs" required
              placeholder="Share your thoughts, ask a question, or post a resource..." />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowNewPost(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
              Post
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
