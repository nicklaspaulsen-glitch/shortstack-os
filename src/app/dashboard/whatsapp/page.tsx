"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import {
  MessageCircle, Plus, Send, Clock, CheckCircle2, XCircle, Loader2,
  Users, AlertCircle, Calendar, X, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";

const MAX_MSG_LEN = 1600;
const WARN_LEN = 160;

interface WhatsAppCampaign {
  id: string;
  name: string;
  message_template: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  recipient_count: number;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface Client {
  id: string;
  business_name: string;
  phone: string | null;
}

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "text-white/50", bg: "bg-white/5", icon: <Clock className="w-3.5 h-3.5" /> },
  scheduled: { label: "Scheduled", color: "text-amber-400", bg: "bg-amber-400/10", icon: <Calendar className="w-3.5 h-3.5" /> },
  sending: { label: "Sending", color: "text-blue-400", bg: "bg-blue-400/10", icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  sent: { label: "Sent", color: "text-emerald-400", bg: "bg-emerald-400/10", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-400/10", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function StatusBadge({ status }: { status: WhatsAppCampaign["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [sending, setSending] = useState(false);

  // Compose form state
  const [campaignName, setCampaignName] = useState("");
  const [message, setMessage] = useState("");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [{ data: camps }, { data: cls }] = await Promise.all([
      supabase
        .from("whatsapp_campaigns")
        .select("*")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("clients")
        .select("id, business_name, phone")
        .eq("profile_id", user.id)
        .eq("is_active", true),
    ]);
    setCampaigns((camps as WhatsAppCampaign[]) ?? []);
    setClients((cls as Client[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const resetCompose = () => {
    setCampaignName("");
    setMessage("");
    setSelectedClients([]);
    setScheduleAt("");
    setClientSearch("");
    setShowCompose(false);
  };

  const handleSend = async () => {
    if (!user) return;
    if (!campaignName.trim()) { toast.error("Campaign name required"); return; }
    if (!message.trim()) { toast.error("Message required"); return; }
    if (selectedClients.length === 0) { toast.error("Select at least one recipient"); return; }

    setSending(true);
    try {
      // Insert campaign record
      const { data: camp, error: campErr } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          profile_id: user.id,
          name: campaignName.trim(),
          message_template: message.trim(),
          status: scheduleAt ? "scheduled" : "sending",
          recipient_count: selectedClients.length,
          recipient_ids: selectedClients,
          scheduled_at: scheduleAt || null,
        })
        .select()
        .single();

      if (campErr) throw campErr;

      if (!scheduleAt) {
        // Fire the SMS endpoint for each selected client
        const res = await fetch("/api/twilio/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_ids: [],
            message_template: message.trim(),
            from_number: process.env.NEXT_PUBLIC_TWILIO_WHATSAPP_NUMBER,
            batch_size: selectedClients.length,
          }),
        });
        const json = await res.json();

        // Update campaign status
        await supabase
          .from("whatsapp_campaigns")
          .update({
            status: res.ok ? "sent" : "failed",
            sent_at: new Date().toISOString(),
          })
          .eq("id", camp.id);

        if (!res.ok) {
          toast.error(json.error || "Send failed");
        } else {
          toast.success(`Campaign sent to ${selectedClients.length} recipients`);
        }
      } else {
        toast.success("Campaign scheduled");
      }

      resetCompose();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSending(false);
    }
  };

  const filteredClients = clients.filter((c) =>
    c.business_name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <PageHero
        title="WhatsApp Campaigns"
        subtitle="Send templated WhatsApp messages to your clients — schedule or send now."
        icon={<MessageCircle className="w-6 h-6" />}
        gradient="green"
        actions={
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-[#25D366] hover:bg-[#20b858] text-white transition-all"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        }
      />

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                <p className="font-semibold text-white">New WhatsApp Campaign</p>
              </div>
              <button onClick={resetCompose} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
              {/* Campaign name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. April Promo Blast"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#25D366]/50 transition-all"
                />
              </div>

              {/* Recipients */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Recipients
                  {selectedClients.length > 0 && (
                    <span className="ml-2 text-[#25D366] normal-case font-normal">
                      {selectedClients.length} selected
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="Search clients…"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#25D366]/50 transition-all"
                />
                <div className="rounded-lg border border-white/8 bg-white/3 max-h-40 overflow-y-auto">
                  {filteredClients.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 text-sm text-white/30">
                      <Users className="w-4 h-4" />
                      {clients.length === 0 ? "No clients found" : "No matches"}
                    </div>
                  ) : (
                    filteredClients.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 cursor-pointer transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(c.id)}
                          onChange={() => toggleClient(c.id)}
                          className="w-4 h-4 rounded accent-[#25D366]"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{c.business_name}</p>
                          {c.phone && (
                            <p className="text-xs text-white/40">{c.phone}</p>
                          )}
                        </div>
                        {!c.phone && (
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded shrink-0">
                            No phone
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Message</label>
                  <span className={`text-xs ${message.length > WARN_LEN ? "text-amber-400" : "text-white/30"}`}>
                    {message.length}/{MAX_MSG_LEN}
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, MAX_MSG_LEN))}
                  placeholder="Hi {{name}}, here's your update from ShortStack…"
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#25D366]/50 transition-all resize-none"
                />
                {message.length > WARN_LEN && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Messages over {WARN_LEN} chars may be split into multiple segments
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Schedule (optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#25D366]/50 transition-all [color-scheme:dark]"
                  />
                </div>
                {!scheduleAt && (
                  <p className="text-[10px] text-white/30">Leave blank to send immediately</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/8">
              <button
                onClick={resetCompose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-[#25D366] hover:bg-[#20b858] text-white transition-all disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : scheduleAt ? (
                  <Calendar className="w-4 h-4" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? "Sending…" : scheduleAt ? "Schedule Campaign" : "Send Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Campaigns", value: campaigns.length },
          { label: "Sent", value: campaigns.filter((c) => c.status === "sent").length },
          { label: "Scheduled", value: campaigns.filter((c) => c.status === "scheduled").length },
          { label: "Recipients Reached", value: campaigns.filter((c) => c.status === "sent").reduce((a, c) => a + c.recipient_count, 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-4 text-center">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-white/40 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/60">Past Campaigns</p>
        {campaigns.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-white/8 flex flex-col items-center justify-center py-14 gap-3 text-center">
            <MessageCircle className="w-10 h-10 text-white/20" />
            <p className="text-white/40 text-sm">No campaigns yet</p>
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#25D366] hover:bg-[#20b858] text-white transition-all"
            >
              <Plus className="w-4 h-4" />
              Create your first campaign
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 p-4 flex items-center gap-4 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-white/40 mt-1 truncate line-clamp-1">
                    {c.message_template}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-white/50">
                    <Users className="w-3.5 h-3.5" />
                    {c.recipient_count} recipients
                  </div>
                  <p className="text-xs text-white/30">
                    {c.sent_at
                      ? `Sent ${new Date(c.sent_at).toLocaleDateString()}`
                      : c.scheduled_at
                      ? `Scheduled ${new Date(c.scheduled_at).toLocaleDateString()}`
                      : `Created ${new Date(c.created_at).toLocaleDateString()}`}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-white/20 shrink-0 -rotate-90" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
