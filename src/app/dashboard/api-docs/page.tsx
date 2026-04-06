"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  BookOpen, ChevronDown, ChevronRight, Code, Copy,
  Shield, Users, FileText, Share2, Mail, Key, Globe, Bot, Monitor
} from "lucide-react";
import toast from "react-hot-toast";

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  description: string;
  body?: string;
  response?: string;
}

interface Category {
  name: string;
  icon: React.ReactNode;
  endpoints: Endpoint[];
}

const API_CATEGORIES: Category[] = [
  {
    name: "Auth",
    icon: <Shield size={13} className="text-yellow-400" />,
    endpoints: [
      {
        method: "POST", path: "/api/auth/reset-password",
        description: "Send a password reset email to the user",
        body: '{ "email": "user@example.com" }',
        response: '{ "message": "Password reset email sent" }',
      },
    ],
  },
  {
    name: "Clients",
    icon: <Users size={13} className="text-blue-400" />,
    endpoints: [
      {
        method: "GET", path: "/api/admin/switch-client",
        description: "List all clients available for switching",
        response: '{ "clients": [{ "id": "...", "business_name": "..." }] }',
      },
      {
        method: "POST", path: "/api/admin/switch-client",
        description: "Switch the active client context",
        body: '{ "client_id": "uuid" }',
        response: '{ "message": "Switched to client", "client": { ... } }',
      },
      {
        method: "POST", path: "/api/clients/invite",
        description: "Invite a new client to the platform via email",
        body: '{ "email": "client@biz.com", "business_name": "Acme Inc" }',
        response: '{ "message": "Invitation sent", "client_id": "uuid" }',
      },
      {
        method: "POST", path: "/api/clients/privacy",
        description: "Export or delete client data for GDPR compliance",
        body: '{ "client_id": "uuid", "action": "export" | "delete" }',
        response: '{ "message": "Data exported", "download_url": "..." }',
      },
    ],
  },
  {
    name: "Content",
    icon: <FileText size={13} className="text-purple-400" />,
    endpoints: [
      {
        method: "POST", path: "/api/content/generate",
        description: "Generate social media content with AI",
        body: '{ "topic": "Product launch", "platform": "instagram", "tone": "professional" }',
        response: '{ "content": "...", "hashtags": [...], "media_suggestions": [...] }',
      },
      {
        method: "POST", path: "/api/content/advanced-script",
        description: "Generate a long-form video script with hooks and CTAs",
        body: '{ "topic": "...", "duration": 60, "style": "educational" }',
        response: '{ "script": "...", "hooks": [...], "cta": "..." }',
      },
      {
        method: "POST", path: "/api/content/viral-research",
        description: "Research trending content and viral patterns in a niche",
        body: '{ "niche": "fitness", "platform": "tiktok" }',
        response: '{ "trends": [...], "hooks": [...], "analysis": "..." }',
      },
    ],
  },
  {
    name: "Social",
    icon: <Share2 size={13} className="text-pink-400" />,
    endpoints: [
      {
        method: "GET", path: "/api/social/connect",
        description: "List connected social media accounts",
        response: '{ "accounts": [{ "platform": "instagram", "handle": "@..." }] }',
      },
      {
        method: "POST", path: "/api/social/connect",
        description: "Connect a new social media account via OAuth",
        body: '{ "platform": "instagram", "access_token": "..." }',
        response: '{ "message": "Account connected", "account_id": "..." }',
      },
      {
        method: "DELETE", path: "/api/social/connect",
        description: "Disconnect a social media account",
        body: '{ "account_id": "uuid" }',
        response: '{ "message": "Account disconnected" }',
      },
      {
        method: "POST", path: "/api/social/post",
        description: "Publish content to connected social accounts",
        body: '{ "content": "...", "platforms": ["instagram", "tiktok"], "media_url": "..." }',
        response: '{ "posted": [{ "platform": "instagram", "post_id": "..." }] }',
      },
      {
        method: "POST", path: "/api/social/generate-week",
        description: "Auto-generate a full week of social content",
        body: '{ "client_id": "uuid", "themes": ["tips", "promo"] }',
        response: '{ "calendar": [{ "day": "Monday", "posts": [...] }] }',
      },
    ],
  },
  {
    name: "Outreach",
    icon: <Mail size={13} className="text-green-400" />,
    endpoints: [
      {
        method: "POST", path: "/api/outreach/email",
        description: "Generate and queue an AI-written outreach email",
        body: '{ "lead_id": "uuid", "template": "intro", "personalize": true }',
        response: '{ "email": { "subject": "...", "body": "..." }, "queued": true }',
      },
      {
        method: "POST", path: "/api/outreach/send-now",
        description: "Immediately send a prepared outreach message",
        body: '{ "outreach_id": "uuid" }',
        response: '{ "message": "Sent", "status": "delivered" }',
      },
    ],
  },
  {
    name: "License",
    icon: <Key size={13} className="text-orange-400" />,
    endpoints: [
      {
        method: "POST", path: "/api/license/validate",
        description: "Validate a license key and return entitlements",
        body: '{ "license_key": "SS-XXXX-XXXX" }',
        response: '{ "valid": true, "tier": "pro", "expires_at": "..." }',
      },
      {
        method: "POST", path: "/api/license/checkout",
        description: "Create a Stripe checkout session for a license",
        body: '{ "tier": "pro", "billing": "monthly" }',
        response: '{ "checkout_url": "https://checkout.stripe.com/..." }',
      },
    ],
  },
  {
    name: "Websites",
    icon: <Globe size={13} className="text-cyan-400" />,
    endpoints: [
      {
        method: "POST", path: "/api/websites/generate",
        description: "Generate a full website with AI (HTML/CSS/JS)",
        body: '{ "business_name": "...", "industry": "...", "style": "modern" }',
        response: '{ "html": "...", "preview_url": "..." }',
      },
      {
        method: "POST", path: "/api/websites/deploy",
        description: "Deploy a generated website to a live URL",
        body: '{ "website_id": "uuid", "domain": "example.com" }',
        response: '{ "live_url": "https://...", "status": "deployed" }',
      },
    ],
  },
  {
    name: "Agents",
    icon: <Bot size={13} className="text-gold" />,
    endpoints: [
      {
        method: "POST", path: "/api/agents/chief",
        description: "Chat with the Chief AI Agent for system oversight",
        body: '{ "message": "Show me today\'s performance", "history": [] }',
        response: '{ "response": "...", "data": { ... } }',
      },
      {
        method: "POST", path: "/api/agents/train",
        description: "Train a custom AI agent with specific knowledge",
        body: '{ "agent_name": "...", "training_data": "...", "personality": "..." }',
        response: '{ "agent_id": "uuid", "status": "trained" }',
      },
    ],
  },
  {
    name: "Other",
    icon: <Monitor size={13} className="text-muted" />,
    endpoints: [
      {
        method: "GET", path: "/api/app/version",
        description: "Get the current app version and update info",
        response: '{ "version": "1.2.0", "download_url": "...", "required": false }',
      },
      {
        method: "POST", path: "/api/tts",
        description: "Convert text to speech using ElevenLabs",
        body: '{ "text": "Hello world", "voice_id": "..." }',
        response: "audio/mpeg binary stream",
      },
    ],
  },
];

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-green-500/15 text-green-400 border-green-500/20",
  POST: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/20",
};

export default function ApiDocsPage() {
  useAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedEndpoints, setExpandedEndpoints] = useState<Record<string, boolean>>({});

  function toggleSection(name: string) {
    setExpandedSections(prev => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleEndpoint(key: string) {
    setExpandedEndpoints(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function copyPath(path: string) {
    navigator.clipboard.writeText(path);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <BookOpen size={18} className="text-gold" /> API Documentation
        </h1>
        <p className="text-xs text-muted mt-0.5">Complete reference for all ShortStack OS API endpoints</p>
      </div>

      {/* Overview Card */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Code size={13} className="text-gold" />
          <p className="text-xs font-semibold">Base URL</p>
        </div>
        <div className="bg-black/30 rounded-lg p-2.5 font-mono text-xs text-gold">
          https://your-domain.com
        </div>
        <p className="text-[10px] text-muted mt-2">
          All endpoints require authentication via Supabase session cookie unless marked as public.
          Requests should include <code className="text-gold/70 bg-gold/5 px-1 rounded">Content-Type: application/json</code> header.
        </p>
      </div>

      {/* Method Legend */}
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${METHOD_STYLES.GET}`}>GET</span>
        <span className="text-[10px] text-muted">Read data</span>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${METHOD_STYLES.POST}`}>POST</span>
        <span className="text-[10px] text-muted">Create / Action</span>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${METHOD_STYLES.DELETE}`}>DELETE</span>
        <span className="text-[10px] text-muted">Remove</span>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {API_CATEGORIES.map(cat => {
          const isOpen = expandedSections[cat.name] !== false; // default open
          return (
            <div key={cat.name} className="card overflow-hidden">
              {/* Category Header */}
              <button onClick={() => toggleSection(cat.name)}
                className="w-full flex items-center gap-2.5 p-3 hover:bg-white/[0.02] transition-colors">
                {isOpen ? <ChevronDown size={13} className="text-muted" /> : <ChevronRight size={13} className="text-muted" />}
                {cat.icon}
                <span className="text-xs font-semibold">{cat.name}</span>
                <span className="text-[10px] text-muted ml-auto">{cat.endpoints.length} endpoint{cat.endpoints.length !== 1 ? "s" : ""}</span>
              </button>

              {/* Endpoints */}
              {isOpen && (
                <div className="border-t border-border/10">
                  {cat.endpoints.map((ep, i) => {
                    const epKey = `${cat.name}-${i}`;
                    const isExpanded = expandedEndpoints[epKey];
                    return (
                      <div key={epKey} className="border-b border-border/5 last:border-b-0">
                        <button onClick={() => toggleEndpoint(epKey)}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left">
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${METHOD_STYLES[ep.method]}`}>
                            {ep.method}
                          </span>
                          <span className="text-xs font-mono text-white/80 truncate">{ep.path}</span>
                          <span className="text-[10px] text-muted ml-auto shrink-0 hidden sm:block">{ep.description}</span>
                          <Copy size={11} className="text-muted shrink-0 hover:text-gold transition-colors"
                            onClick={(e) => { e.stopPropagation(); copyPath(ep.path); }} />
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-3 space-y-2">
                            <p className="text-[10px] text-muted sm:hidden">{ep.description}</p>
                            {ep.body && (
                              <div>
                                <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Request Body</p>
                                <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-green-300 overflow-x-auto">
                                  {ep.body}
                                </pre>
                              </div>
                            )}
                            {ep.response && (
                              <div>
                                <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Response</p>
                                <pre className="bg-black/30 rounded-lg p-2.5 text-[10px] font-mono text-blue-300 overflow-x-auto">
                                  {ep.response}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
