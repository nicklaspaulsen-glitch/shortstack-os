---
description: End-to-end Voice Receptionist test runbook. Verifies Twilio → voice-webhook → ElevenLabs ConvAI → /api/webhooks/elevenlabs → voice_calls + trinity_log pipeline.
---

# /voice-test

You are about to walk the user through (or autonomously verify) the Voice Receptionist pipeline end-to-end.

## Pre-flight checks (do these first; report a checklist)

1. **Production env vars set?** Use Vercel MCP to verify (or just instruct the user):
   - `TWILIO_AUTH_TOKEN` — required for signature validation
   - `XI_API_KEY` — required to fetch ElevenLabs signed WebSocket URLs
   - `ELEVENLABS_WEBHOOK_SECRET` — required for HMAC verification (fail-closed in prod)

2. **Database state:** Use `mcp__8fb03bb5-...__execute_sql` to confirm:
   ```sql
   -- A test client exists with both phone and eleven_agent_id wired
   SELECT id, business_name, phone, eleven_agent_id
   FROM clients
   WHERE eleven_agent_id IS NOT NULL
   LIMIT 5;

   -- voice_calls table has the eleven_conversation_id column (migration applied)
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'voice_calls' AND column_name = 'eleven_conversation_id';
   ```

3. **ElevenLabs agent** has the webhook URL configured to point at `https://app.shortstack.work/api/webhooks/elevenlabs`. Verify in the user's ElevenLabs platform settings.

4. **Twilio number** has VoiceUrl set to `https://app.shortstack.work/api/twilio/voice-webhook?client_id=<id>` (or just the unhinted URL — voice-webhook resolves by To number first).

## The test call

If the user is at their phone:
1. Tell them to call the Twilio number for a test client.
2. Start watching `voice_calls` rows in real-time:
   ```sql
   SELECT id, twilio_call_sid, eleven_conversation_id, status, outcome, started_at
   FROM voice_calls
   ORDER BY started_at DESC
   LIMIT 5;
   ```
   Run this every 10 seconds during/after the call.

3. Expected progression:
   - **t=0**: voice-webhook fires, voice_calls row created with status="ringing"
   - **t=2s**: status-callback fires, status flips to "in-progress"
   - **t=15-60s**: agent talks, user talks, agent ends call
   - **t=conversation-end**: status="completed", duration set
   - **t=webhook-delivery**: eleven_conversation_id populated, outcome set, transcript in metadata

4. Also watch `trinity_log`:
   ```sql
   SELECT description, metadata->>'outcome', metadata->>'duration_secs', created_at
   FROM trinity_log
   WHERE action_type IN ('lead_gen', 'voice_receptionist')
   ORDER BY created_at DESC LIMIT 5;
   ```

## Failure-mode triage

If something didn't fire, delegate to the **voice-receptionist-tracer** agent with the call_sid or conversation_id. It knows the entire pipeline.

Common failures:
- voice-webhook returns 403 → TWILIO_AUTH_TOKEN missing or wrong host
- TwiML returns dial-fallback instead of ConvAI bridge → client.eleven_agent_id is null
- voice_calls row never updates → status-callback URL not configured on Twilio number
- eleven_conversation_id stays null → ElevenLabs webhook URL not configured, or HMAC failing 401

## Reporting

End with a clear PASS / FAIL per stage:
- [ ] voice-webhook accepts the call (status=ringing row created)
- [ ] TwiML returned ConvAI bridge (not dial-fallback)
- [ ] ElevenLabs agent picked up (audio flowed)
- [ ] status-callback updated voice_calls (status=completed, duration set)
- [ ] webhook fired and updated voice_calls (outcome set, transcript saved)
- [ ] trinity_log entry created
