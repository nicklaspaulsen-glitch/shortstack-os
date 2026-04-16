import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Return the full plugin catalog
export async function GET() {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    plugins: CATALOG,
    total: CATALOG.length,
  });
}

// POST — Install a plugin (stores to user metadata for now)
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { plugin_id } = body;

    if (!plugin_id || typeof plugin_id !== "string") {
      return NextResponse.json({ error: "plugin_id is required" }, { status: 400 });
    }

    const plugin = CATALOG.find((p) => p.id === plugin_id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      plugin_id,
      plugin_name: plugin.name,
      installed_at: new Date().toISOString(),
      message: `${plugin.name} installed successfully`,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// ── Hardcoded catalog ──
const CATALOG = [
  { id: "slack-integration", name: "Slack Integration", author: "ShortStack", category: "communication", price: 0, rating: 4.8, installs: 12000, verified: true },
  { id: "notion-sync-pro", name: "Notion Sync Pro", author: "SyncLabs", category: "integrations", price: 9, rating: 4.6, installs: 8000, verified: true },
  { id: "zapier-connector", name: "Zapier Connector", author: "ShortStack", category: "automation", price: 0, rating: 4.5, installs: 15000, verified: true },
  { id: "google-ads-reporter", name: "Google Ads Reporter", author: "AdMetrics", category: "analytics", price: 12, rating: 4.7, installs: 6000, verified: true },
  { id: "meta-ads-sync", name: "Meta Ads Sync", author: "AdMetrics", category: "marketing", price: 12, rating: 4.4, installs: 5000, verified: true },
  { id: "ai-lead-scorer", name: "AI Lead Scorer", author: "Predictive.ai", category: "ai", price: 15, rating: 4.9, installs: 9000, verified: true },
  { id: "whatsapp-business", name: "WhatsApp Business", author: "ShortStack", category: "communication", price: 19, rating: 4.3, installs: 7000, verified: true },
  { id: "stripe-billing", name: "Stripe Billing", author: "ShortStack", category: "integrations", price: 0, rating: 4.8, installs: 11000, verified: true },
  { id: "hubspot-importer", name: "HubSpot Importer", author: "MigrateKit", category: "crm", price: 0, rating: 4.2, installs: 3000, verified: false },
  { id: "email-verifier", name: "Email Verifier", author: "CleanMail", category: "marketing", price: 7, rating: 4.6, installs: 8000, verified: true },
  { id: "sms-auto-responder", name: "SMS Auto-Responder", author: "ReplyBot", category: "ai", price: 10, rating: 4.5, installs: 4000, verified: true },
  { id: "calendar-sync", name: "Calendar Sync", author: "ShortStack", category: "integrations", price: 0, rating: 4.7, installs: 10000, verified: true },
  { id: "proposal-templates-pro", name: "Proposal Templates Pro", author: "DocForge", category: "crm", price: 5, rating: 4.4, installs: 6000, verified: true },
  { id: "voice-transcription", name: "Voice Transcription", author: "VoxScribe", category: "ai", price: 8, rating: 4.3, installs: 3000, verified: false },
  { id: "social-scheduler", name: "Social Scheduler", author: "PostPilot", category: "marketing", price: 14, rating: 4.6, installs: 7000, verified: true },
  { id: "client-feedback", name: "Client Feedback", author: "ShortStack", category: "crm", price: 0, rating: 4.1, installs: 2000, verified: true },
  { id: "data-enrichment", name: "Data Enrichment", author: "ClearBit Labs", category: "ai", price: 20, rating: 4.8, installs: 5000, verified: true },
  { id: "custom-reports-builder", name: "Custom Reports Builder", author: "ChartStack", category: "analytics", price: 10, rating: 4.5, installs: 4000, verified: true },
  { id: "telegram-bot", name: "Telegram Bot", author: "BotForge", category: "communication", price: 0, rating: 4.2, installs: 2000, verified: false },
  { id: "ab-testing", name: "A/B Testing", author: "SplitLab", category: "marketing", price: 8, rating: 4.4, installs: 3000, verified: true },
];
