"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Modal from "@/components/ui/modal";
import {
  MessageSquare, Zap, Play, Sparkles, Send,
  Clock, GitBranch, Bot, Check,
  Camera, Music, Star, Users, Gift, Calendar
} from "lucide-react";
import toast from "react-hot-toast";

interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;
  category: string;
  trigger: string;
  icon: React.ReactNode;
  color: string;
  steps: Array<{
    type: "message" | "delay" | "condition" | "action";
    content: string;
    delay?: string;
  }>;
}

const TEMPLATES: AutomationTemplate[] = [
  {
    id: "ig-welcome",
    name: "Welcome New Followers",
    description: "Automatically send a welcome DM when someone follows you",
    platform: "instagram",
    category: "engagement",
    trigger: "New follower",
    icon: <Camera size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "delay", content: "Wait 2 minutes", delay: "2m" },
      { type: "message", content: "Hey {first_name}! Thanks for following us! 🙌 We help businesses like yours grow with proven marketing strategies. Would you like to learn more about what we do?" },
      { type: "condition", content: "If they reply YES" },
      { type: "message", content: "Awesome! Here's a quick overview of our services:\n\n✅ Social Media Management\n✅ Paid Ads (Meta, Google, TikTok)\n✅ Content Creation\n✅ Website & SEO\n\nWant to book a free strategy call? Just say 'BOOK' and I'll send you the link!" },
    ],
  },
  {
    id: "ig-comment-reply",
    name: "Comment Auto-Reply",
    description: "Reply to comments with a DM containing more info or a link",
    platform: "instagram",
    category: "engagement",
    trigger: "Comment with keyword",
    icon: <MessageSquare size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "message", content: "Hey {first_name}! Thanks for your comment! 💬 I just sent you some more info in your DMs — check it out!" },
      { type: "delay", content: "Wait 30 seconds", delay: "30s" },
      { type: "message", content: "Here's the link you asked about: {link}\n\nLet me know if you have any questions! I'm here to help 🤝" },
    ],
  },
  {
    id: "ig-story-reply",
    name: "Story Mention Thank You",
    description: "Send a thank you DM when someone mentions you in their story",
    platform: "instagram",
    category: "engagement",
    trigger: "Story mention",
    icon: <Star size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "message", content: "Hey {first_name}! We just saw you mentioned us in your story — that means so much! 🥰 Thank you for the love!" },
      { type: "delay", content: "Wait 1 minute", delay: "1m" },
      { type: "message", content: "As a thank you, here's a special {discount}% off your next service with us! Use code: THANKYOU{discount} 🎁" },
    ],
  },
  {
    id: "ig-lead-capture",
    name: "Lead Capture Funnel",
    description: "Qualify leads through DMs with automated questions",
    platform: "instagram",
    category: "lead_gen",
    trigger: "DM keyword: INFO",
    icon: <Users size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "message", content: "Hey {first_name}! 👋 Thanks for reaching out. I'd love to learn more about your business so I can see how we can help.\n\nWhat industry are you in?" },
      { type: "condition", content: "Wait for reply" },
      { type: "message", content: "Great! And what's your biggest challenge right now when it comes to getting new customers?" },
      { type: "condition", content: "Wait for reply" },
      { type: "message", content: "I totally get that. We've helped tons of businesses like yours solve exactly that.\n\nWant to book a free 15-min strategy call? I'll show you exactly what we'd do for you.\n\n📅 Book here: {booking_link}" },
    ],
  },
  {
    id: "ig-promo",
    name: "Promotional Campaign",
    description: "Send a promo offer to engaged followers",
    platform: "instagram",
    category: "sales",
    trigger: "Manual broadcast",
    icon: <Gift size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "message", content: "Hey {first_name}! 🔥 We've got something special for you this week!\n\n{promo_details}\n\nThis offer expires {expiry_date}. Reply 'YES' if you want in!" },
      { type: "condition", content: "If they reply YES" },
      { type: "message", content: "You're in! 🎉 Here's your exclusive link: {promo_link}\n\nLet me know if you have any questions!" },
    ],
  },
  {
    id: "ig-appointment",
    name: "Appointment Reminder",
    description: "Send automated appointment reminders via DM",
    platform: "instagram",
    category: "operations",
    trigger: "Scheduled — 24h before appointment",
    icon: <Calendar size={16} />,
    color: "text-pink-400",
    steps: [
      { type: "message", content: "Hey {first_name}! 📋 Just a friendly reminder that you have an appointment with us tomorrow at {time}.\n\n📍 {location}\n\nReply 'CONFIRM' to confirm or 'RESCHEDULE' if you need to change the time." },
      { type: "condition", content: "If RESCHEDULE" },
      { type: "message", content: "No problem! Here's a link to pick a new time: {booking_link}" },
    ],
  },
  {
    id: "tt-welcome",
    name: "TikTok Comment Funnel",
    description: "Reply to TikTok comments and drive to DMs",
    platform: "tiktok",
    category: "lead_gen",
    trigger: "Comment with keyword",
    icon: <Music size={16} />,
    color: "text-white",
    steps: [
      { type: "message", content: "Hey! Thanks for commenting 🙌 I just sent you a DM with more details!" },
      { type: "delay", content: "Wait 10 seconds", delay: "10s" },
      { type: "message", content: "Hey {first_name}! Here's the info from the video:\n\n{video_info}\n\nWant me to help you get started? Just reply YES!" },
    ],
  },
  {
    id: "fb-messenger-bot",
    name: "Facebook Messenger Bot",
    description: "Auto-respond to Facebook page messages",
    platform: "facebook",
    category: "engagement",
    trigger: "New page message",
    icon: <MessageSquare size={16} />,
    color: "text-blue-400",
    steps: [
      { type: "message", content: "Hey {first_name}! 👋 Thanks for messaging us. How can we help you today?\n\n1️⃣ Learn about our services\n2️⃣ Get a free quote\n3️⃣ Book an appointment\n4️⃣ Talk to a human\n\nJust reply with the number!" },
      { type: "condition", content: "Route based on reply" },
      { type: "message", content: "{selected_option_response}" },
    ],
  },
];

const CATEGORIES = [
  { id: "all", label: "All Templates" },
  { id: "engagement", label: "Engagement" },
  { id: "lead_gen", label: "Lead Gen" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
];

export default function AutomationsPage() {
  useAuth();
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null);
  const [activeAutomations, setActiveAutomations] = useState<string[]>([]);
  const [customizing, setCustomizing] = useState(false);
  const [editedSteps, setEditedSteps] = useState<AutomationTemplate["steps"]>([]);

  const filtered = activeCategory === "all" ? TEMPLATES : TEMPLATES.filter(t => t.category === activeCategory);

  function activateTemplate(template: AutomationTemplate) {
    setActiveAutomations(prev => [...prev, template.id]);
    toast.success(`"${template.name}" activated!`);
    setSelectedTemplate(null);
  }

  function deactivateTemplate(id: string) {
    setActiveAutomations(prev => prev.filter(a => a !== id));
    toast.success("Automation deactivated");
  }

  function startCustomize(template: AutomationTemplate) {
    setEditedSteps([...template.steps]);
    setCustomizing(true);
  }

  const getStepIcon = (type: string) => {
    switch (type) {
      case "message": return <Send size={12} className="text-gold" />;
      case "delay": return <Clock size={12} className="text-muted" />;
      case "condition": return <GitBranch size={12} className="text-warning" />;
      case "action": return <Zap size={12} className="text-gold" />;
      default: return <Zap size={12} />;
    }
  };

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Bot size={18} className="text-gold" /> DM Automations
          </h1>
          <p className="text-xs text-muted mt-0.5">Pre-built DM flows for Instagram, TikTok, and Facebook — activate in one click</p>
        </div>
        <div className="flex items-center gap-2">
          {activeAutomations.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] bg-success/[0.08] text-success px-2.5 py-1 rounded-md border border-success/15">
              <Zap size={10} />
              <span className="font-medium">{activeAutomations.length} active</span>
            </div>
          )}
        </div>
      </div>

      {/* Active automations */}
      {activeAutomations.length > 0 && (
        <div>
          <h2 className="section-header flex items-center gap-2">
            <Zap size={13} className="text-success" /> Active Automations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeAutomations.map(id => {
              const template = TEMPLATES.find(t => t.id === id);
              if (!template) return null;
              return (
                <div key={id} className="card-hover p-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                    <span className={template.color}>{template.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{template.name}</p>
                    <p className="text-[9px] text-success">Running</p>
                  </div>
                  <button onClick={() => deactivateTemplate(id)}
                    className="text-[10px] text-muted hover:text-danger transition-colors">
                    Stop
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="tab-group w-fit">
        {CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
            className={activeCategory === cat.id ? "tab-item-active" : "tab-item-inactive"}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(template => {
          const isActive = activeAutomations.includes(template.id);
          return (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className={`text-left rounded-xl p-4 border transition-all hover:-translate-y-[1px] ${
                isActive
                  ? "border-success/20 bg-success/[0.03]"
                  : "border-border bg-surface hover:border-gold/20 hover:shadow-card-hover"
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isActive ? "bg-success/10" : "bg-surface-light"
                } border border-border`}>
                  <span className={template.color}>{template.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold truncate">{template.name}</p>
                    {isActive && <Check size={12} className="text-success shrink-0" />}
                  </div>
                  <p className="text-[9px] text-muted capitalize">{template.platform} · {template.category.replace("_", " ")}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted leading-relaxed mb-2">{template.description}</p>
              <div className="flex items-center gap-1 text-[9px] text-gold">
                <Zap size={9} /> {template.trigger}
              </div>
            </button>
          );
        })}
      </div>

      {/* Template preview modal */}
      <Modal isOpen={!!selectedTemplate} onClose={() => { setSelectedTemplate(null); setCustomizing(false); }} title={selectedTemplate?.name || ""} size="lg">
        {selectedTemplate && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-surface-light border border-border`}>
                <span className={selectedTemplate.color}>{selectedTemplate.icon}</span>
              </div>
              <div>
                <p className="text-xs font-semibold">{selectedTemplate.name}</p>
                <p className="text-[10px] text-muted">{selectedTemplate.description}</p>
              </div>
            </div>

            {/* Trigger */}
            <div className="bg-gold/[0.05] border border-gold/15 rounded-lg px-3 py-2">
              <p className="text-[9px] text-gold uppercase tracking-wider font-medium mb-0.5">Trigger</p>
              <p className="text-xs">{selectedTemplate.trigger}</p>
            </div>

            {/* Flow steps */}
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Message Flow</p>
              <div className="space-y-1.5">
                {(customizing ? editedSteps : selectedTemplate.steps).map((step, i) => (
                  <div key={i}>
                    {i > 0 && <div className="flex justify-center py-0.5"><div className="w-px h-3 bg-border/50" /></div>}
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-md bg-surface-light flex items-center justify-center shrink-0 mt-0.5 border border-border">
                        {getStepIcon(step.type)}
                      </div>
                      <div className={`flex-1 rounded-lg px-3 py-2 border text-xs ${
                        step.type === "message" ? "bg-gold/[0.03] border-gold/10" :
                        step.type === "delay" ? "bg-surface-light/50 border-border" :
                        step.type === "condition" ? "bg-warning/[0.03] border-warning/10" :
                        "bg-gold/[0.03] border-gold/10"
                      }`}>
                        {customizing && step.type === "message" ? (
                          <textarea
                            value={step.content}
                            onChange={e => {
                              const updated = [...editedSteps];
                              updated[i] = { ...updated[i], content: e.target.value };
                              setEditedSteps(updated);
                            }}
                            className="w-full bg-transparent text-xs resize-none focus:outline-none min-h-[60px]"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{step.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <button onClick={() => startCustomize(selectedTemplate)}
                className="btn-ghost text-[10px] flex items-center gap-1">
                <Sparkles size={11} /> {customizing ? "Editing..." : "Customize Messages"}
              </button>
              <div className="flex gap-2">
                {activeAutomations.includes(selectedTemplate.id) ? (
                  <button onClick={() => { deactivateTemplate(selectedTemplate.id); setSelectedTemplate(null); }}
                    className="btn-danger text-xs">
                    Deactivate
                  </button>
                ) : (
                  <button onClick={() => activateTemplate(selectedTemplate)}
                    className="btn-primary text-xs flex items-center gap-1.5">
                    <Play size={12} /> Activate
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
