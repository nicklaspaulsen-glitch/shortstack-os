import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * POST /api/voice-receptionist/setup
 *
 * Backs the First-Call Wizard on /dashboard/voice-receptionist. Three
 * possible operations on a single client row, gated by the caller's
 * ownership of that client:
 *
 *   { client_id, action: "save_twilio", twilio_phone_number: "+1..." }
 *     → Persists the Twilio number on clients.twilio_phone_number.
 *
 *   { client_id, action: "create_agent" }
 *     → Calls ElevenLabs ConvAI to create a starter agent with a
 *       sensible business-aware persona, then writes the agent_id to
 *       clients.eleven_agent_id. Idempotent — if eleven_agent_id is
 *       already set we just return it.
 *
 * All actions verify the caller's tenant owns the client_id (matches
 * the cross-tenant defense pattern from f29606e + 0129004).
 *
 * Security fix (service-client-audit.md — CRITICAL):
 *   - auth.getUser() is now called FIRST, before any service client is created.
 *   - Ownership check uses getEffectiveOwnerId() so team_members resolve to
 *     their parent agency (previously `client.profile_id !== user.id` locked
 *     out all team_members).
 *   - createServiceClient() is only called AFTER identity + ownership are confirmed.
 */
export async function POST(request: NextRequest) {
  // Auth first — resolve identity before touching any privileged client.
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !body.client_id || !body.action) {
    return NextResponse.json(
      { error: "client_id and action are required" },
      { status: 400 },
    );
  }

  const clientId = String(body.client_id);
  const action = String(body.action);

  // Resolve effective owner so team_members are treated as their parent agency.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  // Verify ownership via the user-scoped client (RLS enforced); only create the
  // service client after ownership is confirmed.
  const { data: clientCheck } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (!clientCheck) {
    return NextResponse.json(
      { error: "Client not found in your workspace" },
      { status: 404 },
    );
  }

  // Ownership confirmed — safe to use the service client for privileged reads/writes.
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select(
      "id, profile_id, business_name, twilio_phone_number, eleven_agent_id",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return NextResponse.json(
      { error: "Client not found in your workspace" },
      { status: 404 },
    );
  }

  if (action === "save_twilio") {
    const num = String(body.twilio_phone_number || "").trim();
    if (!num) {
      return NextResponse.json(
        { error: "twilio_phone_number is required" },
        { status: 400 },
      );
    }
    // Light validation — allow any non-empty string but warn on obvious junk.
    // Twilio E.164 format starts with + and has 8-15 digits total.
    const e164ish = /^\+?\d[\d\s-]{6,20}$/.test(num);
    if (!e164ish) {
      return NextResponse.json(
        { error: "twilio_phone_number must be a valid phone number (e.g. +15551234567)" },
        { status: 400 },
      );
    }
    const { error: updErr } = await service
      .from("clients")
      .update({ twilio_phone_number: num })
      .eq("id", clientId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, twilio_phone_number: num });
  }

  if (action === "create_agent") {
    // Idempotent — return existing agent_id if already set.
    if (client.eleven_agent_id) {
      return NextResponse.json({
        success: true,
        agent_id: client.eleven_agent_id,
        existed: true,
      });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured" },
        { status: 503 },
      );
    }

    // Sensible default persona for an agency-style receptionist.
    const businessName = client.business_name || "the business";
    const systemPrompt = `You are the AI voice receptionist for ${businessName}. Your job is to:
  1. Greet callers warmly and professionally.
  2. Identify why they're calling — sales lead, support, existing customer, spam.
  3. For sales leads: capture name, phone, email if possible, and what they're looking for.
  4. For support: take a clear description of the issue.
  5. For appointment requests: get the requested day/time and confirm it's plausible.
  6. Hand off to a human if the caller asks, or if the call is high-value.
  7. End with: "Someone will be in touch shortly. Thank you for calling ${businessName}."

Keep responses short and natural. Don't sound like a phone tree. If you don't know something, say so honestly.`;

    const firstMessage = `Hi, thanks for calling ${businessName}. How can I help you today?`;

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${businessName} — Receptionist`,
          conversation_config: {
            agent: {
              prompt: { prompt: systemPrompt },
              first_message: firstMessage,
              language: "en",
            },
            tts: {
              // Rachel — warm professional default. User can change in
              // /dashboard/voice-receptionist later.
              voice_id: "21m00Tcm4TlvDq8ikWAM",
            },
            max_duration_seconds: 300,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `ElevenLabs create failed: ${res.status} ${text.slice(0, 200)}` },
          { status: 502 },
        );
      }

      const data = await res.json();
      const agentId = data.agent_id || data.id;
      if (!agentId) {
        return NextResponse.json(
          { error: "ElevenLabs response missing agent_id" },
          { status: 502 },
        );
      }

      const { error: updErr } = await service
        .from("clients")
        .update({ eleven_agent_id: agentId })
        .eq("id", clientId);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }

      // Trinity log so the activity feed shows the wire-up
      await service.from("trinity_log").insert({
        action_type: "voice_receptionist",
        description: `Voice receptionist created for ${businessName}`,
        status: "completed",
        metadata: { client_id: clientId, agent_id: agentId, source: "first_call_wizard" },
      });

      return NextResponse.json({ success: true, agent_id: agentId });
    } catch (err) {
      return NextResponse.json(
        { error: `Agent creation failed: ${(err as Error).message}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
