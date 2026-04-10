"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  User, Save, Loader, Camera, Key
} from "lucide-react";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    timezone: "Europe/Copenhagen",
    country: "Denmark",
  });
  const [password, setPassword] = useState({ current: "", new: "", confirm: "" });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        timezone: profile.timezone || "Europe/Copenhagen",
        country: profile.country || "Denmark",
      });
    }
  }, [profile]);

  async function saveProfile() {
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name,
        phone: form.phone,
        timezone: form.timezone,
        country: form.country,
      }).eq("id", profile?.id);

      if (error) toast.error(error.message);
      else toast.success("Profile updated!");
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
        setPassword({ current: "", new: "", confirm: "" });
      }
    } catch { toast.error("Failed to change password"); }
  }

  return (
    <div className="fade-in space-y-5 max-w-2xl">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <User size={18} className="text-gold" /> Profile
        </h1>
        <p className="text-xs text-muted mt-0.5">Manage your account settings</p>
      </div>

      {/* Avatar + Name */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(200,168,85,0.1)" }}>
              <span className="text-2xl font-bold text-gold">{form.full_name.charAt(0) || "?"}</span>
            </div>
            <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Camera size={10} className="text-muted" />
            </button>
          </div>
          <div>
            <p className="text-sm font-bold">{form.full_name || "Your Name"}</p>
            <p className="text-[10px] text-muted capitalize">{profile?.role?.replace("_", " ") || "Admin"}</p>
            <p className="text-[10px] text-muted">{form.email}</p>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div className="card space-y-3">
        <h2 className="section-header">Personal Information</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold">Full Name</label>
            <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="input w-full" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold">Email</label>
            <input value={form.email} disabled className="input w-full opacity-50" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold">Phone</label>
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input w-full" placeholder="+45 12345678" />
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 font-semibold">Timezone</label>
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
        <button onClick={saveProfile} disabled={saving} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
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
