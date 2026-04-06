"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Link2, Camera, MessageCircle, Music, Briefcase, Play,
  Globe, Plus, Loader, Check, X
} from "lucide-react";
import toast from "react-hot-toast";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  is_active: boolean;
}

const SOCIALS = [
  { id: "instagram", name: "Instagram", icon: <Camera size={20} />, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-400/20", placeholder: "@yourbusiness" },
  { id: "facebook", name: "Facebook", icon: <MessageCircle size={20} />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-400/20", placeholder: "Your Page Name" },
  { id: "tiktok", name: "TikTok", icon: <Music size={20} />, color: "text-white", bg: "bg-white/5 border-white/15", placeholder: "@yourtiktok" },
  { id: "linkedin", name: "LinkedIn", icon: <Briefcase size={20} />, color: "text-blue-300", bg: "bg-blue-300/10 border-blue-300/20", placeholder: "Company or profile name" },
  { id: "youtube", name: "YouTube", icon: <Play size={20} />, color: "text-red-400", bg: "bg-red-500/10 border-red-400/20", placeholder: "Channel name" },
  { id: "website", name: "Website", icon: <Globe size={20} />, color: "text-gold", bg: "bg-gold/10 border-gold/20", placeholder: "www.yourbusiness.com" },
];

export default function SocialAccountsPage() {
  const { profile } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchAccounts();
  }, [profile]);

  async function fetchAccounts() {
    let cId: string | null = null;

    if (profile?.role === "client") {
      const { data } = await supabase.from("clients").select("id").eq("profile_id", profile.id).single();
      cId = data?.id || null;
    } else {
      const { data } = await supabase.from("clients").select("id").eq("is_active", true).order("created_at").limit(1);
      cId = data?.[0]?.id || null;
    }

    setClientId(cId);

    if (cId) {
      const res = await fetch(`/api/social/connect?client_id=${cId}`);
      const data = await res.json();
      setAccounts(data.accounts || []);
    }
    setLoading(false);
  }

  async function saveAccount(platformId: string) {
    if (!inputValue.trim() || !clientId) return;
    setSaving(true);

    try {
      const res = await fetch("/api/social/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          platform: platformId,
          account_name: inputValue.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Account connected!");
        setEditing(null);
        setInputValue("");
        fetchAccounts();
      }
    } catch {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  async function removeAccount(accountId: string) {
    try {
      await fetch("/api/social/connect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      toast.success("Removed");
      fetchAccounts();
    } catch {
      toast.error("Failed to remove");
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader size={20} className="animate-spin text-gold" />
    </div>
  );

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Link2 size={18} className="text-gold" /> My Social Accounts
        </h1>
        <p className="text-xs text-muted mt-0.5">Link your accounts so our AI can help with content, scheduling, and analytics</p>
      </div>

      {/* Accounts grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOCIALS.map(social => {
          const connected = accounts.find(a => a.platform === social.id && a.is_active);
          const isEditing = editing === social.id;

          return (
            <div key={social.id} className={`rounded-xl p-4 border transition-all ${
              connected ? social.bg : "bg-surface border-border/30"
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  connected ? social.bg : "bg-surface-light border-border/30"
                }`}>
                  <span className={connected ? social.color : "text-muted"}>{social.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{social.name}</p>
                  {connected && !isEditing && (
                    <p className={`text-[11px] ${social.color} font-medium`}>{connected.account_name}</p>
                  )}
                  {!connected && !isEditing && (
                    <p className="text-[10px] text-muted">Not connected</p>
                  )}
                </div>
                {connected && !isEditing && (
                  <Check size={16} className="text-success" />
                )}
              </div>

              {/* Edit / connect mode */}
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={social.placeholder}
                    className="input w-full text-xs"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && saveAccount(social.id)}
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => saveAccount(social.id)} disabled={saving || !inputValue.trim()}
                      className="btn-primary text-[10px] py-1 px-3 flex-1 disabled:opacity-50">
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => { setEditing(null); setInputValue(""); }}
                      className="btn-secondary text-[10px] py-1 px-3">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : connected ? (
                <div className="flex gap-1.5">
                  <button onClick={() => { setEditing(social.id); setInputValue(connected.account_name); }}
                    className="text-[10px] text-muted hover:text-white transition-colors">
                    Edit
                  </button>
                  <span className="text-border">·</span>
                  <button onClick={() => removeAccount(connected.id)}
                    className="text-[10px] text-muted hover:text-danger transition-colors">
                    Remove
                  </button>
                </div>
              ) : (
                <button onClick={() => { setEditing(social.id); setInputValue(""); }}
                  className="w-full btn-secondary text-[10px] py-1.5 flex items-center justify-center gap-1">
                  <Plus size={11} /> Connect {social.name}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="card border-border/20 bg-surface-light/20">
        <p className="text-[10px] text-muted leading-relaxed">
          Connecting your accounts lets our AI assistant help you with content ideas, posting schedules,
          competitor analysis, and performance tracking. We only store your account name — no passwords or login credentials.
        </p>
      </div>
    </div>
  );
}
