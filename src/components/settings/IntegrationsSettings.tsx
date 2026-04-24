"use client";

/**
 * IntegrationsSettings — connected social accounts (via Zernio) and
 * service integration health matrix. Lazy-loaded because it fetches
 * social account data and renders the full integration grid.
 */

import { Globe, Loader2, XCircle } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import InlineSocialConnect from "@/components/inline-social-connect";

const INTEGRATIONS = [
  { name: "Supabase", key: "NEXT_PUBLIC_SUPABASE_URL", category: "Core" },
  { name: "Claude AI (Anthropic)", key: "ANTHROPIC_API_KEY", category: "AI" },
  { name: "Telegram", key: "TELEGRAM_BOT_TOKEN", category: "Communication" },
  { name: "Slack", key: "SLACK_BOT_TOKEN", category: "Communication" },
  { name: "Stripe", key: "STRIPE_SECRET_KEY", category: "Payments" },
  { name: "Google Cloud", key: "GOOGLE_PLACES_API_KEY", category: "APIs" },
  { name: "Meta/Facebook", key: "META_APP_ID", category: "Social" },
  { name: "TikTok", key: "TIKTOK_CLIENT_KEY", category: "Social" },
  { name: "GoDaddy", key: "GODADDY_API_KEY", category: "Domains" },
  { name: "Retell AI", key: "RETELL_API_KEY", category: "Voice AI" },
  { name: "Make.com", key: "MAKE_API_KEY", category: "Automation" },
  { name: "Zernio", key: "ZERNIO_API_KEY", category: "Publishing" },
];

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string | null;
  is_active: boolean;
  created_at: string;
  token_expires_at: string | null;
  status: "active" | "expired" | "revoked";
  metadata: Record<string, unknown> | null;
}

interface Props {
  socialAccounts: SocialAccount[];
  socialLoading: boolean;
  disconnectingSocial: string | null;
  healthData: Array<{ integration_name: string; status: string }>;
  disconnectSocialAccount: (account: { id: string; account_id: string | null; platform: string }) => Promise<void>;
}

export default function IntegrationsSettings({ socialAccounts, socialLoading, disconnectingSocial, healthData, disconnectSocialAccount }: Props) {
  return (
    <div className="space-y-4">
      {/* Connected Social Accounts via Zernio */}
      <div>
        <h3 className="text-xs text-muted uppercase tracking-wider mb-2">Connected Social Accounts</h3>
        {socialLoading ? (
          <div className="card p-6 text-center">
            <Loader2 size={16} className="animate-spin mx-auto text-muted" />
          </div>
        ) : socialAccounts.filter(a => a.is_active).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {socialAccounts.filter(a => a.is_active).map(account => (
              <div key={account.id} className="card-hover p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2 h-2 rounded-full ${
                      account.status === "active" ? "bg-emerald-400" :
                      account.status === "expired" ? "bg-red-400" : "bg-zinc-500"
                    }`} />
                    <div>
                      <p className="font-medium text-sm capitalize flex items-center gap-1.5">
                        {account.platform}
                        {account.status === "expired" && (
                          <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full font-normal">expired</span>
                        )}
                      </p>
                      <p className="text-xs text-muted">{account.account_name || "Connected"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={account.status === "active" ? "active" : account.status === "expired" ? "error" : "inactive"} />
                    <button
                      onClick={() => disconnectSocialAccount(account)}
                      disabled={disconnectingSocial === account.id}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10 disabled:opacity-50"
                      title="Disconnect account">
                      {disconnectingSocial === account.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <XCircle size={14} />
                      )}
                    </button>
                  </div>
                </div>
                {account.token_expires_at && (
                  <p className="text-[10px] text-muted mt-2">
                    Token expires: {new Date(account.token_expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6">
            <Globe size={20} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted mb-3 text-center">No social accounts connected</p>
            <InlineSocialConnect
              platforms={["instagram", "facebook", "linkedin", "tiktok"]}
            />
          </div>
        )}
      </div>

      {/* Service Integrations */}
      {["Core", "AI", "CRM", "Communication", "Payments", "Social", "APIs", "Domains", "Voice AI", "Automation", "Publishing"].map(category => {
        const items = INTEGRATIONS.filter(i => i.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="text-xs text-muted uppercase tracking-wider mb-2">{category}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(integration => {
                const health = healthData.find(h => h.integration_name === integration.name);
                return (
                  <div key={integration.name} className="card-hover p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{integration.name}</p>
                      <p className="text-xs text-muted">{integration.key}</p>
                    </div>
                    <StatusBadge status={health?.status || "unknown"} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
