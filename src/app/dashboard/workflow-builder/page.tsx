"use client";

import { useState, useCallback, useRef, useMemo, DragEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, useReactFlow, addEdge,
  Handle, Position,
  type Node, type Edge, type Connection, type NodeProps,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Search, Save, Play, Undo2, Redo2, LayoutGrid,
  Trash2, X, ChevronRight, ChevronDown, GripVertical,
  UserPlus, FileText, Webhook, Clock, Mail, CalendarCheck,
  Phone, Bot, CheckSquare, Tag,
  Globe, Sparkles, ListPlus, GitBranch, AtSign, Smartphone,
  Timer, Bell, Activity, Download, Zap, Copy, LayoutTemplate,
  Gauge, Link2, ArrowRight, Settings, Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import PageAI from "@/components/page-ai";
import PageHero from "@/components/ui/page-hero";
import { NotionIcon, SlackIcon } from "@/components/ui/platform-icons";

/* ================================================================== */
/*  NODE DEFINITIONS                                                   */
/* ================================================================== */

interface NodeDef {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "trigger" | "action" | "condition" | "output";
}

const CATEGORY_COLORS: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  trigger:   { border: "border-l-emerald-500", bg: "bg-emerald-500/8",  dot: "bg-emerald-400", text: "text-emerald-400" },
  action:    { border: "border-l-blue-500",    bg: "bg-blue-500/8",     dot: "bg-blue-400",    text: "text-blue-400" },
  condition: { border: "border-l-amber-500",   bg: "bg-amber-500/8",    dot: "bg-amber-400",   text: "text-amber-400" },
  output:    { border: "border-l-purple-500",  bg: "bg-purple-500/8",   dot: "bg-purple-400",  text: "text-purple-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  trigger: "Triggers", action: "Actions", condition: "Conditions", output: "Outputs",
};

const NODE_DEFS: NodeDef[] = [
  // Triggers (green)
  { id: "new_lead",        label: "New Lead",         description: "Fires when a new lead enters the CRM",     icon: <UserPlus size={14} />,     category: "trigger" },
  { id: "form_submitted",  label: "Form Submitted",   description: "Fires when a form is completed",           icon: <FileText size={14} />,     category: "trigger" },
  { id: "webhook_received",label: "Webhook Received",  description: "Fires on incoming webhook POST",           icon: <Webhook size={14} />,      category: "trigger" },
  { id: "schedule",        label: "Schedule (Cron)",   description: "Runs on a cron schedule",                  icon: <Clock size={14} />,        category: "trigger" },
  { id: "email_received",  label: "Email Received",    description: "Fires when an email arrives",              icon: <Mail size={14} />,         category: "trigger" },
  { id: "booking_created", label: "Booking Created",   description: "Fires when a booking is made",             icon: <CalendarCheck size={14} />,category: "trigger" },
  // Actions (blue)
  { id: "send_email",      label: "Send Email",        description: "Send an email to a contact",               icon: <Mail size={14} />,         category: "action" },
  { id: "send_sms",        label: "Send SMS",          description: "Send an SMS via Twilio or provider",       icon: <Phone size={14} />,        category: "action" },
  { id: "ai_call",         label: "AI Call",           description: "Place an AI voice call via ElevenAgents",  icon: <Bot size={14} />,          category: "action" },
  { id: "create_task",     label: "Create Task",       description: "Create a task for the team",               icon: <CheckSquare size={14} />,  category: "action" },
  { id: "update_crm",      label: "Update CRM Status", description: "Change a lead or deal status",             icon: <Tag size={14} />,          category: "action" },
  { id: "log_notion",      label: "Log to Notion",     description: "Create a page in your Notion database",    icon: <NotionIcon size={14} />,   category: "action" },
  { id: "post_slack",      label: "Post to Slack",     description: "Send a message to a Slack channel",        icon: <SlackIcon size={14} />,    category: "action" },
  { id: "send_webhook",    label: "Send Webhook",      description: "Send a POST request to any URL",           icon: <Globe size={14} />,        category: "action" },
  { id: "generate_content",label: "Generate Content",  description: "Generate text with Claude AI",             icon: <Sparkles size={14} />,     category: "action" },
  { id: "add_to_sequence", label: "Add to Sequence",   description: "Enroll contact in an outreach sequence",   icon: <ListPlus size={14} />,     category: "action" },
  // Conditions (amber)
  { id: "if_else",         label: "If / Else",         description: "Branch based on a field comparison",       icon: <GitBranch size={14} />,    category: "condition" },
  { id: "has_email",       label: "Has Email",         description: "Check if contact has an email address",    icon: <AtSign size={14} />,       category: "condition" },
  { id: "has_phone",       label: "Has Phone",         description: "Check if contact has a phone number",      icon: <Smartphone size={14} />,   category: "condition" },
  { id: "lead_score_gt",   label: "Lead Score > X",    description: "Check if lead score exceeds threshold",    icon: <Gauge size={14} />,        category: "condition" },
  { id: "status_equals",   label: "Status Equals",     description: "Check if status matches a specific value", icon: <Tag size={14} />,          category: "condition" },
  { id: "wait_delay",      label: "Wait / Delay",      description: "Pause execution for a specified duration",  icon: <Timer size={14} />,        category: "condition" },
  // Outputs (purple)
  { id: "send_notification",label: "Send Notification", description: "Push notification to team",                icon: <Bell size={14} />,         category: "output" },
  { id: "log_event",       label: "Log Event",         description: "Write to the activity log",                icon: <Activity size={14} />,     category: "output" },
  { id: "export_data",     label: "Export Data",       description: "Export results to CSV or JSON",             icon: <Download size={14} />,     category: "output" },
];

const NODE_DEF_MAP = Object.fromEntries(NODE_DEFS.map(n => [n.id, n]));

/* ================================================================== */
/*  NODE CONFIG FIELDS                                                 */
/* ================================================================== */

interface FieldDef { key: string; label: string; type: "text" | "select" | "number" | "textarea"; options?: string[]; placeholder?: string; }

const NODE_CONFIG_FIELDS: Record<string, FieldDef[]> = {
  new_lead:         [{ key: "source", label: "Lead Source", type: "select", options: ["Any", "Website", "Referral", "Ads", "Scraper"] }],
  form_submitted:   [{ key: "form_id", label: "Form ID", type: "text", placeholder: "form_abc123" }],
  webhook_received: [{ key: "url", label: "Webhook URL", type: "text", placeholder: "https://..." }, { key: "secret", label: "Secret", type: "text" }],
  schedule:         [{ key: "cron", label: "Cron Expression", type: "text", placeholder: "0 9 * * 1-5" }, { key: "timezone", label: "Timezone", type: "select", options: ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London"] }],
  email_received:   [{ key: "from_filter", label: "From Contains", type: "text", placeholder: "example.com" }],
  booking_created:  [{ key: "calendar", label: "Calendar", type: "select", options: ["Any", "Main", "Sales", "Support"] }],
  send_email:       [{ key: "to", label: "To", type: "text", placeholder: "{{contact.email}}" }, { key: "subject", label: "Subject", type: "text" }, { key: "body", label: "Body", type: "textarea" }],
  send_sms:         [{ key: "to", label: "To", type: "text", placeholder: "{{contact.phone}}" }, { key: "message", label: "Message", type: "textarea" }],
  ai_call:          [{ key: "to", label: "Phone Number", type: "text", placeholder: "{{contact.phone}}" }, { key: "agent", label: "Agent", type: "select", options: ["Default", "Sales Rep", "Support Agent", "Appointment Setter"] }, { key: "script", label: "Script / Prompt", type: "textarea" }],
  create_task:      [{ key: "title", label: "Task Title", type: "text" }, { key: "assignee", label: "Assignee", type: "text" }, { key: "due_in", label: "Due In (hours)", type: "number" }],
  update_crm:       [{ key: "status", label: "New Status", type: "select", options: ["new", "contacted", "replied", "booked", "converted", "lost"] }],
  log_notion:       [{ key: "database_id", label: "Notion DB ID", type: "text" }, { key: "title", label: "Page Title", type: "text" }],
  post_slack:       [{ key: "channel", label: "Channel", type: "text", placeholder: "#general" }, { key: "message", label: "Message", type: "textarea" }],
  send_webhook:     [{ key: "url", label: "URL", type: "text", placeholder: "https://..." }, { key: "method", label: "Method", type: "select", options: ["POST", "PUT", "PATCH"] }],
  generate_content: [{ key: "prompt", label: "Prompt", type: "textarea", placeholder: "Write a follow-up email..." }, { key: "model", label: "Model", type: "select", options: ["Claude Sonnet", "Claude Haiku"] }],
  add_to_sequence:  [{ key: "sequence_id", label: "Sequence", type: "select", options: ["Cold Outreach", "Nurture", "Re-engagement", "Onboarding"] }],
  if_else:          [{ key: "field", label: "Field", type: "text", placeholder: "contact.status" }, { key: "operator", label: "Operator", type: "select", options: ["equals", "not_equals", "contains", "gt", "lt"] }, { key: "value", label: "Value", type: "text" }],
  has_email:        [],
  has_phone:        [],
  lead_score_gt:    [{ key: "threshold", label: "Minimum Score", type: "number" }],
  status_equals:    [{ key: "status", label: "Status", type: "select", options: ["new", "contacted", "replied", "booked", "converted"] }],
  wait_delay:       [{ key: "duration", label: "Duration", type: "number" }, { key: "unit", label: "Unit", type: "select", options: ["minutes", "hours", "days"] }],
  send_notification:[{ key: "title", label: "Title", type: "text" }, { key: "body", label: "Body", type: "textarea" }],
  log_event:        [{ key: "event_name", label: "Event Name", type: "text" }, { key: "payload", label: "Payload (JSON)", type: "textarea" }],
  export_data:      [{ key: "format", label: "Format", type: "select", options: ["CSV", "JSON"] }, { key: "destination", label: "Destination Email", type: "text" }],
};

/* ================================================================== */
/*  TEMPLATES                                                          */
/* ================================================================== */

interface Template {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  nodes: Node[];
  edges: Edge[];
}

function makeId() { return "n_" + Math.random().toString(36).slice(2, 10); }

function mkNode(id: string, defId: string, x: number, y: number, cfg?: Record<string, string>): Node {
  return { id, type: "workflow", position: { x, y }, data: { defId, config: cfg || {} } };
}
function mkEdge(src: string, tgt: string): Edge {
  return { id: `e_${src}_${tgt}`, source: src, target: tgt, animated: true, style: { stroke: "#C9A84C", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#C9A84C", width: 16, height: 16 } };
}

const TEMPLATES: Template[] = [
  {
    id: "t1", name: "Lead Nurture Sequence", description: "Capture new leads, AI-call them, wait, email, then update CRM based on reply.",
    nodeCount: 6,
    nodes: [
      mkNode("t1_1", "new_lead", 300, 0),
      mkNode("t1_2", "ai_call", 300, 120, { agent: "Sales Rep" }),
      mkNode("t1_3", "wait_delay", 300, 240, { duration: "1", unit: "hours" }),
      mkNode("t1_4", "send_email", 300, 360, { subject: "Following up" }),
      mkNode("t1_5", "if_else", 300, 480, { field: "contact.replied", operator: "equals", value: "true" }),
      mkNode("t1_6", "update_crm", 300, 600, { status: "replied" }),
    ],
    edges: [mkEdge("t1_1","t1_2"), mkEdge("t1_2","t1_3"), mkEdge("t1_3","t1_4"), mkEdge("t1_4","t1_5"), mkEdge("t1_5","t1_6")],
  },
  {
    id: "t2", name: "Booking Confirmation", description: "When a booking is created, confirm via SMS and email, then log to Notion.",
    nodeCount: 4,
    nodes: [
      mkNode("t2_1", "booking_created", 300, 0),
      mkNode("t2_2", "send_sms", 300, 120, { message: "Your booking is confirmed!" }),
      mkNode("t2_3", "send_email", 300, 240, { subject: "Booking Confirmation" }),
      mkNode("t2_4", "log_notion", 300, 360, { title: "New Booking" }),
    ],
    edges: [mkEdge("t2_1","t2_2"), mkEdge("t2_2","t2_3"), mkEdge("t2_3","t2_4")],
  },
  {
    id: "t3", name: "Content Pipeline", description: "On a schedule, generate content with AI, post to social, and notify your team.",
    nodeCount: 4,
    nodes: [
      mkNode("t3_1", "schedule", 300, 0, { cron: "0 9 * * 1-5" }),
      mkNode("t3_2", "generate_content", 300, 120, { prompt: "Write a social media post about..." }),
      mkNode("t3_3", "send_webhook", 300, 240, { url: "https://social-api/post", method: "POST" }),
      mkNode("t3_4", "post_slack", 300, 360, { channel: "#content", message: "New content posted!" }),
    ],
    edges: [mkEdge("t3_1","t3_2"), mkEdge("t3_2","t3_3"), mkEdge("t3_3","t3_4")],
  },
  {
    id: "t4", name: "Re-engagement", description: "Weekly check for stale leads, email them, and AI-call if no reply.",
    nodeCount: 5,
    nodes: [
      mkNode("t4_1", "schedule", 300, 0, { cron: "0 10 * * 1" }),
      mkNode("t4_2", "status_equals", 300, 120, { status: "contacted" }),
      mkNode("t4_3", "send_email", 300, 240, { subject: "Still interested?" }),
      mkNode("t4_4", "if_else", 300, 360, { field: "contact.replied", operator: "equals", value: "false" }),
      mkNode("t4_5", "ai_call", 300, 480, { agent: "Sales Rep" }),
    ],
    edges: [mkEdge("t4_1","t4_2"), mkEdge("t4_2","t4_3"), mkEdge("t4_3","t4_4"), mkEdge("t4_4","t4_5")],
  },
  {
    id: "t5", name: "Webhook Handler", description: "Receive external webhook, check conditions, act, and notify.",
    nodeCount: 4,
    nodes: [
      mkNode("t5_1", "webhook_received", 300, 0),
      mkNode("t5_2", "if_else", 300, 120, { field: "payload.type", operator: "equals", value: "order" }),
      mkNode("t5_3", "create_task", 300, 240, { title: "Process webhook order" }),
      mkNode("t5_4", "send_notification", 300, 360, { title: "Webhook processed" }),
    ],
    edges: [mkEdge("t5_1","t5_2"), mkEdge("t5_2","t5_3"), mkEdge("t5_3","t5_4")],
  },
  {
    id: "t6", name: "Daily Report", description: "Every morning, export data, email the report, and log the event.",
    nodeCount: 4,
    nodes: [
      mkNode("t6_1", "schedule", 300, 0, { cron: "0 8 * * *" }),
      mkNode("t6_2", "export_data", 300, 120, { format: "CSV" }),
      mkNode("t6_3", "send_email", 300, 240, { subject: "Daily Report" }),
      mkNode("t6_4", "log_event", 300, 360, { event_name: "daily_report_sent" }),
    ],
    edges: [mkEdge("t6_1","t6_2"), mkEdge("t6_2","t6_3"), mkEdge("t6_3","t6_4")],
  },
  {
    id: "t7", name: "Client Onboarding Flow", description: "New client signup triggers welcome email, project creation, team assignment, and kickoff scheduling.",
    nodeCount: 5,
    nodes: [
      mkNode("t7_1", "form_submitted", 0, 0, { form_id: "client_signup" }),
      mkNode("t7_2", "send_email", 200, 0, { subject: "Welcome aboard!", body: "We're thrilled to have you as a client." }),
      mkNode("t7_3", "create_task", 400, 0, { title: "Set up client project", assignee: "PM", due_in: "24" }),
      mkNode("t7_4", "post_slack", 600, 0, { channel: "#onboarding", message: "New client onboarded — team assigned." }),
      mkNode("t7_5", "send_email", 800, 0, { subject: "Kickoff call scheduled", body: "Your kickoff is booked for this week." }),
    ],
    edges: [mkEdge("t7_1","t7_2"), mkEdge("t7_2","t7_3"), mkEdge("t7_3","t7_4"), mkEdge("t7_4","t7_5")],
  },
  {
    id: "t8", name: "Social Media Auto-Post", description: "When content is approved, resize for platforms, schedule the post, publish, and track analytics.",
    nodeCount: 5,
    nodes: [
      mkNode("t8_1", "webhook_received", 300, 0, { url: "https://cms/content-approved" }),
      mkNode("t8_2", "generate_content", 300, 140, { prompt: "Resize and adapt approved content for Instagram, Facebook, and LinkedIn." }),
      mkNode("t8_3", "send_webhook", 300, 280, { url: "https://scheduler-api/schedule", method: "POST" }),
      mkNode("t8_4", "send_webhook", 300, 420, { url: "https://social-api/publish", method: "POST" }),
      mkNode("t8_5", "log_event", 300, 560, { event_name: "social_post_published" }),
    ],
    edges: [mkEdge("t8_1","t8_2"), mkEdge("t8_2","t8_3"), mkEdge("t8_3","t8_4"), mkEdge("t8_4","t8_5")],
  },
  {
    id: "t9", name: "Invoice Overdue Reminder", description: "When an invoice is past due, wait 3 days, send a reminder, wait 7 more days, escalate, then notify admin.",
    nodeCount: 6,
    nodes: [
      mkNode("t9_1", "webhook_received", 300, 0, { url: "https://billing/invoice-overdue" }),
      mkNode("t9_2", "wait_delay", 300, 140, { duration: "3", unit: "days" }),
      mkNode("t9_3", "send_email", 300, 280, { subject: "Payment reminder", body: "Your invoice is past due. Please remit payment." }),
      mkNode("t9_4", "wait_delay", 300, 420, { duration: "7", unit: "days" }),
      mkNode("t9_5", "send_email", 300, 560, { subject: "Urgent: Invoice escalation", body: "This is a final notice before account review." }),
      mkNode("t9_6", "send_notification", 300, 700, { title: "Invoice escalated", body: "Overdue invoice has been escalated to admin." }),
    ],
    edges: [mkEdge("t9_1","t9_2"), mkEdge("t9_2","t9_3"), mkEdge("t9_3","t9_4"), mkEdge("t9_4","t9_5"), mkEdge("t9_5","t9_6")],
  },
  {
    id: "t10", name: "Lead Score & Route", description: "Score new leads and route hot to sales, warm to nurture, and cold to archive.",
    nodeCount: 6,
    nodes: [
      mkNode("t10_1", "new_lead", 300, 0),
      mkNode("t10_2", "lead_score_gt", 300, 140, { threshold: "70" }),
      mkNode("t10_3", "ai_call", 100, 280, { agent: "Sales Rep", script: "High-value lead — book a demo." }),
      mkNode("t10_4", "lead_score_gt", 300, 280, { threshold: "40" }),
      mkNode("t10_5", "add_to_sequence", 300, 420, { sequence_id: "Nurture" }),
      mkNode("t10_6", "update_crm", 500, 280, { status: "lost" }),
    ],
    edges: [mkEdge("t10_1","t10_2"), mkEdge("t10_2","t10_3"), mkEdge("t10_2","t10_4"), mkEdge("t10_4","t10_5"), mkEdge("t10_4","t10_6")],
  },
  {
    id: "t11", name: "Review Response Bot", description: "Analyze new reviews with AI — thank positive reviewers publicly and alert the team on negatives.",
    nodeCount: 5,
    nodes: [
      mkNode("t11_1", "webhook_received", 300, 0, { url: "https://reviews-api/new-review" }),
      mkNode("t11_2", "generate_content", 300, 140, { prompt: "Analyze the sentiment of this review and classify as positive or negative." }),
      mkNode("t11_3", "if_else", 300, 280, { field: "sentiment", operator: "equals", value: "positive" }),
      mkNode("t11_4", "send_webhook", 100, 420, { url: "https://reviews-api/reply", method: "POST" }),
      mkNode("t11_5", "send_notification", 500, 420, { title: "Negative review received", body: "A negative review needs attention." }),
    ],
    edges: [mkEdge("t11_1","t11_2"), mkEdge("t11_2","t11_3"), mkEdge("t11_3","t11_4"), mkEdge("t11_3","t11_5")],
  },
  {
    id: "t12", name: "Monthly Report Generator", description: "On the 1st of each month, pull analytics, generate a report, review it, and email to the client.",
    nodeCount: 5,
    nodes: [
      mkNode("t12_1", "schedule", 300, 0, { cron: "0 8 1 * *" }),
      mkNode("t12_2", "export_data", 300, 140, { format: "JSON" }),
      mkNode("t12_3", "generate_content", 300, 280, { prompt: "Summarize this month's analytics data into a client-ready report." }),
      mkNode("t12_4", "create_task", 300, 420, { title: "Review monthly report before sending", assignee: "Account Manager", due_in: "4" }),
      mkNode("t12_5", "send_email", 300, 560, { subject: "Your Monthly Performance Report" }),
    ],
    edges: [mkEdge("t12_1","t12_2"), mkEdge("t12_2","t12_3"), mkEdge("t12_3","t12_4"), mkEdge("t12_4","t12_5")],
  },
  {
    id: "t13", name: "Proposal Follow-Up", description: "After sending a proposal, follow up after 2 days, then call after 5 more days, and close or mark lost.",
    nodeCount: 6,
    nodes: [
      mkNode("t13_1", "webhook_received", 300, 0, { url: "https://crm/proposal-sent" }),
      mkNode("t13_2", "wait_delay", 300, 140, { duration: "2", unit: "days" }),
      mkNode("t13_3", "if_else", 300, 280, { field: "contact.replied", operator: "equals", value: "false" }),
      mkNode("t13_4", "send_email", 300, 420, { subject: "Following up on our proposal", body: "Just checking in — any questions on the proposal?" }),
      mkNode("t13_5", "wait_delay", 300, 560, { duration: "5", unit: "days" }),
      mkNode("t13_6", "ai_call", 300, 700, { agent: "Sales Rep", script: "Follow up on the proposal sent last week." }),
    ],
    edges: [mkEdge("t13_1","t13_2"), mkEdge("t13_2","t13_3"), mkEdge("t13_3","t13_4"), mkEdge("t13_4","t13_5"), mkEdge("t13_5","t13_6")],
  },
  {
    id: "t14", name: "Ad Campaign Monitor", description: "Daily check on ad performance — pause underperforming ads, notify the team, and suggest optimizations.",
    nodeCount: 5,
    nodes: [
      mkNode("t14_1", "schedule", 300, 0, { cron: "0 9 * * *" }),
      mkNode("t14_2", "send_webhook", 300, 140, { url: "https://ads-api/performance", method: "POST" }),
      mkNode("t14_3", "if_else", 300, 280, { field: "roas", operator: "lt", value: "2.0" }),
      mkNode("t14_4", "send_webhook", 300, 420, { url: "https://ads-api/pause", method: "POST" }),
      mkNode("t14_5", "send_notification", 300, 560, { title: "Ad paused — low ROAS", body: "ROAS dropped below target. Ad paused. Review campaign." }),
    ],
    edges: [mkEdge("t14_1","t14_2"), mkEdge("t14_2","t14_3"), mkEdge("t14_3","t14_4"), mkEdge("t14_4","t14_5")],
  },
  {
    id: "t15", name: "Cold Outreach (Email → SMS → DM)", description: "Multi-channel cold outreach: email first, SMS if no open after 3 days, DM via social if still no reply.",
    nodeCount: 7,
    nodes: [
      mkNode("t15_1", "new_lead", 300, 0),
      mkNode("t15_2", "send_email", 300, 140, { subject: "Quick question about {{company}}", body: "Hi {{first_name}}, saw you're in {{industry}} — can I share 1 idea?" }),
      mkNode("t15_3", "wait_delay", 300, 280, { duration: "3", unit: "days" }),
      mkNode("t15_4", "if_else", 300, 420, { field: "email.opened", operator: "equals", value: "false" }),
      mkNode("t15_5", "send_sms", 300, 560, { message: "Hey {{first_name}}, sent you an email — quick thought for {{company}}. 30-sec read?" }),
      mkNode("t15_6", "wait_delay", 300, 700, { duration: "2", unit: "days" }),
      mkNode("t15_7", "add_to_sequence", 300, 840, { sequence_id: "LinkedIn DM" }),
    ],
    edges: [mkEdge("t15_1","t15_2"), mkEdge("t15_2","t15_3"), mkEdge("t15_3","t15_4"), mkEdge("t15_4","t15_5"), mkEdge("t15_5","t15_6"), mkEdge("t15_6","t15_7")],
  },
  {
    id: "t16", name: "Abandoned Cart Recovery", description: "Cart abandoned? Wait 1hr, email, wait 24hr, discount offer, then SMS if still nothing.",
    nodeCount: 6,
    nodes: [
      mkNode("t16_1", "webhook_received", 300, 0, { url: "https://shop/cart-abandoned" }),
      mkNode("t16_2", "wait_delay", 300, 140, { duration: "1", unit: "hours" }),
      mkNode("t16_3", "send_email", 300, 280, { subject: "You left something behind 👀", body: "Your cart is still waiting — complete checkout here." }),
      mkNode("t16_4", "wait_delay", 300, 420, { duration: "24", unit: "hours" }),
      mkNode("t16_5", "send_email", 300, 560, { subject: "Here's 10% off to close the deal", body: "Use code COMEBACK10 in the next 48 hours." }),
      mkNode("t16_6", "send_sms", 300, 700, { message: "One more nudge — your 10% off expires tonight: {{checkout_url}}" }),
    ],
    edges: [mkEdge("t16_1","t16_2"), mkEdge("t16_2","t16_3"), mkEdge("t16_3","t16_4"), mkEdge("t16_4","t16_5"), mkEdge("t16_5","t16_6")],
  },
  {
    id: "t17", name: "Birthday / Anniversary Touch", description: "On a customer's birthday or anniversary, send a personalized email with a gift code.",
    nodeCount: 4,
    nodes: [
      mkNode("t17_1", "schedule", 300, 0, { cron: "0 9 * * *" }),
      mkNode("t17_2", "status_equals", 300, 140, { status: "birthday_today" }),
      mkNode("t17_3", "generate_content", 300, 280, { prompt: "Write a warm birthday message to {{first_name}} with a 15% gift code." }),
      mkNode("t17_4", "send_email", 300, 420, { subject: "Happy birthday, {{first_name}} 🎉" }),
    ],
    edges: [mkEdge("t17_1","t17_2"), mkEdge("t17_2","t17_3"), mkEdge("t17_3","t17_4")],
  },
  {
    id: "t18", name: "Negative Review Alert", description: "New review comes in — if rating ≤ 3, instantly alert team and log for response.",
    nodeCount: 5,
    nodes: [
      mkNode("t18_1", "webhook_received", 300, 0, { url: "https://reviews/new" }),
      mkNode("t18_2", "if_else", 300, 140, { field: "rating", operator: "lte", value: "3" }),
      mkNode("t18_3", "post_slack", 300, 280, { channel: "#reviews-urgent", message: "🚨 {{rating}}-star review from {{reviewer_name}}: {{excerpt}}" }),
      mkNode("t18_4", "create_task", 300, 420, { title: "Respond to negative review", assignee: "Support Lead", due_in: "4" }),
      mkNode("t18_5", "log_event", 300, 560, { event_name: "negative_review_logged" }),
    ],
    edges: [mkEdge("t18_1","t18_2"), mkEdge("t18_2","t18_3"), mkEdge("t18_3","t18_4"), mkEdge("t18_4","t18_5")],
  },
  {
    id: "t19", name: "Post-Purchase Upsell", description: "After a purchase, wait 7 days, send a cross-sell email, then a loyalty invite if they buy again.",
    nodeCount: 5,
    nodes: [
      mkNode("t19_1", "webhook_received", 300, 0, { url: "https://shop/order-completed" }),
      mkNode("t19_2", "wait_delay", 300, 140, { duration: "7", unit: "days" }),
      mkNode("t19_3", "generate_content", 300, 280, { prompt: "Recommend a complementary product to what {{first_name}} just bought." }),
      mkNode("t19_4", "send_email", 300, 420, { subject: "You might also love these picks" }),
      mkNode("t19_5", "add_to_sequence", 300, 560, { sequence_id: "VIP Loyalty Program" }),
    ],
    edges: [mkEdge("t19_1","t19_2"), mkEdge("t19_2","t19_3"), mkEdge("t19_3","t19_4"), mkEdge("t19_4","t19_5")],
  },
  {
    id: "t20", name: "Referral Reward Trigger", description: "When a customer refers a friend who converts, reward both with credit and thank-you emails.",
    nodeCount: 5,
    nodes: [
      mkNode("t20_1", "webhook_received", 300, 0, { url: "https://referral/converted" }),
      mkNode("t20_2", "send_email", 100, 140, { subject: "Your friend signed up — here's your reward 🎁", body: "Thank you for the referral — we've added $50 credit to your account." }),
      mkNode("t20_3", "send_email", 500, 140, { subject: "Welcome! A friend vouched for you", body: "You've been invited by a valued customer — enjoy a 20% welcome discount." }),
      mkNode("t20_4", "update_crm", 300, 280, { status: "referrer_rewarded" }),
      mkNode("t20_5", "post_slack", 300, 420, { channel: "#growth", message: "New referral conversion — both parties rewarded." }),
    ],
    edges: [mkEdge("t20_1","t20_2"), mkEdge("t20_1","t20_3"), mkEdge("t20_2","t20_4"), mkEdge("t20_4","t20_5")],
  },
];

/* ================================================================== */
/*  CUSTOM NODE COMPONENT                                              */
/* ================================================================== */

function WorkflowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as { defId: string; config: Record<string, string>; _simActive?: boolean };
  const def = NODE_DEF_MAP[nodeData.defId];
  if (!def) return null;
  const colors = CATEGORY_COLORS[def.category];
  const isSimulating = nodeData._simActive === true;

  return (
    <div
      className={`
        relative group rounded-xl border-l-[3px] ${colors.border}
        bg-surface border border-border min-w-[200px] max-w-[240px]
        transition-all duration-200
        ${selected ? "ring-1 ring-gold/40 border-gold/30" : ""}
        ${isSimulating ? "ring-2 ring-gold/70 shadow-[0_0_20px_rgba(201,168,76,0.25)]" : ""}
      `}
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
    >
      {/* Input handle */}
      {def.category !== "trigger" && (
        <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-surface !border-2 !border-gold/50 !-top-[6px]" />
      )}

      <div className="px-3 py-2.5">
        {/* Header row */}
        <div className="flex items-center gap-2">
          <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text}`}>
            {def.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">{def.label}</div>
            <div className="text-[10px] text-muted truncate">{def.description}</div>
          </div>
          {/* Status dot */}
          <div className={`shrink-0 w-2 h-2 rounded-full ${isSimulating ? "bg-gold animate-pulse" : colors.dot} opacity-60`} />
        </div>

        {/* Config preview */}
        {nodeData.config && Object.keys(nodeData.config).length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/50">
            {Object.entries(nodeData.config).slice(0, 2).map(([k, v]) =>
              v ? (
                <div key={k} className="text-[10px] text-muted truncate">
                  <span className="text-muted/60">{k}:</span> {String(v)}
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      {/* Delete button on hover */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] hover:bg-red-600 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          const evt = new CustomEvent("workflow-delete-node", { detail: { nodeId: id } });
          window.dispatchEvent(evt);
        }}
      >
        <X size={10} />
      </button>

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-surface !border-2 !border-gold/50 !-bottom-[6px]" />
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode };

/* ================================================================== */
/*  UNDO / REDO HISTORY                                                */
/* ================================================================== */

interface HistoryEntry { nodes: Node[]; edges: Edge[]; }

function useHistory(initialNodes: Node[], initialEdges: Edge[]) {
  const past = useRef<HistoryEntry[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const pushHistory = useCallback(() => {
    past.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    future.current = [];
    if (past.current.length > 50) past.current.shift();
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    future.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    const prev = past.current.pop()!;
    setNodes(prev.nodes);
    setEdges(prev.edges);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    past.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    const next = future.current.pop()!;
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [nodes, edges, setNodes, setEdges]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  return { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, pushHistory, undo, redo, canUndo, canRedo };
}

/* ================================================================== */
/*  MAIN PAGE COMPONENT                                                */
/* ================================================================== */

export default function WorkflowBuilderPage() {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner />
    </ReactFlowProvider>
  );
}

function WorkflowBuilderInner() {
  useAuth();
  const reactFlowInstance = useReactFlow();

  // ── State ──
  const { nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange, pushHistory, undo, redo, canUndo, canRedo } = useHistory([], []);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [editingName, setEditingName] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const simulationRef = useRef(false);

  // ── Derived ──
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);
  const selectedDef = selectedNode ? NODE_DEF_MAP[selectedNode.data.defId as string] : null;
  const configFields = selectedNode ? (NODE_CONFIG_FIELDS[selectedNode.data.defId as string] || []) : [];

  const filteredDefs = useMemo(() => {
    if (!paletteSearch) return NODE_DEFS;
    const q = paletteSearch.toLowerCase();
    return NODE_DEFS.filter(d => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q) || d.category.includes(q));
  }, [paletteSearch]);

  const grouped = useMemo(() => {
    const g: Record<string, NodeDef[]> = {};
    for (const d of filteredDefs) {
      (g[d.category] ??= []).push(d);
    }
    return g;
  }, [filteredDefs]);

  const stats = useMemo(() => {
    const triggerCount = nodes.filter(n => NODE_DEF_MAP[n.data.defId as string]?.category === "trigger").length;
    const actionCount = nodes.filter(n => NODE_DEF_MAP[n.data.defId as string]?.category === "action").length;
    const conditionCount = nodes.filter(n => NODE_DEF_MAP[n.data.defId as string]?.category === "condition").length;
    // Rough estimate: triggers 0s, actions 2s, conditions 0.5s, delays counted separately
    let estSeconds = actionCount * 2 + conditionCount * 0.5;
    nodes.forEach(n => {
      if (n.data.defId === "wait_delay") {
        const cfg = n.data.config as Record<string, string>;
        const dur = parseFloat(cfg.duration || "0");
        const unit = cfg.unit || "minutes";
        if (unit === "minutes") estSeconds += dur * 60;
        else if (unit === "hours") estSeconds += dur * 3600;
        else if (unit === "days") estSeconds += dur * 86400;
      }
    });
    const estTime = estSeconds < 60 ? `${Math.round(estSeconds)}s` : estSeconds < 3600 ? `${Math.round(estSeconds / 60)}m` : `${(estSeconds / 3600).toFixed(1)}h`;
    return { total: nodes.length, connections: edges.length, triggers: triggerCount, estTime };
  }, [nodes, edges]);

  // ── Callbacks ──
  const onConnect = useCallback((connection: Connection) => {
    pushHistory();
    setEdges(eds => addEdge({ ...connection, animated: true, style: { stroke: "#C9A84C", strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: "#C9A84C", width: 16, height: 16 } }, eds));
  }, [setEdges, pushHistory]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Delete node via custom event from node component
  const deleteHandler = useCallback((e: Event) => {
    const nodeId = (e as CustomEvent).detail.nodeId;
    pushHistory();
    setNodes(ns => ns.filter(n => n.id !== nodeId));
    setEdges(es => es.filter(e2 => e2.source !== nodeId && e2.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [pushHistory, setNodes, setEdges, selectedNodeId]);

  // Register delete listener
  useState(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("workflow-delete-node", deleteHandler);
    return () => window.removeEventListener("workflow-delete-node", deleteHandler);
  });

  // Drag from palette
  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const defId = e.dataTransfer.getData("application/workflow-node");
    if (!defId || !NODE_DEF_MAP[defId]) return;
    pushHistory();
    const reactFlowBounds = (e.target as HTMLElement).closest(".react-flow")?.getBoundingClientRect();
    if (!reactFlowBounds) return;
    const x = e.clientX - reactFlowBounds.left - 100;
    const y = e.clientY - reactFlowBounds.top - 40;
    const newNode: Node = { id: makeId(), type: "workflow", position: { x, y }, data: { defId, config: {} } };
    setNodes(ns => [...ns, newNode]);
    toast.success(`Added ${NODE_DEF_MAP[defId].label}`);
  }, [pushHistory, setNodes]);

  // Auto layout
  const autoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    pushHistory();
    // Simple topological layout
    const sorted: Node[] = [];
    const visited = new Set<string>();
    const sourceSet = new Set(edges.map(e2 => e2.source));
    const targetSet = new Set(edges.map(e2 => e2.target));
    // Start with root nodes (sources that are not targets)
    const roots = nodes.filter(n => sourceSet.has(n.id) && !targetSet.has(n.id));
    const orphans = nodes.filter(n => !sourceSet.has(n.id) && !targetSet.has(n.id));

    function walk(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (node) sorted.push(node);
      edges.filter(e2 => e2.source === nodeId).forEach(e2 => walk(e2.target));
    }
    [...roots, ...nodes.filter(n => !roots.includes(n) && !orphans.includes(n))].forEach(n => walk(n.id));
    orphans.forEach(n => { if (!visited.has(n.id)) sorted.push(n); });
    // Also add any remaining
    nodes.forEach(n => { if (!visited.has(n.id)) sorted.push(n); });

    setNodes(sorted.map((n, i) => ({
      ...n,
      position: { x: 300, y: i * 140 },
    })));
    toast.success("Layout applied");
  }, [nodes, edges, pushHistory, setNodes]);

  // Config update
  const updateNodeConfig = useCallback((key: string, value: string) => {
    if (!selectedNodeId) return;
    setNodes(ns => ns.map(n => {
      if (n.id !== selectedNodeId) return n;
      return { ...n, data: { ...n.data, config: { ...(n.data.config as Record<string, string>), [key]: value } } };
    }));
  }, [selectedNodeId, setNodes]);

  // Load template
  const loadTemplate = useCallback((tpl: Template) => {
    pushHistory();
    // Remap IDs to be unique
    const idMap: Record<string, string> = {};
    const newNodes = tpl.nodes.map(n => {
      const newId = makeId();
      idMap[n.id] = newId;
      return { ...n, id: newId };
    });
    const newEdges = tpl.edges.map(e2 => ({
      ...e2,
      id: `e_${idMap[e2.source]}_${idMap[e2.target]}`,
      source: idMap[e2.source],
      target: idMap[e2.target],
    }));
    // Use React Flow instance methods to ensure internal store is updated
    reactFlowInstance.setNodes(newNodes);
    reactFlowInstance.setEdges(newEdges);
    setWorkflowName(tpl.name);
    setShowTemplates(false);
    setSelectedNodeId(null);
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
    toast.success(`Loaded "${tpl.name}"`);
  }, [pushHistory, reactFlowInstance]);

  // Save workflow
  const saveWorkflow = useCallback(() => {
    const payload = { name: workflowName, nodes, edges };
    // In production this would go to Supabase
    console.log("Saving workflow:", payload);
    toast.success("Workflow saved");
  }, [workflowName, nodes, edges]);

  // Simulation
  const runSimulation = useCallback(async () => {
    if (nodes.length === 0) { toast.error("Add nodes first"); return; }
    setSimulating(true);
    simulationRef.current = true;

    // Build execution order
    const visited = new Set<string>();
    const order: string[] = [];
    const targetSet = new Set(edges.map(e2 => e2.target));
    const roots = nodes.filter(n => !targetSet.has(n.id));

    function walk(nodeId: string) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      order.push(nodeId);
      edges.filter(e2 => e2.source === nodeId).forEach(e2 => walk(e2.target));
    }
    roots.forEach(n => walk(n.id));
    // Add any unvisited
    nodes.forEach(n => { if (!visited.has(n.id)) order.push(n.id); });

    for (const nodeId of order) {
      if (!simulationRef.current) break;
      setNodes(ns => ns.map(n => ({
        ...n,
        data: { ...n.data, _simActive: n.id === nodeId },
      })));
      await new Promise(r => setTimeout(r, 700));
    }

    // Clear simulation
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, _simActive: false } })));
    setSimulating(false);
    simulationRef.current = false;
    toast.success("Simulation complete");
  }, [nodes, edges, setNodes]);

  const stopSimulation = useCallback(() => {
    simulationRef.current = false;
    setSimulating(false);
    setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, _simActive: false } })));
  }, [setNodes]);

  // ── Keyboard shortcuts ──
  useState(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); saveWorkflow(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="fade-in flex flex-col">
      <PageHero
        className="mb-3"
        icon={<GitBranch size={28} />}
        title="Workflow Builder"
        subtitle="Build automations without code. Drag, drop, done."
        gradient="purple"
      />
    <div className="flex flex-col h-[calc(100vh-14rem)]">
      {/* ── Top Toolbar ── */}
      <div className="shrink-0 h-11 border-b border-border bg-surface flex items-center px-3 gap-2">
        <Zap size={16} className="text-gold" />
        {editingName ? (
          <input
            autoFocus
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => e.key === "Enter" && setEditingName(false)}
            className="bg-surface-light border border-border rounded px-2 py-0.5 text-sm font-semibold text-foreground outline-none focus:border-gold/40 w-52"
          />
        ) : (
          <button onClick={() => setEditingName(true)} className="text-sm font-semibold text-foreground hover:text-gold transition-colors truncate max-w-[200px]">
            {workflowName}
          </button>
        )}

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={saveWorkflow} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-foreground hover:bg-surface-light transition-colors" title="Save (Ctrl+S)">
          <Save size={13} /> Save
        </button>

        {simulating ? (
          <button onClick={stopSimulation} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
            <Eye size={13} /> Stop
          </button>
        ) : (
          <button onClick={runSimulation} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Run Simulation">
            <Play size={13} /> Test
          </button>
        )}

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={undo} disabled={!canUndo} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
          <Undo2 size={14} />
        </button>
        <button onClick={redo} disabled={!canRedo} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors disabled:opacity-30 disabled:cursor-not-allowed" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={14} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={autoLayout} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-muted hover:text-foreground hover:bg-surface-light transition-colors" title="Auto Layout">
          <LayoutGrid size={13} /> Layout
        </button>

        <div className="flex-1" />

        <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors">
          <LayoutTemplate size={13} /> Templates
        </button>
      </div>

      {/* ── Main Area ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── Left Sidebar: Node Palette ── */}
        <div className="shrink-0 w-[250px] border-r border-border bg-surface overflow-y-auto">
          <div className="p-3">
            <div className="relative mb-3">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={paletteSearch}
                onChange={e => setPaletteSearch(e.target.value)}
                placeholder="Search nodes..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-light border border-border text-xs text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition-colors"
              />
            </div>

            {(["trigger", "action", "condition", "output"] as const).map(cat => {
              const items = grouped[cat];
              if (!items || items.length === 0) return null;
              const collapsed = collapsedCategories[cat];
              const colors = CATEGORY_COLORS[cat];
              return (
                <div key={cat} className="mb-3">
                  <button
                    onClick={() => setCollapsedCategories(p => ({ ...p, [cat]: !p[cat] }))}
                    className="flex items-center gap-1.5 w-full text-[10px] font-semibold uppercase tracking-wider text-muted hover:text-foreground mb-1.5 transition-colors"
                  >
                    {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {CATEGORY_LABELS[cat]}
                    <span className="ml-auto text-muted/50 font-normal normal-case">{items.length}</span>
                  </button>
                  {!collapsed && (
                    <div className="space-y-1">
                      {items.map(def => (
                        <div
                          key={def.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData("application/workflow-node", def.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          className={`
                            flex items-center gap-2 px-2.5 py-2 rounded-lg border border-transparent cursor-grab active:cursor-grabbing
                            hover:bg-surface-light hover:border-border transition-all text-left group
                          `}
                        >
                          <GripVertical size={10} className="text-muted/30 group-hover:text-muted/60 shrink-0" />
                          <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${colors.bg} ${colors.text}`}>
                            {def.icon}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-foreground truncate">{def.label}</div>
                            <div className="text-[10px] text-muted/60 truncate">{def.description}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Center: React Flow Canvas ── */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            snapToGrid
            snapGrid={[20, 20]}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#C9A84C", strokeWidth: 1.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: "#C9A84C", width: 16, height: 16 },
            }}
            style={{ background: "var(--color-background, #0a0a0f)" }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border, #1e1e2e)" />
            <Controls
              showInteractive={false}
              className="!bg-surface !border-border !rounded-xl !shadow-lg [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-muted [&>button:hover]:!text-foreground [&>button:hover]:!bg-surface-light"
            />
            <MiniMap
              nodeColor={() => "#C9A84C"}
              maskColor="rgba(0,0,0,0.3)"
              className="!bg-surface !border-border !rounded-xl"
              pannable
              zoomable
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-32 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
                    <Zap size={24} className="text-gold" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Build your workflow</h3>
                  <p className="text-[11px] text-muted max-w-[240px] mx-auto mb-4">Drag nodes from the left panel onto the canvas, or start with a template.</p>
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 transition-colors"
                  >
                    <LayoutTemplate size={14} /> Browse Templates
                  </button>
                </div>
              </Panel>
            )}
          </ReactFlow>

          {/* Simulation overlay */}
          {simulating && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 backdrop-blur-sm z-10">
              <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
              <span className="text-[11px] font-medium text-gold">Simulating workflow...</span>
              <button onClick={stopSimulation} className="text-[10px] text-muted hover:text-foreground ml-2">Stop</button>
            </div>
          )}
        </div>

        {/* ── Right Panel: Node Config ── */}
        {selectedNode && selectedDef && (
          <div className="shrink-0 w-[300px] border-l border-border bg-surface overflow-y-auto">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[selectedDef.category].bg} ${CATEGORY_COLORS[selectedDef.category].text}`}>
                    {selectedDef.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-foreground">{selectedDef.label}</div>
                    <div className="text-[10px] text-muted capitalize">{selectedDef.category} node</div>
                  </div>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
                  <X size={14} />
                </button>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted mb-4 leading-relaxed">{selectedDef.description}</p>

              {/* Config fields */}
              {configFields.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Settings size={10} /> Configuration
                  </div>
                  {configFields.map(field => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-medium text-foreground mb-1">{field.label}</label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={(selectedNode.data.config as Record<string, string>)[field.key] || ""}
                          onChange={e => updateNodeConfig(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-border text-xs text-foreground placeholder:text-muted/40 outline-none focus:border-gold/40 transition-colors resize-none"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={(selectedNode.data.config as Record<string, string>)[field.key] || ""}
                          onChange={e => updateNodeConfig(field.key, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-border text-xs text-foreground outline-none focus:border-gold/40 transition-colors"
                        >
                          <option value="">Select...</option>
                          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={(selectedNode.data.config as Record<string, string>)[field.key] || ""}
                          onChange={e => updateNodeConfig(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-light border border-border text-xs text-foreground placeholder:text-muted/40 outline-none focus:border-gold/40 transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted/60 italic">No configuration needed for this node.</div>
              )}

              {/* Node actions */}
              <div className="mt-6 pt-4 border-t border-border space-y-2">
                <button
                  onClick={() => {
                    pushHistory();
                    const cloned: Node = {
                      id: makeId(),
                      type: "workflow",
                      position: { x: selectedNode.position.x + 30, y: selectedNode.position.y + 30 },
                      data: { ...structuredClone(selectedNode.data) },
                    };
                    setNodes(ns => [...ns, cloned]);
                    toast.success("Node duplicated");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] text-muted hover:text-foreground hover:bg-surface-light transition-colors"
                >
                  <Copy size={12} /> Duplicate Node
                </button>
                <button
                  onClick={() => {
                    pushHistory();
                    setNodes(ns => ns.filter(n => n.id !== selectedNodeId));
                    setEdges(es => es.filter(e2 => e2.source !== selectedNodeId && e2.target !== selectedNodeId));
                    setSelectedNodeId(null);
                    toast.success("Node deleted");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={12} /> Delete Node
                </button>
              </div>

              {/* Node ID */}
              <div className="mt-4 pt-3 border-t border-border">
                <div className="text-[10px] text-muted/40 font-mono">ID: {selectedNode.id}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Stats Bar ── */}
      <div className="shrink-0 h-8 border-t border-border bg-surface flex items-center px-4 gap-4 text-[10px] text-muted">
        <span className="flex items-center gap-1"><Zap size={10} className="text-gold" /> {stats.total} nodes</span>
        <span className="flex items-center gap-1"><Link2 size={10} /> {stats.connections} connections</span>
        <span className="flex items-center gap-1"><ArrowRight size={10} /> {stats.triggers} trigger{stats.triggers !== 1 ? "s" : ""}</span>
        <span className="flex items-center gap-1"><Clock size={10} /> Est. {stats.estTime}</span>
        <div className="flex-1" />
        <span className="text-muted/40">Snap: 20px</span>
      </div>

      {/* ── Template Gallery Modal ── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTemplates(false)} />
          <div className="relative w-full max-w-3xl mx-4 bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <LayoutTemplate size={16} className="text-gold" /> Workflow Templates
                </h2>
                <p className="text-[11px] text-muted mt-0.5">Start with a pre-built workflow and customize it to your needs.</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Template grid */}
            <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} className="group rounded-xl border border-border bg-surface-light/50 hover:border-gold/30 transition-all p-4 cursor-pointer" onClick={() => loadTemplate(tpl)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                      <Zap size={16} className="text-gold" />
                    </div>
                    <span className="text-[10px] text-muted bg-surface px-2 py-0.5 rounded-full border border-border">{tpl.nodeCount} nodes</span>
                  </div>
                  <h3 className="text-xs font-semibold text-foreground mb-1">{tpl.name}</h3>
                  <p className="text-[10px] text-muted leading-relaxed mb-3">{tpl.description}</p>

                  {/* Node type pills */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tpl.nodes.slice(0, 4).map(n => {
                      const d = NODE_DEF_MAP[n.data.defId as string];
                      if (!d) return null;
                      const c = CATEGORY_COLORS[d.category];
                      return (
                        <span key={n.id} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md ${c.bg} ${c.text}`}>
                          {d.icon} {d.label}
                        </span>
                      );
                    })}
                    {tpl.nodes.length > 4 && (
                      <span className="text-[9px] text-muted/50 px-1 py-0.5">+{tpl.nodes.length - 4} more</span>
                    )}
                  </div>

                  <button className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold bg-gold/10 text-gold border border-gold/20 group-hover:bg-gold/20 transition-colors">
                    <Play size={11} /> Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Page AI ── */}
      <PageAI
        pageName="Workflow Builder"
        context="Visual drag-and-drop workflow builder for chaining triggers, actions, conditions, and outputs. Users can create automations like lead nurture sequences, booking confirmations, content pipelines, and more."
        suggestions={[
          "How do I connect a trigger to an action?",
          "What node should I use to delay a step?",
          "Help me build a lead follow-up workflow",
          "How does the AI Call node work with ElevenAgents?",
        ]}
      />
    </div>
    </div>
  );
}
