"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Bot, Send, Settings, MessageSquare, BarChart3, Radio,
  Users, Copy, Check, Eye, EyeOff, Wifi, WifiOff,
  Plus, Trash2, GripVertical, ToggleLeft, ToggleRight,
  ChevronDown, ChevronRight, Clock, ThumbsUp, ThumbsDown,
  Globe, Sparkles, Shield, Zap, QrCode, Terminal,
  Loader, RefreshCw,
  MessageCircle, Search,
  Edit3, Save, X, AlertCircle, Link,
  Activity
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tab = "setup" | "personality" | "commands" | "conversations" | "analytics" | "broadcast" | "client-access";

interface BotCommand {
  id: string;
  command: string;
  description: string;
  responseType: "text" | "ai-generated" | "action";
  content: string;
  enabled: boolean;
  isDefault: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  userName: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

interface Broadcast {
  id: string;
  message: string;
  sentAt: string;
  recipients: number;
  openRate: number;
  status: "sent" | "scheduled" | "draft";
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const DEFAULT_COMMANDS: BotCommand[] = [
  { id: "cmd-1", command: "/start", description: "Welcome message", responseType: "text", content: "Welcome! I'm your ShortStack assistant. How can I help you today?", enabled: true, isDefault: true },
  { id: "cmd-2", command: "/status", description: "Check project status", responseType: "ai-generated", content: "Fetch current project status and summarize progress", enabled: true, isDefault: true },
  { id: "cmd-3", command: "/report", description: "Request latest report", responseType: "action", content: "generate_report", enabled: true, isDefault: true },
  { id: "cmd-4", command: "/book", description: "Book a meeting", responseType: "text", content: "Sure! Here are my available slots this week:\n\nMon 10am-12pm\nTue 2pm-4pm\nWed 10am-1pm\nThu 3pm-5pm\n\nReply with your preferred time.", enabled: true, isDefault: true },
  { id: "cmd-5", command: "/support", description: "Open support ticket", responseType: "action", content: "create_ticket", enabled: true, isDefault: true },
  { id: "cmd-6", command: "/leads", description: "View lead count (admin only)", responseType: "ai-generated", content: "Fetch lead statistics from CRM and format summary", enabled: true, isDefault: true },
  { id: "cmd-7", command: "/help", description: "List available commands", responseType: "text", content: "Here are the commands I support:\n\n/start - Welcome message\n/status - Check project status\n/report - Request latest report\n/book - Book a meeting\n/support - Open support ticket\n/leads - View lead count\n/help - Show this message", enabled: true, isDefault: true },
];

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1", userId: "u1", userName: "Sarah Mitchell", avatar: "SM",
    lastMessage: "Thanks for the update!", timestamp: "2 min ago", unreadCount: 0,
    messages: [
      { id: "m1", sender: "user", text: "/start", timestamp: "10:22 AM" },
      { id: "m2", sender: "bot", text: "Welcome, Sarah! I'm your ShortStack assistant. How can I help you today?", timestamp: "10:22 AM" },
      { id: "m3", sender: "user", text: "What's the status on my campaign?", timestamp: "10:23 AM" },
      { id: "m4", sender: "bot", text: "Your Instagram campaign 'Spring Launch' is performing well:\n\n- Reach: 12,400 (up 23%)\n- Engagement rate: 4.8%\n- Leads generated: 34\n- Budget spent: $180 of $500\n\nWould you like me to generate a detailed report?", timestamp: "10:23 AM" },
      { id: "m5", sender: "user", text: "Thanks for the update!", timestamp: "10:24 AM" },
    ],
  },
  {
    id: "conv-2", userId: "u2", userName: "Marcus Johnson", avatar: "MJ",
    lastMessage: "Can I reschedule to Thursday?", timestamp: "15 min ago", unreadCount: 2,
    messages: [
      { id: "m1", sender: "user", text: "/book", timestamp: "9:50 AM" },
      { id: "m2", sender: "bot", text: "Sure! Here are my available slots this week:\n\nMon 10am-12pm\nTue 2pm-4pm\nWed 10am-1pm\nThu 3pm-5pm\n\nReply with your preferred time.", timestamp: "9:50 AM" },
      { id: "m3", sender: "user", text: "Tuesday 2pm works", timestamp: "9:51 AM" },
      { id: "m4", sender: "bot", text: "Done! You're booked for Tuesday at 2:00 PM. I've sent a calendar invite to your email. See you then!", timestamp: "9:51 AM" },
      { id: "m5", sender: "user", text: "Actually wait", timestamp: "10:05 AM" },
      { id: "m6", sender: "user", text: "Can I reschedule to Thursday?", timestamp: "10:05 AM" },
    ],
  },
  {
    id: "conv-3", userId: "u3", userName: "Elena Rodriguez", avatar: "ER",
    lastMessage: "Perfect, I'll review the mockups tonight", timestamp: "1 hr ago", unreadCount: 0,
    messages: [
      { id: "m1", sender: "user", text: "Hey, any update on the website redesign?", timestamp: "9:10 AM" },
      { id: "m2", sender: "bot", text: "Hi Elena! The website redesign is progressing nicely:\n\n- Homepage mockup: Complete\n- About page: In review\n- Service pages: 3 of 5 done\n- Mobile responsive: In progress\n\nYour designer uploaded new mockups yesterday. Want me to send them?", timestamp: "9:10 AM" },
      { id: "m3", sender: "user", text: "Yes please!", timestamp: "9:12 AM" },
      { id: "m4", sender: "bot", text: "Sent! Check your email for the mockup files. The team recommends reviewing the color palette on the service pages.", timestamp: "9:12 AM" },
      { id: "m5", sender: "user", text: "Perfect, I'll review the mockups tonight", timestamp: "9:15 AM" },
    ],
  },
  {
    id: "conv-4", userId: "u4", userName: "James Park", avatar: "JP",
    lastMessage: "How many leads this month?", timestamp: "2 hr ago", unreadCount: 1,
    messages: [
      { id: "m1", sender: "user", text: "/leads", timestamp: "8:30 AM" },
      { id: "m2", sender: "bot", text: "Here's your lead summary for April:\n\nTotal leads: 147\nNew this week: 23\nContacted: 89\nBooked calls: 18\nConverted: 12\n\nConversion rate: 8.2% (up from 6.5% last month)", timestamp: "8:30 AM" },
      { id: "m3", sender: "user", text: "How many leads this month?", timestamp: "8:32 AM" },
    ],
  },
  {
    id: "conv-5", userId: "u5", userName: "Aisha Khan", avatar: "AK",
    lastMessage: "Can you create a support ticket for the billing issue?", timestamp: "3 hr ago", unreadCount: 1,
    messages: [
      { id: "m1", sender: "user", text: "/support", timestamp: "7:45 AM" },
      { id: "m2", sender: "bot", text: "I'm here to help! Please describe your issue and I'll create a support ticket for you.", timestamp: "7:45 AM" },
      { id: "m3", sender: "user", text: "Can you create a support ticket for the billing issue?", timestamp: "7:47 AM" },
    ],
  },
  {
    id: "conv-6", userId: "u6", userName: "David Chen", avatar: "DC",
    lastMessage: "Looks great, approve it", timestamp: "5 hr ago", unreadCount: 0,
    messages: [
      { id: "m1", sender: "user", text: "/report", timestamp: "5:15 AM" },
      { id: "m2", sender: "bot", text: "Generating your weekly performance report... This will take a moment.", timestamp: "5:15 AM" },
      { id: "m3", sender: "bot", text: "Your Weekly Report is ready:\n\nSocial Media:\n- Total reach: 45,200\n- Engagement: 2,890 interactions\n- Best post: Instagram carousel (+340%)\n\nAds:\n- Spend: $1,240\n- ROAS: 3.8x\n- Leads: 67\n\nWant me to email the full PDF?", timestamp: "5:16 AM" },
      { id: "m4", sender: "user", text: "Looks great, approve it", timestamp: "5:20 AM" },
    ],
  },
  {
    id: "conv-7", userId: "u7", userName: "Lisa Thompson", avatar: "LT",
    lastMessage: "What hashtags should I use for my bakery posts?", timestamp: "8 hr ago", unreadCount: 0,
    messages: [
      { id: "m1", sender: "user", text: "What hashtags should I use for my bakery posts?", timestamp: "Yesterday" },
      { id: "m2", sender: "bot", text: "Great question! Here are targeted hashtags for your bakery:\n\nHigh reach:\n#bakery #freshbaked #homemade #bakerylove #pastry\n\nNiche:\n#artisanbread #sourdoughlife #cakesofinstagram #bakerylife #handcraftedbakes\n\nLocal:\n#austinbakery #atxfood #austineats #localbakery\n\nI recommend using 15-20 per post, mixing all three categories.", timestamp: "Yesterday" },
    ],
  },
  {
    id: "conv-8", userId: "u8", userName: "Ryan Foster", avatar: "RF",
    lastMessage: "Send me the analytics for last week", timestamp: "1 day ago", unreadCount: 0,
    messages: [
      { id: "m1", sender: "user", text: "/start", timestamp: "2 days ago" },
      { id: "m2", sender: "bot", text: "Hey Ryan! Welcome back. Your project dashboard has 3 new updates since your last visit. Would you like a summary?", timestamp: "2 days ago" },
      { id: "m3", sender: "user", text: "Yes", timestamp: "2 days ago" },
      { id: "m4", sender: "bot", text: "Here's what's new:\n\n1. Your Google Ads campaign hit 500 clicks\n2. New blog post published: 'Top 10 Marketing Tips'\n3. Social media scheduler has 8 posts queued for this week\n\nEverything is running smoothly!", timestamp: "2 days ago" },
      { id: "m5", sender: "user", text: "Send me the analytics for last week", timestamp: "1 day ago" },
    ],
  },
];

const MOCK_BROADCASTS: Broadcast[] = [
  { id: "bc-1", message: "New feature alert: We've launched automated reporting. Check your dashboard!", sentAt: "Apr 14, 2026", recipients: 342, openRate: 78, status: "sent" },
  { id: "bc-2", message: "Reminder: Monthly strategy call this Friday at 2 PM. Reply /book to confirm.", sentAt: "Apr 10, 2026", recipients: 342, openRate: 65, status: "sent" },
  { id: "bc-3", message: "Happy Easter! Enjoy 20% off our premium plan this week only.", sentAt: "Apr 5, 2026", recipients: 298, openRate: 82, status: "sent" },
  { id: "bc-4", message: "Your Q1 results are in. Use /report to see the full breakdown.", sentAt: "Apr 1, 2026", recipients: 312, openRate: 71, status: "sent" },
];

const ANALYTICS_DAILY = [
  { day: "Mon", count: 124 },
  { day: "Tue", count: 198 },
  { day: "Wed", count: 156 },
  { day: "Thu", count: 245 },
  { day: "Fri", count: 189 },
  { day: "Sat", count: 87 },
  { day: "Sun", count: 62 },
];

const TOP_COMMANDS = [
  { command: "/start", count: 342, pct: 100 },
  { command: "/status", count: 218, pct: 64 },
  { command: "/report", count: 156, pct: 46 },
  { command: "/book", count: 134, pct: 39 },
  { command: "/help", count: 98, pct: 29 },
  { command: "/support", count: 67, pct: 20 },
  { command: "/leads", count: 45, pct: 13 },
];

const PEAK_HOURS = [
  { hour: "6am", pct: 8 }, { hour: "7am", pct: 15 }, { hour: "8am", pct: 35 },
  { hour: "9am", pct: 65 }, { hour: "10am", pct: 82 }, { hour: "11am", pct: 70 },
  { hour: "12pm", pct: 55 }, { hour: "1pm", pct: 48 }, { hour: "2pm", pct: 72 },
  { hour: "3pm", pct: 88 }, { hour: "4pm", pct: 95 }, { hour: "5pm", pct: 78 },
  { hour: "6pm", pct: 45 }, { hour: "7pm", pct: 30 }, { hour: "8pm", pct: 18 },
];

const PERSONALITY_PRESETS: Record<string, { label: string; prompt: string; welcome: string }> = {
  professional: {
    label: "Professional",
    prompt: "You are a professional business assistant. Respond concisely, use formal language, and focus on delivering accurate information. Maintain a courteous but efficient tone.",
    welcome: "Welcome. I'm here to assist you with your business needs. How may I help you today?",
  },
  friendly: {
    label: "Friendly",
    prompt: "You are a friendly and approachable assistant. Use a warm, conversational tone. Include light humor when appropriate. Make users feel comfortable asking questions.",
    welcome: "Hey there! Great to see you. I'm here to help with anything you need. What's on your mind?",
  },
  sales: {
    label: "Sales-Focused",
    prompt: "You are a persuasive sales assistant. Highlight benefits, create urgency, and guide users toward taking action. Use social proof and value-driven language. Always include a clear next step.",
    welcome: "Welcome! You've come to the right place. Let me show you how we can help grow your business. Ready to get started?",
  },
  support: {
    label: "Support-Oriented",
    prompt: "You are a patient and empathetic support assistant. Listen carefully, acknowledge concerns, and provide step-by-step solutions. Always follow up to ensure the issue is resolved.",
    welcome: "Hello! I'm here to help with any questions or issues you might have. Please tell me what you need, and I'll do my best to assist.",
  },
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "sv", label: "Swedish" },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TelegramBotPage() {
  useAuth();

  // Tab state
  const [tab, setTab] = useState<Tab>("setup");

  // Setup state
  const [botToken, setBotToken] = useState("7483920156:AAH_kQ9xZ2mR5vN8...");
  const [showToken, setShowToken] = useState(false);
  const [webhookUrl] = useState("https://app.shortstack.dev/api/telegram/webhook");
  const [isConnected, setIsConnected] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Personality state
  const [botName, setBotName] = useState("ShortStack Assistant");
  const [personality, setPersonality] = useState("professional");
  const [systemPrompt, setSystemPrompt] = useState(PERSONALITY_PRESETS.professional.prompt);
  const [welcomeMessage, setWelcomeMessage] = useState(PERSONALITY_PRESETS.professional.welcome);
  const [fallbackMessage, setFallbackMessage] = useState("I'm not sure I understand. Could you rephrase that? You can also type /help to see available commands.");
  const [language, setLanguage] = useState("en");
  const [savingPersonality, setSavingPersonality] = useState(false);

  // Commands state
  const [commands, setCommands] = useState<BotCommand[]>(DEFAULT_COMMANDS);
  const [showAddCommand, setShowAddCommand] = useState(false);
  const [newCommand, setNewCommand] = useState<{ command: string; description: string; responseType: "text" | "ai-generated" | "action"; content: string }>({ command: "", description: "", responseType: "text", content: "" });
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // Conversations state
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [expandedConvo, setExpandedConvo] = useState<string | null>(null);
  const [convoSearch, setConvoSearch] = useState("");

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSchedule, setBroadcastSchedule] = useState("");
  const [broadcasts] = useState<Broadcast[]>(MOCK_BROADCASTS);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Client access state
  const [clientChatEnabled, setClientChatEnabled] = useState(true);
  const [clientGreetings, setClientGreetings] = useState<Record<string, string>>({
    "client-1": "Welcome back! Your campaign is running smoothly.",
    "client-2": "Hi there! Ready to review your latest results?",
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [expandedConvo]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleTestConnection() {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsConnected(true);
    setTesting(false);
    toast.success("Bot connection verified");
  }

  function handlePersonalityChange(key: string) {
    setPersonality(key);
    setSystemPrompt(PERSONALITY_PRESETS[key].prompt);
    setWelcomeMessage(PERSONALITY_PRESETS[key].welcome);
  }

  async function handleSavePersonality() {
    setSavingPersonality(true);
    await new Promise(r => setTimeout(r, 1000));
    setSavingPersonality(false);
    toast.success("Bot personality saved");
  }

  function handleToggleCommand(id: string) {
    setCommands(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c));
  }

  function handleDeleteCommand(id: string) {
    setCommands(prev => prev.filter(c => c.id !== id));
    toast.success("Command removed");
  }

  function handleAddCommand() {
    if (!newCommand.command.startsWith("/")) {
      toast.error("Command must start with /");
      return;
    }
    if (commands.some(c => c.command === newCommand.command)) {
      toast.error("Command already exists");
      return;
    }
    const cmd: BotCommand = {
      id: `cmd-${Date.now()}`,
      command: newCommand.command,
      description: newCommand.description,
      responseType: newCommand.responseType,
      content: newCommand.content,
      enabled: true,
      isDefault: false,
    };
    setCommands(prev => [...prev, cmd]);
    setNewCommand({ command: "", description: "", responseType: "text", content: "" });
    setShowAddCommand(false);
    toast.success("Command added");
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...commands];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    setCommands(reordered);
    setDragIdx(idx);
  }

  function handleDragEnd() {
    setDragIdx(null);
  }

  async function handleSendBroadcast() {
    if (!broadcastMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }
    setSendingBroadcast(true);
    await new Promise(r => setTimeout(r, 2000));
    setSendingBroadcast(false);
    setBroadcastMessage("");
    setBroadcastSchedule("");
    toast.success("Broadcast sent to 342 subscribers");
  }

  async function handleSaveToken() {
    await new Promise(r => setTimeout(r, 800));
    toast.success("Bot token saved");
  }

  const filteredConversations = conversations.filter(c =>
    c.userName.toLowerCase().includes(convoSearch.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(convoSearch.toLowerCase())
  );

  const maxDaily = Math.max(...ANALYTICS_DAILY.map(d => d.count));

  // ─── Tab navigation ────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "setup", label: "Setup", icon: <Settings size={16} /> },
    { key: "personality", label: "Personality", icon: <Sparkles size={16} /> },
    { key: "commands", label: "Commands", icon: <Terminal size={16} /> },
    { key: "conversations", label: "Conversations", icon: <MessageSquare size={16} /> },
    { key: "analytics", label: "Analytics", icon: <BarChart3 size={16} /> },
    { key: "broadcast", label: "Broadcast", icon: <Radio size={16} /> },
    { key: "client-access", label: "Client Access", icon: <Shield size={16} /> },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0088cc]/10 flex items-center justify-center">
              <Bot size={22} className="text-[#0088cc]" />
            </div>
            Telegram Bot
          </h1>
          <p className="text-muted text-sm mt-1">Manage your AI-powered Telegram bot for client communication</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${isConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          <span className="text-xs text-muted bg-surface-light px-3 py-1.5 rounded-full border border-border">
            @shortstack_bot
          </span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-surface-light border border-border rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              tab === t.key
                ? "bg-gold/10 text-gold border border-gold/20"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ SETUP TAB ═══════════ */}
      {tab === "setup" && (
        <div className="space-y-4">
          {/* Bot Token */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Shield size={14} className="text-gold" />
              Bot Token
            </h3>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 pr-10"
                  placeholder="Enter your bot token from @BotFather"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSaveToken}
                className="px-5 py-2.5 bg-gold/10 text-gold border border-gold/20 rounded-lg text-sm font-medium hover:bg-gold/20 transition-all flex items-center gap-2"
              >
                <Save size={14} />
                Save
              </button>
            </div>
            <p className="text-xs text-muted mt-2">Get your token from <span className="text-gold">@BotFather</span> on Telegram</p>
          </div>

          {/* Connection & Webhook */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <Link size={14} className="text-gold" />
                Webhook URL
              </h3>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-muted truncate">
                  {webhookUrl}
                </div>
                <button
                  onClick={() => handleCopy(webhookUrl, "webhook")}
                  className="px-3 py-2.5 bg-surface-light border border-border rounded-lg text-muted hover:text-foreground transition-colors"
                >
                  {copied === "webhook" ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted">Automatically configured when you save your token</span>
                <button
                  onClick={() => handleCopy("https://t.me/shortstack_bot", "botlink")}
                  className="text-xs text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
                >
                  {copied === "botlink" ? <Check size={12} /> : <Copy size={12} />}
                  Copy bot link
                </button>
              </div>
            </div>

            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <Activity size={14} className="text-gold" />
                Connection Status
              </h3>
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{isConnected ? "Bot is online" : "Bot is offline"}</p>
                      <p className="text-xs text-muted">Last ping: 2 seconds ago</p>
                    </div>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 bg-gold/10 text-gold border border-gold/20 rounded-lg text-sm font-medium hover:bg-gold/20 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {testing ? <Loader size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {testing ? "Testing..." : "Test"}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface-light border border-border rounded-lg px-3 py-2">
                    <span className="text-muted">Username</span>
                    <p className="text-foreground font-medium">@shortstack_bot</p>
                  </div>
                  <div className="bg-surface-light border border-border rounded-lg px-3 py-2">
                    <span className="text-muted">Bot ID</span>
                    <p className="text-foreground font-medium">7483920156</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code & Quick Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card flex flex-col items-center justify-center py-8">
              <div className="w-32 h-32 bg-surface-light border-2 border-dashed border-border rounded-2xl flex items-center justify-center mb-3">
                <QrCode size={48} className="text-muted" />
              </div>
              <p className="text-sm font-medium text-foreground">Scan to open bot</p>
              <p className="text-xs text-muted mt-1">t.me/shortstack_bot</p>
            </div>

            <div className="card">
              <h3 className="section-header">Quick Stats</h3>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Users size={14} /> Total Users</span>
                  <span className="text-sm font-bold text-foreground">342</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><MessageCircle size={14} /> Messages Today</span>
                  <span className="text-sm font-bold text-foreground">89</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Zap size={14} /> Commands Used</span>
                  <span className="text-sm font-bold text-foreground">1,060</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted flex items-center gap-2"><Clock size={14} /> Avg Response</span>
                  <span className="text-sm font-bold text-foreground">0.8s</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="section-header">Bot Info</h3>
              <div className="space-y-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Name</span>
                  <span className="text-sm font-medium text-foreground">ShortStack Assistant</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Created</span>
                  <span className="text-sm font-medium text-foreground">Mar 12, 2026</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Personality</span>
                  <span className="text-sm font-medium text-gold">Professional</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Commands</span>
                  <span className="text-sm font-medium text-foreground">{commands.filter(c => c.enabled).length} active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PERSONALITY TAB ═══════════ */}
      {tab === "personality" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Bot size={14} className="text-gold" />
              Bot Name
            </h3>
            <input
              type="text"
              value={botName}
              onChange={e => setBotName(e.target.value)}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 mt-2"
              placeholder="Enter bot display name"
            />
          </div>

          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              Personality Preset
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {Object.entries(PERSONALITY_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePersonalityChange(key)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    personality === key
                      ? "bg-gold/10 border-gold/30 ring-1 ring-gold/20"
                      : "bg-surface-light border-border hover:border-gold/20"
                  }`}
                >
                  <p className={`text-sm font-medium ${personality === key ? "text-gold" : "text-foreground"}`}>
                    {preset.label}
                  </p>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{preset.prompt.slice(0, 60)}...</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Edit3 size={14} className="text-gold" />
              Custom System Prompt
            </h3>
            <p className="text-xs text-muted mb-2">Define what your bot knows and how it should behave</p>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={5}
              className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none"
              placeholder="Describe the bot's role, personality, and what it should know..."
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <MessageCircle size={14} className="text-gold" />
                Welcome Message
              </h3>
              <textarea
                value={welcomeMessage}
                onChange={e => setWelcomeMessage(e.target.value)}
                rows={3}
                className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none mt-2"
                placeholder="Message sent when users first interact with the bot..."
              />
            </div>

            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <AlertCircle size={14} className="text-gold" />
                Fallback Message
              </h3>
              <textarea
                value={fallbackMessage}
                onChange={e => setFallbackMessage(e.target.value)}
                rows={3}
                className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none mt-2"
                placeholder="Response when the bot doesn't understand the query..."
              />
            </div>
          </div>

          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Globe size={14} className="text-gold" />
              Language
            </h3>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 mt-2"
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSavePersonality}
              disabled={savingPersonality}
              className="px-6 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {savingPersonality ? <Loader size={14} className="animate-spin" /> : <Save size={14} />}
              {savingPersonality ? "Saving..." : "Save Personality"}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ COMMANDS TAB ═══════════ */}
      {tab === "commands" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="section-header mb-0">Bot Commands</h3>
              <p className="text-xs text-muted mt-0.5">Drag to reorder. Toggle to enable/disable.</p>
            </div>
            <button
              onClick={() => setShowAddCommand(true)}
              className="px-4 py-2 bg-gold/10 text-gold border border-gold/20 rounded-lg text-sm font-medium hover:bg-gold/20 transition-all flex items-center gap-2"
            >
              <Plus size={14} />
              Add Command
            </button>
          </div>

          <div className="space-y-2">
            {commands.map((cmd, idx) => (
              <div
                key={cmd.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`card !p-4 flex items-center gap-4 ${dragIdx === idx ? "opacity-50 border-gold/40" : ""} ${!cmd.enabled ? "opacity-60" : ""}`}
              >
                <GripVertical size={16} className="text-muted cursor-grab flex-shrink-0" />

                <div className="w-28 flex-shrink-0">
                  <code className="text-sm font-mono text-gold bg-gold/10 px-2 py-0.5 rounded">{cmd.command}</code>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{cmd.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      cmd.responseType === "text" ? "bg-blue-500/10 text-blue-400" :
                      cmd.responseType === "ai-generated" ? "bg-purple-500/10 text-purple-400" :
                      "bg-amber-500/10 text-amber-400"
                    }`}>
                      {cmd.responseType}
                    </span>
                    {cmd.isDefault && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-light text-muted">default</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleCommand(cmd.id)}
                    className="text-muted hover:text-foreground transition-colors"
                  >
                    {cmd.enabled ? (
                      <ToggleRight size={24} className="text-emerald-400" />
                    ) : (
                      <ToggleLeft size={24} className="text-muted" />
                    )}
                  </button>
                  {!cmd.isDefault && (
                    <button
                      onClick={() => handleDeleteCommand(cmd.id)}
                      className="text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Command Modal */}
          {showAddCommand && (
            <div className="card border-gold/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-header mb-0">Add Custom Command</h3>
                <button onClick={() => setShowAddCommand(false)} className="text-muted hover:text-foreground">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted mb-1 block">Command</label>
                    <input
                      type="text"
                      value={newCommand.command}
                      onChange={e => setNewCommand(prev => ({ ...prev, command: e.target.value }))}
                      className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm font-mono text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
                      placeholder="/mycommand"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted mb-1 block">Description</label>
                    <input
                      type="text"
                      value={newCommand.description}
                      onChange={e => setNewCommand(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
                      placeholder="What this command does"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Response Type</label>
                  <div className="flex gap-2">
                    {(["text", "ai-generated", "action"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNewCommand(prev => ({ ...prev, responseType: t }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          newCommand.responseType === t
                            ? "bg-gold/10 text-gold border border-gold/20"
                            : "bg-surface-light text-muted border border-border hover:border-gold/20"
                        }`}
                      >
                        {t === "text" ? "Text" : t === "ai-generated" ? "AI Generated" : "Action"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">
                    {newCommand.responseType === "text" ? "Response Text" : newCommand.responseType === "ai-generated" ? "AI Instructions" : "Action ID"}
                  </label>
                  <textarea
                    value={newCommand.content}
                    onChange={e => setNewCommand(prev => ({ ...prev, content: e.target.value }))}
                    rows={3}
                    className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 resize-none"
                    placeholder={
                      newCommand.responseType === "text" ? "The response message..." :
                      newCommand.responseType === "ai-generated" ? "Instructions for the AI to generate a response..." :
                      "action_identifier"
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddCommand(false)}
                    className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddCommand}
                    className="px-5 py-2 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all flex items-center gap-2"
                  >
                    <Plus size={14} />
                    Add Command
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ CONVERSATIONS TAB ═══════════ */}
      {tab === "conversations" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={convoSearch}
                onChange={e => setConvoSearch(e.target.value)}
                className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                placeholder="Search conversations..."
              />
            </div>
            <span className="text-xs text-muted bg-surface-light px-3 py-2 rounded-lg border border-border">
              {conversations.length} active
            </span>
          </div>

          <div className="space-y-2">
            {filteredConversations.map(convo => (
              <div key={convo.id}>
                <button
                  onClick={() => setExpandedConvo(expandedConvo === convo.id ? null : convo.id)}
                  className={`card !p-4 w-full text-left flex items-center gap-4 transition-all ${
                    expandedConvo === convo.id ? "border-gold/30 ring-1 ring-gold/10" : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gold">{convo.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{convo.userName}</p>
                      <span className="text-xs text-muted">{convo.timestamp}</span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">{convo.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {convo.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-gold text-black text-[10px] font-bold flex items-center justify-center">
                        {convo.unreadCount}
                      </span>
                    )}
                    {expandedConvo === convo.id ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                  </div>
                </button>

                {/* Expanded chat */}
                {expandedConvo === convo.id && (
                  <div className="card !p-0 mt-1 overflow-hidden border-gold/20">
                    <div className="bg-gold/5 border-b border-border px-4 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-gold">{convo.avatar}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{convo.userName}</span>
                      </div>
                      <span className="text-xs text-muted">{convo.messages.length} messages</span>
                    </div>

                    <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                      {convo.messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "user" ? "justify-start" : "justify-end"}`}
                        >
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            msg.sender === "user"
                              ? "bg-surface-light border border-border rounded-bl-md"
                              : "bg-gold/10 border border-gold/20 rounded-br-md"
                          }`}>
                            <p className={`text-sm whitespace-pre-wrap ${
                              msg.sender === "user" ? "text-foreground" : "text-foreground"
                            }`}>
                              {msg.text}
                            </p>
                            <p className={`text-[10px] mt-1 ${
                              msg.sender === "user" ? "text-muted" : "text-gold/60"
                            }`}>
                              {msg.timestamp}
                            </p>
                          </div>
                        </div>
                      ))}
                      {/* Typing indicator for conversations with unread */}
                      {convo.unreadCount > 0 && (
                        <div className="flex justify-end">
                          <div className="bg-gold/10 border border-gold/20 rounded-2xl rounded-br-md px-4 py-3 flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-gold/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 rounded-full bg-gold/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-gold/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════ ANALYTICS TAB ═══════════ */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: "342", icon: <Users size={18} />, change: "+12 this week", color: "text-[#0088cc]" },
              { label: "Active Today", value: "47", icon: <Activity size={18} />, change: "13.7% of total", color: "text-emerald-400" },
              { label: "Messages Sent", value: "1,247", icon: <MessageSquare size={18} />, change: "+89 today", color: "text-gold" },
              { label: "Avg Response", value: "0.8s", icon: <Clock size={18} />, change: "Under 1s target", color: "text-purple-400" },
            ].map(stat => (
              <div key={stat.label} className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className={`${stat.color}`}>{stat.icon}</span>
                  <span className="text-xs text-muted">{stat.change}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Messages Per Day */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <BarChart3 size={14} className="text-gold" />
              Messages Per Day (Last 7 Days)
            </h3>
            <div className="flex items-end gap-2 mt-4 h-40">
              {ANALYTICS_DAILY.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted font-medium">{d.count}</span>
                  <div
                    className="w-full bg-gold/20 rounded-t-lg hover:bg-gold/30 transition-colors relative group"
                    style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: "8px" }}
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gold/40 rounded-t-lg transition-all"
                      style={{ height: `${(d.count / maxDaily) * 60}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted">{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Commands */}
            <div className="card">
              <h3 className="section-header flex items-center gap-2">
                <Terminal size={14} className="text-gold" />
                Top Commands Used
              </h3>
              <div className="space-y-3 mt-4">
                {TOP_COMMANDS.map(cmd => (
                  <div key={cmd.command} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <code className="text-xs font-mono text-gold">{cmd.command}</code>
                      <span className="text-xs text-muted">{cmd.count}</span>
                    </div>
                    <div className="w-full h-2 bg-surface-light rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold/30 rounded-full transition-all"
                        style={{ width: `${cmd.pct}%` }}
                      >
                        <div
                          className="h-full bg-gold/60 rounded-full"
                          style={{ width: "60%" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Satisfaction & Peak Hours */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="section-header flex items-center gap-2">
                  <ThumbsUp size={14} className="text-gold" />
                  User Satisfaction
                </h3>
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <ThumbsUp size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">89%</p>
                      <p className="text-xs text-muted">Positive</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                      <ThumbsDown size={20} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">11%</p>
                      <p className="text-xs text-muted">Negative</p>
                    </div>
                  </div>
                </div>
                <div className="w-full h-3 bg-surface-light rounded-full overflow-hidden mt-4">
                  <div className="h-full bg-emerald-400/40 rounded-full" style={{ width: "89%" }}>
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: "70%" }} />
                  </div>
                </div>
                <p className="text-xs text-muted mt-2">Based on 456 feedback responses</p>
              </div>

              <div className="card">
                <h3 className="section-header flex items-center gap-2">
                  <Clock size={14} className="text-gold" />
                  Peak Activity Hours
                </h3>
                <div className="flex items-end gap-[3px] mt-4 h-16">
                  {PEAK_HOURS.map(h => (
                    <div key={h.hour} className="flex-1 flex flex-col items-center">
                      <div
                        className={`w-full rounded-t transition-colors ${h.pct > 80 ? "bg-gold/50" : h.pct > 50 ? "bg-gold/30" : "bg-gold/15"}`}
                        style={{ height: `${h.pct}%`, minHeight: "2px" }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted">6am</span>
                  <span className="text-[9px] text-muted">12pm</span>
                  <span className="text-[9px] text-muted">8pm</span>
                </div>
                <p className="text-xs text-muted mt-2">Peak: <span className="text-gold font-medium">3-5 PM</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BROADCAST TAB ═══════════ */}
      {tab === "broadcast" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Radio size={14} className="text-gold" />
              New Broadcast
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted mb-1 block">Message (supports Markdown)</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={e => setBroadcastMessage(e.target.value)}
                    rows={6}
                    className="w-full bg-surface-light border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 resize-none font-mono"
                    placeholder="Type your broadcast message here...&#10;&#10;You can use **bold**, _italic_, and `code` formatting."
                  />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Schedule (optional)</label>
                  <input
                    type="datetime-local"
                    value={broadcastSchedule}
                    onChange={e => setBroadcastSchedule(e.target.value)}
                    className="bg-surface-light border border-border rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Users size={12} /> Will be sent to <span className="text-foreground font-medium">342 subscribers</span>
                  </span>
                  <button
                    onClick={handleSendBroadcast}
                    disabled={sendingBroadcast || !broadcastMessage.trim()}
                    className="px-5 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {sendingBroadcast ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                    {broadcastSchedule ? "Schedule" : "Send to All"}
                  </button>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-xs text-muted mb-1 block">Preview</label>
                <div className="bg-[#0e1621] border border-[#1c2b3a] rounded-xl p-4 min-h-[180px]">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1c2b3a]">
                    <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
                      <Bot size={14} className="text-[#0088cc]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">ShortStack Bot</p>
                      <p className="text-[10px] text-gray-500">bot</p>
                    </div>
                  </div>
                  {broadcastMessage ? (
                    <div className="bg-[#182533] rounded-xl rounded-tl-md px-3.5 py-2.5 max-w-[85%]">
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{broadcastMessage}</p>
                      <p className="text-[10px] text-gray-500 mt-1">Now</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 italic">Type a message to see preview...</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Previous Broadcasts */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2">
              <Clock size={14} className="text-gold" />
              Previous Broadcasts
            </h3>
            <div className="space-y-2 mt-3">
              {broadcasts.map(bc => (
                <div key={bc.id} className="bg-surface-light border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <Send size={16} className="text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{bc.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted">{bc.sentAt}</span>
                      <span className="text-xs text-muted flex items-center gap-1"><Users size={10} /> {bc.recipients}</span>
                      <span className="text-xs text-emerald-400 flex items-center gap-1"><Eye size={10} /> {bc.openRate}% opened</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex-shrink-0">
                    {bc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CLIENT ACCESS TAB ═══════════ */}
      {tab === "client-access" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="section-header mb-0 flex items-center gap-2">
                  <Shield size={14} className="text-gold" />
                  Client Bot Access
                </h3>
                <p className="text-xs text-muted mt-0.5">Allow clients to interact with the bot directly</p>
              </div>
              <button
                onClick={() => setClientChatEnabled(!clientChatEnabled)}
                className="text-muted hover:text-foreground transition-colors"
              >
                {clientChatEnabled ? (
                  <ToggleRight size={32} className="text-emerald-400" />
                ) : (
                  <ToggleLeft size={32} className="text-muted" />
                )}
              </button>
            </div>
          </div>

          {clientChatEnabled && (
            <>
              <div className="card">
                <h3 className="section-header flex items-center gap-2">
                  <Sparkles size={14} className="text-gold" />
                  Per-Client AI Knowledge Base
                </h3>
                <p className="text-xs text-muted mb-3">Configure what the bot knows about each client for personalized responses</p>
                <div className="space-y-3">
                  {[
                    { id: "client-1", name: "Sunrise Bakery", industry: "Food & Beverage" },
                    { id: "client-2", name: "Peak Fitness", industry: "Health & Fitness" },
                    { id: "client-3", name: "TechVault Solutions", industry: "Technology" },
                  ].map(client => (
                    <div key={client.id} className="bg-surface-light border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-gold">{client.name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{client.name}</p>
                            <p className="text-xs text-muted">{client.industry}</p>
                          </div>
                        </div>
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Active</span>
                      </div>
                      <textarea
                        defaultValue={`Knowledge base for ${client.name}: Services, pricing, FAQs, brand voice guidelines, and ongoing campaign details.`}
                        rows={2}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40 resize-none mt-2"
                        placeholder="Enter client-specific knowledge..."
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 className="section-header flex items-center gap-2">
                  <MessageCircle size={14} className="text-gold" />
                  Client-Specific Greetings
                </h3>
                <p className="text-xs text-muted mb-3">Custom welcome messages when clients start a conversation</p>
                <div className="space-y-3">
                  {[
                    { id: "client-1", name: "Sunrise Bakery" },
                    { id: "client-2", name: "Peak Fitness" },
                    { id: "client-3", name: "TechVault Solutions" },
                  ].map(client => (
                    <div key={client.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-surface-light border border-border flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-muted">{client.name.charAt(0)}</span>
                      </div>
                      <input
                        type="text"
                        value={clientGreetings[client.id] || ""}
                        onChange={e => setClientGreetings(prev => ({ ...prev, [client.id]: e.target.value }))}
                        className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
                        placeholder={`Greeting for ${client.name}...`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => toast.success("Client access settings saved")}
                  className="px-6 py-2.5 bg-gold text-black rounded-lg text-sm font-semibold hover:bg-gold/90 transition-all flex items-center gap-2"
                >
                  <Save size={14} />
                  Save Settings
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* PageAI Assistant */}
      <PageAI
        pageName="Telegram Bot"
        context={`Bot: @shortstack_bot. ${isConnected ? "Connected" : "Disconnected"}. ${commands.filter(c => c.enabled).length} active commands. ${conversations.length} active conversations. 342 total subscribers. Personality: ${PERSONALITY_PRESETS[personality].label}.`}
        suggestions={[
          "Help me write a custom bot command for invoicing",
          "Draft a broadcast message announcing our new service",
          "What personality should I use for a SaaS client?",
          "Suggest commands for a real estate agency bot",
        ]}
      />
    </div>
  );
}