"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Phone, Plus, Trash2, RefreshCw, Save, Play,
  PhoneCall, MessageSquare, Settings, CheckCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface ElevenAgent {
  agent_id: string;
  name: string;
  conversation_config?: Record<string, unknown>;
}

interface PhoneNumber {
  phone_number_id: string;
  phone_number: string;
  label: string;
}

interface Conversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time?: string;
  end_time?: string;
  call_duration_secs?: number;
}

export default function ElevenAgentsPage() {
  useAuth();
  const [agents, setAgents] = useState<ElevenAgent[]>([]);
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"agents" | "calls" | "setup">("agents");

  // Create agent form
  const [agentName, setAgentName] = useState("ShortStack Cold Caller");
  const [firstMessage, setFirstMessage] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [maxDuration, setMaxDuration] = useState(300);

  // Phone import form
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneLabel, setPhoneLabel] = useState("ShortStack Caller");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");

  // Config
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [maxCallsPerDay, setMaxCallsPerDay] = useState(10);
  const [enabled, setEnabled] = useState(false);

  // Call controls
  const [calling, setCalling] = useState(false);
  const [callResults, setCallResults] = useState<{ totalCalled: number; errors: number; leads: Array<{ business: string; phone: string; status: string; conversationId?: string }> } | null>(null);
  const [testNumber, setTestNumber] = useState("");
  const [testBusiness, setTestBusiness] = useState("Test Business");
  const [expandedConvo, setExpandedConvo] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Record<string, unknown> | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  useEffect(() => { fetchData(); loadDefaults(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [agentsRes, phonesRes, convoRes] = await Promise.all([
        fetch("/api/agents/eleven?type=agents"),
        fetch("/api/agents/eleven?type=phones"),
        fetch("/api/agents/eleven?type=conversations"),
      ]);
      const [agentsData, phonesData, convoData] = await Promise.all([
        agentsRes.json(), phonesRes.json(), convoRes.json(),
      ]);
      setAgents(agentsData.agents || []);
      setPhones(phonesData.phones || []);
      setConversations(convoData.conversations || []);
    } catch { toast.error("Failed to fetch data"); }
    setLoading(false);
  }

  async function loadDefaults() {
    try {
      const res = await fetch("/api/agents/eleven?type=defaults");
      const data = await res.json();
      setSystemPrompt(data.prompt || "");
      setFirstMessage(data.firstMessage || "");
    } catch {}
  }

  async function createNewAgent() {
    setCreating(true);
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_agent",
          name: agentName,
          firstMessage,
          systemPrompt,
          maxDuration,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Agent created: ${data.agentId}`);
        setSelectedAgent(data.agentId);
        fetchData();
      }
    } catch { toast.error("Failed to create agent"); }
    setCreating(false);
  }

  async function importPhone() {
    if (!phoneNumber || !twilioSid || !twilioToken) {
      toast.error("Fill in all Twilio fields");
      return;
    }
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "import_phone",
          phoneNumber,
          label: phoneLabel,
          twilioSid,
          twilioToken,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Phone number imported!");
        setSelectedPhone(data.phoneNumberId);
        fetchData();
      }
    } catch { toast.error("Failed to import phone"); }
  }

  async function saveConfig() {
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          agentId: selectedAgent,
          phoneNumberId: selectedPhone,
          maxCallsPerDay,
          enabled,
        }),
      });
      const data = await res.json();
      if (data.success) toast.success("Config saved!");
      else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
  }

  async function runCalls(count: number) {
    if (!selectedAgent || !selectedPhone) {
      toast.error("Select an agent and phone number first");
      return;
    }
    setCalling(true);
    setCallResults(null);
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run_calls", maxCalls: count }),
      });
      const data = await res.json();
      setCallResults(data);
      if (data.totalCalled > 0) {
        toast.success(`${data.totalCalled} calls made (${data.errors} errors)`);
        fetchData();
      } else {
        toast.error(data.leads?.[0]?.status || "No leads to call");
      }
    } catch { toast.error("Failed to run calls"); }
    setCalling(false);
  }

  async function testCall() {
    if (!selectedAgent || !selectedPhone || !testNumber) {
      toast.error("Need agent, phone number, and target number");
      return;
    }
    setCalling(true);
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_call",
          agentId: selectedAgent,
          phoneNumberId: selectedPhone,
          toNumber: testNumber,
          customData: { business_name: testBusiness, industry: "test", caller_name: "Alex from ShortStack" },
        }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else toast.success(`Call started! Conv: ${data.conversationId?.substring(0, 12)}...`);
    } catch { toast.error("Failed to make test call"); }
    setCalling(false);
  }

  async function fetchTranscript(conversationId: string) {
    if (expandedConvo === conversationId) {
      setExpandedConvo(null);
      setTranscript(null);
      return;
    }
    setExpandedConvo(conversationId);
    setLoadingTranscript(true);
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_transcript", conversationId }),
      });
      const data = await res.json();
      setTranscript(data.conversation || null);
    } catch { toast.error("Failed to load transcript"); }
    setLoadingTranscript(false);
  }

  async function deleteExistingAgent(agentId: string) {
    if (!confirm("Delete this agent?")) return;
    try {
      const res = await fetch("/api/agents/eleven", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_agent", agentId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Agent deleted");
        fetchData();
      }
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="fade-in space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <PhoneCall size={20} className="text-purple-400" />
            </div>
            ElevenAgents
          </h1>
          <p className="text-sm text-muted mt-0.5">AI voice agents for outbound cold calling</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-foreground transition-all">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-px">
        {(["agents", "calls", "setup"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-all ${
              tab === t ? "bg-surface-light text-foreground border-b-2 border-gold" : "text-muted hover:text-foreground"
            }`}>
            {t === "agents" ? "Agents" : t === "calls" ? "Call History" : "Setup & Config"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw size={20} className="animate-spin text-gold" />
        </div>
      ) : (
        <>
          {/* AGENTS TAB */}
          {tab === "agents" && (
            <div className="space-y-4">
              {/* Existing Agents */}
              {agents.length > 0 && (
                <div className="rounded-xl border border-border bg-white overflow-hidden">
                  <div className="px-5 py-3 border-b border-border">
                    <h2 className="text-sm font-semibold">Your Agents</h2>
                  </div>
                  {agents.map((agent) => (
                    <div key={agent.agent_id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-surface-light">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Phone size={14} className="text-purple-400" />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium">{agent.name}</p>
                          <p className="text-[9px] text-muted font-mono">{agent.agent_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedAgent(agent.agent_id)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                            selectedAgent === agent.agent_id
                              ? "bg-gold/10 text-gold border-gold/20" : "border-border text-muted hover:text-foreground"
                          }`}>
                          {selectedAgent === agent.agent_id ? <><CheckCircle size={10} className="inline mr-1" />Selected</> : "Select"}
                        </button>
                        <button onClick={() => deleteExistingAgent(agent.agent_id)}
                          className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Run Calls Now */}
              {agents.length > 0 && selectedAgent && selectedPhone && (
                <div className="rounded-xl border border-gold/20 bg-gold/5 p-5">
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <PhoneCall size={15} className="text-gold" /> Run Calls Now
                  </h2>
                  <p className="text-[11px] text-muted mb-3">AI will call high-score leads from your CRM using the selected agent and phone number.</p>
                  <div className="flex items-center gap-2">
                    {[3, 5, 10].map(n => (
                      <button key={n} onClick={() => runCalls(n)} disabled={calling}
                        className="px-4 py-2 bg-gold text-white text-xs font-medium rounded-lg hover:bg-gold-dark transition-all disabled:opacity-30 flex items-center gap-1.5">
                        {calling ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                        Call {n} Leads
                      </button>
                    ))}
                  </div>
                  {callResults && (
                    <div className="mt-3 p-3 rounded-lg bg-white border border-border text-[11px] space-y-1">
                      <p className="font-medium">{callResults.totalCalled} calls made, {callResults.errors} errors</p>
                      {callResults.leads.map((l, i) => (
                        <div key={i} className="flex items-center gap-2 text-muted">
                          <span className={`w-1.5 h-1.5 rounded-full ${l.status === "calling" ? "bg-emerald-400" : "bg-red-400"}`} />
                          <span>{l.business}</span>
                          <span className="font-mono text-[9px]">{l.phone}</span>
                          <span className="text-[9px]">{l.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create New Agent */}
              <div className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Plus size={15} /> Create New Agent
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Agent Name</label>
                    <input type="text" value={agentName} onChange={(e) => setAgentName(e.target.value)}
                      className="input w-full text-xs py-2" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">First Message (what the AI says when they pick up)</label>
                    <input type="text" value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)}
                      className="input w-full text-xs py-2" placeholder="Hi! This is Alex from ShortStack..." />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">System Prompt (AI personality & script)</label>
                    <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
                      className="input w-full text-xs py-2 h-40 resize-y" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Max Call Duration (seconds)</label>
                    <input type="number" value={maxDuration} onChange={(e) => setMaxDuration(Number(e.target.value))}
                      className="input w-32 text-xs py-2" min={60} max={600} />
                  </div>
                  <button onClick={createNewAgent} disabled={creating || !agentName}
                    className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all disabled:opacity-30">
                    {creating ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    {creating ? "Creating..." : "Create Agent"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CALLS TAB */}
          {tab === "calls" && (
            <div className="rounded-xl border border-border bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent Conversations</h2>
                <span className="text-[10px] text-muted">{conversations.length} total</span>
              </div>
              {conversations.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-xs text-muted">No calls made yet</p>
                  <p className="text-[10px] text-muted mt-1">Create an agent and import a phone number to start calling</p>
                </div>
              ) : (
                <div className="divide-y divide-border/5">
                  {conversations.slice(0, 20).map((convo) => (
                    <div key={convo.conversation_id}>
                      <div className="px-5 py-3 hover:bg-surface-light transition-colors cursor-pointer" onClick={() => fetchTranscript(convo.conversation_id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              convo.status === "done" ? "bg-emerald-400" :
                              convo.status === "active" ? "bg-blue-400 animate-pulse" : "bg-amber-400"
                            }`} />
                            <div>
                              <p className="text-[11px] font-mono">{convo.conversation_id.substring(0, 16)}...</p>
                              <p className="text-[9px] text-muted">
                                {convo.call_duration_secs ? `${convo.call_duration_secs}s` : convo.status}
                                {convo.start_time && ` — ${new Date(convo.start_time).toLocaleString()}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              convo.status === "done" ? "bg-emerald-500/10 text-emerald-600" :
                              convo.status === "active" ? "bg-blue-500/10 text-blue-600" : "bg-amber-500/10 text-amber-600"
                            }`}>{convo.status}</span>
                            <span className="text-[9px] text-muted">{expandedConvo === convo.conversation_id ? "▲" : "▼"}</span>
                          </div>
                        </div>
                      </div>
                      {expandedConvo === convo.conversation_id && (
                        <div className="px-5 pb-3">
                          {loadingTranscript ? (
                            <div className="flex items-center gap-2 py-3 text-[11px] text-muted">
                              <RefreshCw size={12} className="animate-spin" /> Loading transcript...
                            </div>
                          ) : transcript ? (
                            <div className="rounded-lg border border-border bg-surface-light p-3 space-y-2 text-[11px]">
                              {(transcript as Record<string, unknown>).analysis ? (
                                <div className="pb-2 border-b border-border">
                                  <p className="font-medium text-foreground mb-1">Analysis</p>
                                  <p className="text-muted">{JSON.stringify((transcript as Record<string, unknown>).analysis)}</p>
                                </div>
                              ) : null}
                              {Array.isArray((transcript as Record<string, unknown>).transcript) ? (
                                ((transcript as Record<string, unknown>).transcript as Array<{ role: string; message: string }>).map((turn, i) => (
                                  <div key={i} className={`flex gap-2 ${turn.role === "agent" ? "" : "justify-end"}`}>
                                    <div className={`max-w-[80%] px-3 py-1.5 rounded-lg ${
                                      turn.role === "agent" ? "bg-white border border-border" : "bg-gold/10 text-foreground"
                                    }`}>
                                      <p className="text-[9px] text-muted mb-0.5 font-medium">{turn.role === "agent" ? "AI Agent" : "Lead"}</p>
                                      <p>{turn.message}</p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-muted">No transcript available yet</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted py-2">Failed to load transcript</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SETUP TAB */}
          {tab === "setup" && (
            <div className="space-y-4">
              {/* Phone Numbers */}
              <div className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Phone size={15} /> Phone Numbers (Twilio)
                </h2>

                {phones.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {phones.map((ph) => (
                      <div key={ph.phone_number_id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface-light border border-border">
                        <div>
                          <p className="text-[11px] font-medium">{ph.phone_number}</p>
                          <p className="text-[9px] text-muted">{ph.label}</p>
                        </div>
                        <button onClick={() => setSelectedPhone(ph.phone_number_id)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                            selectedPhone === ph.phone_number_id
                              ? "bg-gold/10 text-gold border-gold/20" : "border-border text-muted hover:text-foreground"
                          }`}>
                          {selectedPhone === ph.phone_number_id ? "Selected" : "Select"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-muted">Import a Twilio phone number for outbound calling</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Phone Number (+1...)</label>
                      <input type="text" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
                        className="input w-full text-xs py-2" placeholder="+1234567890" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Label</label>
                      <input type="text" value={phoneLabel} onChange={(e) => setPhoneLabel(e.target.value)}
                        className="input w-full text-xs py-2" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Twilio Account SID</label>
                      <input type="text" value={twilioSid} onChange={(e) => setTwilioSid(e.target.value)}
                        className="input w-full text-xs py-2" placeholder="AC..." />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Twilio Auth Token</label>
                      <input type="password" value={twilioToken} onChange={(e) => setTwilioToken(e.target.value)}
                        className="input w-full text-xs py-2" />
                    </div>
                  </div>
                  <button onClick={importPhone}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all">
                    <Plus size={12} /> Import Phone Number
                  </button>
                </div>
              </div>

              {/* Outbound Config */}
              <div className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Settings size={15} /> Outbound Calling Config
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Active Agent ID</label>
                    <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}
                      className="input w-full text-xs py-2">
                      <option value="">Select an agent</option>
                      {agents.map((a) => (
                        <option key={a.agent_id} value={a.agent_id}>{a.name} ({a.agent_id.substring(0, 8)}...)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Active Phone Number</label>
                    <select value={selectedPhone} onChange={(e) => setSelectedPhone(e.target.value)}
                      className="input w-full text-xs py-2">
                      <option value="">Select a phone number</option>
                      {phones.map((p) => (
                        <option key={p.phone_number_id} value={p.phone_number_id}>{p.phone_number} ({p.label})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max Calls Per Day</label>
                    <input type="number" value={maxCallsPerDay} onChange={(e) => setMaxCallsPerDay(Number(e.target.value))}
                      className="input w-32 text-xs py-2" min={1} max={100} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEnabled(!enabled)}
                      className={`relative w-10 h-5 rounded-full transition-all ${enabled ? "bg-gold" : "bg-surface-light"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${enabled ? "left-5.5" : "left-0.5"}`}
                        style={{ left: enabled ? "22px" : "2px" }} />
                    </button>
                    <span className="text-xs">{enabled ? "Enabled — calls will be made during outreach cron" : "Disabled"}</span>
                  </div>
                  <button onClick={saveConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-gold text-xs font-medium rounded-lg border border-gold/20 hover:bg-gold/20 transition-all">
                    <Save size={12} /> Save Configuration
                  </button>
                </div>
              </div>

              {/* Test Call */}
              <div className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Play size={15} className="text-gold" /> Test Call
                </h2>
                <p className="text-[10px] text-muted mb-3">Make a single test call to verify your agent works. Call yourself or a team member.</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Phone Number to Call</label>
                    <input type="text" value={testNumber} onChange={(e) => setTestNumber(e.target.value)}
                      className="input w-full text-xs py-2" placeholder="+1234567890" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Business Name (for script)</label>
                    <input type="text" value={testBusiness} onChange={(e) => setTestBusiness(e.target.value)}
                      className="input w-full text-xs py-2" />
                  </div>
                </div>
                <button onClick={testCall} disabled={calling || !selectedAgent || !selectedPhone || !testNumber}
                  className="flex items-center gap-2 px-4 py-2 bg-gold text-white text-xs font-medium rounded-lg hover:bg-gold-dark transition-all disabled:opacity-30">
                  {calling ? <RefreshCw size={12} className="animate-spin" /> : <PhoneCall size={12} />}
                  {calling ? "Calling..." : "Make Test Call"}
                </button>
                {(!selectedAgent || !selectedPhone) && (
                  <p className="text-[9px] text-amber-600 mt-2">Select an agent and phone number above first</p>
                )}
              </div>

              {/* How it works */}
              <div className="rounded-xl border border-border bg-white p-5">
                <h2 className="text-sm font-semibold mb-3">How It Works</h2>
                <div className="space-y-2">
                  {[
                    "Create an AI agent with a custom cold-calling script",
                    "Import your Twilio phone number for outbound calls",
                    "Configure max calls per day and enable the system",
                    "The outreach cron automatically calls high-score leads",
                    "AI handles the conversation, books meetings, logs outcomes",
                    "Transcripts and results appear in outreach logs + Telegram",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[11px]">
                      <span className="text-gold font-bold shrink-0 w-5">{i + 1}.</span>
                      <span className="text-muted">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
