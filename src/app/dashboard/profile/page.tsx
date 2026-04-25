"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  User, Save, Loader, Camera, Key, AtSign, Check, X, AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const usernameTimeout = useRef<ReturnType<typeof setTimeout>>();

  const [form, setForm] = useState({
    full_name: "",
    nickname: "",
    username: "",
    email: "",
    phone: "",
    timezone: "Europe/Copenhagen",
    country: "Denmark",
  });
  const [password, setPassword] = useState({ new: "", confirm: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        nickname: profile.nickname || profile.full_name || "",
        username: profile.username || "",
        email: profile.email || "",
        phone: profile.phone || "",
        timezone: profile.timezone || "Europe/Copenhagen",
        country: profile.country || "Denmark",
      });
    }
  }, [profile]);

  function handleUsernameChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
    setForm({ ...form, username: cleaned });
    setUsernameAvailable(null);

    if (cleaned.length < 3) return;
    if (cleaned === profile?.username) { setUsernameAvailable(true); return; }

    clearTimeout(usernameTimeout.current);
    usernameTimeout.current = setTimeout(async () => {
      setCheckingUsername(true);
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleaned)
        .neq("id", profile?.id || "")
        .limit(1);
      setUsernameAvailable(!data || data.length === 0);
      setCheckingUsername(false);
    }, 500);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Must be an image file"); return; }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) { toast.error("Upload failed: " + uploadError.message); setUploadingAvatar(false); return; }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

      await supabase.from("profiles").update({
        avatar_url: urlData.publicUrl + "?t=" + Date.now(),
      }).eq("id", profile.id);

      toast.success("Avatar updated!");
      refreshProfile?.();
    } catch { toast.error("Upload failed"); }
    setUploadingAvatar(false);
  }

  async function saveProfile() {
    if (form.username && form.username.length < 3) { toast.error("Username must be at least 3 characters"); return; }
    if (usernameAvailable === false) { toast.error("Username is taken"); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name,
        nickname: form.nickname || form.full_name,
        username: form.username || null,
        phone: form.phone,
        timezone: form.timezone,
        country: form.country,
      }).eq("id", profile?.id);

      if (error) {
        if (error.message.includes("unique") || error.message.includes("duplicate")) {
          toast.error("Username is already taken");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Profile updated!");
        refreshProfile?.();
      }
    } catch { toast.error("Failed to save"); }
    setSaving(false);
  }

  async function changePassword() {
    if (password.new !== password.confirm) { toast.error("Passwords don't match"); return; }
    if (password.new.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    try {
      const { error } = await supabase.auth.updateUser({ password: password.new });
      if (error) toast.error(error.message);
      else {
        toast.success("Password changed!");
        setPassword({ new: "", confirm: "" });
      }
    } catch { toast.error("Failed to change password"); }
  }

  const displayName = form.nickname || form.full_name || "?";
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="fade-in space-y-5 max-w-2xl">
      <PageHero
        icon={<User size={22} />}
        title="Profile"
        subtitle="Manage your account and identity."
        gradient="gold"
      />

      {/* Avatar + Identity Card */}
      <div className="card">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatarUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center border-2 border-border" style={{ background: "color-mix(in srgb, var(--color-accent) 12%, transparent)" }}>
                <span className="text-3xl font-bold text-gold">{displayName.charAt(0)}</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader size={16} className="text-white animate-spin" />
              ) : (
                <Camera size={16} className="text-white" />
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold">{displayName}</p>
            {form.username && (
              <p className="text-sm text-muted flex items-center gap-1">
                <AtSign size={12} />{form.username}
              </p>
            )}
            <p className="text-xs text-muted mt-0.5 capitalize">{profile?.role === "admin" ? "Founder" : (profile?.role?.replace("_", " ") || "Admin")} &middot; {form.email}</p>
          </div>
        </div>
      </div>

      {/* Username + Nickname */}
      <div className="card space-y-3">
        <h2 className="section-header flex items-center gap-2">
          <AtSign size={14} className="text-gold" /> Identity
        </h2>
        <p className="text-[10px] text-muted -mt-2 mb-2">Your username is unique and permanent. Your nickname is what others see.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Username *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">@</span>
              <input
                value={form.username}
                onChange={e => handleUsernameChange(e.target.value)}
                className="input w-full pl-7 pr-8"
                placeholder="your.username"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {checkingUsername ? (
                  <Loader size={12} className="text-muted animate-spin" />
                ) : usernameAvailable === true ? (
                  <Check size={12} className="text-success" />
                ) : usernameAvailable === false ? (
                  <X size={12} className="text-danger" />
                ) : null}
              </span>
            </div>
            <p className="text-[9px] text-muted mt-1">Lowercase, numbers, dots, dashes. Min 3 chars.</p>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Nickname</label>
            <input
              value={form.nickname}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
              className="input w-full"
              placeholder="Display name"
            />
            <p className="text-[9px] text-muted mt-1">Shown to others. Can be anything.</p>
          </div>
        </div>

        {usernameAvailable === false && (
          <div className="flex items-center gap-2 text-[10px] text-danger bg-danger/5 border border-danger/10 rounded-lg px-3 py-2">
            <AlertCircle size={12} /> This username is already taken. Try another one.
          </div>
        )}
      </div>

      {/* Personal Info */}
      <div className="card space-y-3">
        <h2 className="section-header">Personal Information</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Full Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Email</label>
            <input value={form.email} disabled className="input w-full opacity-50 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full" placeholder="+45 12345678" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold uppercase tracking-wider">Timezone</label>
            <select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} className="input w-full">
              <option value="Europe/Copenhagen">Europe/Copenhagen</option>
              <option value="America/New_York">America/New York</option>
              <option value="America/Los_Angeles">America/Los Angeles</option>
              <option value="America/Chicago">America/Chicago</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Berlin">Europe/Berlin</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </select>
          </div>
        </div>
        <button onClick={saveProfile} disabled={saving || usernameAvailable === false} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
          {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Change Password */}
      <div className="card space-y-3">
        <h2 className="section-header flex items-center gap-2"><Key size={14} className="text-gold" /> Change Password</h2>
        <div className="space-y-2">
          <input type="password" value={password.new} onChange={e => setPassword({ ...password, new: e.target.value })}
            className="input w-full" placeholder="New password (min 6 characters)" />
          <input type="password" value={password.confirm} onChange={e => setPassword({ ...password, confirm: e.target.value })}
            className="input w-full" placeholder="Confirm new password" />
        </div>
        <button onClick={changePassword} disabled={!password.new || !password.confirm}
          className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-50">
          <Key size={12} /> Change Password
        </button>
      </div>
    </div>
  );
}
