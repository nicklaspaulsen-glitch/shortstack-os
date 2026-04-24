"use client";

/**
 * AgentSettings — per-client AI agent configuration grid + global AI
 * settings. Lazy-loaded because the agent grid is only needed by admins
 * who configure outreach and the component imports StatusBadge + modal JSX.
 */

import { Bot, Save } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import Modal from "@/components/ui/modal";

interface AgentConfig {
  id: string;
  client_id: string;
  client_name: string;
  outreach_enabled: boolean;
  cold_calling_enabled: boolean;
  content_generation_enabled: boolean;
  auto_publish_enabled: boolean;
  blog_generation_enabled: boolean;
  ai_model: string;
  outreach_platforms: string[];
  daily_dm_limit: number;
  daily_call_limit: number;
  brand_voice: string;
  target_industries: string[];
  custom_instructions: string;
}

interface Props {
  agentConfigs: AgentConfig[];
  editingAgent: AgentConfig | null;
  setEditingAgent: (a: AgentConfig | null) => void;
  saveAgentConfig: (a: AgentConfig) => void;
}

export default function AgentSettings({ agentConfigs, editingAgent, setEditingAgent, saveAgentConfig }: Props) {
  return (
    <div className="space-y-4">
      <div className="card bg-gold/5 border-gold/20">
        <p className="text-sm">Configure AI agents for each client. Control what the AI does automatically — outreach, cold calling, content, publishing.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agentConfigs.map(config => (
          <div key={config.client_id} className="card-hover">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">{config.client_name}</h3>
              <button onClick={() => setEditingAgent(config)} className="text-gold text-xs hover:text-gold-light">Configure</button>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">DM Outreach</span>
                <StatusBadge status={config.outreach_enabled ? "active" : "paused"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cold Calling</span>
                <StatusBadge status={config.cold_calling_enabled ? "active" : "paused"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Content Gen</span>
                <StatusBadge status={config.content_generation_enabled ? "active" : "paused"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Auto Publish</span>
                <StatusBadge status={config.auto_publish_enabled ? "active" : "paused"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted">AI Model</span>
                <span className="text-gold">{config.ai_model.split("-").slice(-2).join(" ")}</span>
              </div>
            </div>
          </div>
        ))}
        {agentConfigs.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted">
            No clients yet. Add clients first, then configure their AI agents.
          </div>
        )}
      </div>

      {/* Global AI Settings */}
      <div className="card mt-6">
        <h3 className="section-header">Global AI Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Default AI Model</label>
            <select className="input w-full text-sm">
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Best)</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fast)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Daily DM Target</label>
            <input type="number" defaultValue={80} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Daily Call Target</label>
            <input type="number" defaultValue={50} className="input w-full text-sm" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Outreach Time (CET)</label>
            <input type="time" defaultValue="09:00" className="input w-full text-sm" />
          </div>
        </div>
      </div>

      {/* Edit Agent Modal */}
      <Modal isOpen={!!editingAgent} onClose={() => setEditingAgent(null)} title={`Configure AI Agent — ${editingAgent?.client_name}`} size="xl">
        {editingAgent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">AI Model</label>
                <select value={editingAgent.ai_model} onChange={e => setEditingAgent({ ...editingAgent, ai_model: e.target.value })} className="input w-full">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Best quality)</option>
                  <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fastest)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Brand Voice</label>
                <input value={editingAgent.brand_voice} onChange={e => setEditingAgent({ ...editingAgent, brand_voice: e.target.value })} className="input w-full" placeholder="e.g., professional, casual, energetic" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.outreach_enabled} onChange={e => setEditingAgent({ ...editingAgent, outreach_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">DM Outreach</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.cold_calling_enabled} onChange={e => setEditingAgent({ ...editingAgent, cold_calling_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Cold Calling</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.content_generation_enabled} onChange={e => setEditingAgent({ ...editingAgent, content_generation_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Content Gen</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingAgent.auto_publish_enabled} onChange={e => setEditingAgent({ ...editingAgent, auto_publish_enabled: e.target.checked })} className="accent-gold" />
                <span className="text-sm">Auto Publish</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Daily DM Limit</label>
                <input type="number" value={editingAgent.daily_dm_limit} onChange={e => setEditingAgent({ ...editingAgent, daily_dm_limit: parseInt(e.target.value) })} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Daily Call Limit</label>
                <input type="number" value={editingAgent.daily_call_limit} onChange={e => setEditingAgent({ ...editingAgent, daily_call_limit: parseInt(e.target.value) })} className="input w-full" />
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Outreach Platforms</label>
              <div className="flex gap-3">
                {["instagram", "linkedin", "facebook", "tiktok"].map(p => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={editingAgent.outreach_platforms.includes(p)} onChange={e => {
                      const platforms = e.target.checked
                        ? [...editingAgent.outreach_platforms, p]
                        : editingAgent.outreach_platforms.filter(x => x !== p);
                      setEditingAgent({ ...editingAgent, outreach_platforms: platforms });
                    }} className="accent-gold" />
                    <span className="text-sm capitalize">{p}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Custom Instructions for AI</label>
              <textarea value={editingAgent.custom_instructions} onChange={e => setEditingAgent({ ...editingAgent, custom_instructions: e.target.value })} className="input w-full h-24" placeholder="e.g., Always mention their Google reviews when reaching out." />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <button onClick={() => setEditingAgent(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => saveAgentConfig(editingAgent)} className="btn-primary flex items-center gap-2">
                <Save size={16} /> Save Configuration
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
