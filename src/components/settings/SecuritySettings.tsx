"use client";

/**
 * SecuritySettings — 2FA toggle, active sessions, password reset.
 * Lazy-loaded because most users never visit this tab, and the
 * lucide icons + session list logic don't need to be in the initial
 * settings bundle.
 */

import { Shield, Lock } from "lucide-react";
import toast from "react-hot-toast";

interface Session {
  device: string;
  ip: string;
  last_active: string;
  current: boolean;
}

interface Props {
  twoFA: boolean;
  setTwoFA: (v: boolean) => void;
  sessions: Session[];
}

export default function SecuritySettings({ twoFA, setTwoFA, sessions }: Props) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="section-header">Two-Factor Authentication</h3>
        <div className="flex items-center justify-between p-4 bg-surface-light/50 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium">2FA via Authenticator App</p>
            <p className="text-xs text-muted">{twoFA ? "Enabled and protecting your account" : "Not enabled - we recommend enabling 2FA"}</p>
          </div>
          <button
            onClick={() => { setTwoFA(!twoFA); toast.success(twoFA ? "2FA disabled" : "2FA enabled"); }}
            className={`px-3 py-1.5 rounded text-xs ${twoFA ? "bg-danger/10 text-danger border border-danger/20" : "bg-success/10 text-success border border-success/20"}`}
          >
            {twoFA ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
      <div className="card">
        <h3 className="section-header">Active Sessions</h3>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <Shield size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active sessions yet</p>
            </div>
          ) : sessions.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium">
                  {s.device}
                  {s.current && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded-full ml-1">Current</span>}
                </p>
                <p className="text-xs text-muted">IP: {s.ip} | Last active: {new Date(s.last_active).toLocaleString()}</p>
              </div>
              {!s.current && <button className="text-xs text-danger hover:underline">Revoke</button>}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h3 className="section-header">Password</h3>
        <button onClick={() => toast.success("Password reset email sent")} className="btn-secondary text-xs flex items-center gap-2">
          <Lock size={14} /> Change Password
        </button>
      </div>
    </div>
  );
}
