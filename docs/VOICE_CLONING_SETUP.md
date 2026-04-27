# Voice Studio — Setup Guide

The Voice Studio surface (`/dashboard/voice-studio`) lets agency owners
clone their own voice (or a client / team-member voice with consent) and
route the resulting audio into:

- Cold dialer opening lines (pre-rendered, played as the call's first turn)
- Voicemail drops (TwiML `<Play>` from the rendered MP3)
- SMS voice messages (Twilio MMS audio attachment, with carrier fallback to text)
- Social DM voice notes (Instagram + Telegram wired today; WhatsApp + LinkedIn
  stubbed)

There are two execution paths — **free open-source** and **premium** — and the
router auto-picks the right one based on which env vars are configured. You
can run both in parallel and override per-clone.

## TL;DR

- Easy path: set `ELEVENLABS_API_KEY` only. Voice Studio works immediately
  ($22/100k chars, ~$0.18/clone-render).
- Free path: deploy F5-TTS to RunPod, set the env vars below. Cost is
  dominated by GPU-second billing (~$0.0003/sec audio).
- Both: set both. The router prefers RunPod for synthesis (cheap), and uses
  ElevenLabs for the preset library.

## Provider order

| Priority | Provider          | Env vars                                                      | Cost    | Notes                                  |
| -------- | ----------------- | ------------------------------------------------------------- | ------- | -------------------------------------- |
| 1        | F5-TTS (RunPod)   | `RUNPOD_F5TTS_ENDPOINT`, `RUNPOD_F5TTS_API_KEY`               | ~$0     | Best zero-shot quality, < 5s synth.    |
| 2        | OpenVoice (RunPod)| `RUNPOD_OPENVOICE_ENDPOINT`, `RUNPOD_OPENVOICE_API_KEY`       | ~$0     | Emotion-controllable; smaller model.   |
| 3        | XTTS (RunPod)     | `RUNPOD_XTTS_URL`, `RUNPOD_XTTS_API_KEY` (or `RUNPOD_API_KEY`)| ~$0     | Already used elsewhere in repo.        |
| 4        | ElevenLabs        | `ELEVENLABS_API_KEY` (or `XI_API_KEY`)                        | $0.00018/char | Premium fallback + powers presets. |

The 10 preset voices in `src/lib/voice/preset-library.ts` are ElevenLabs
public voice IDs (Aria, Roger, Sarah, Adam, Antoni, Charlotte, Daniel, Josh,
Bella, Rachel). Presets always require `ELEVENLABS_API_KEY`. If you only
deploy RunPod, the My Voices tab works fully but the Presets tab is dark.

## RunPod F5-TTS deployment (free path)

F5-TTS is the recommended free open-source provider. Zero-shot voice
cloning, sub-second inference for short clips on a 4090, and the public
serverless template ships ready-to-go.

1. **RunPod console** → Serverless → New Endpoint.
2. Select template `swivid/f5-tts:latest` (community template — search "f5
   tts"). If not present, build one from the
   [F5-TTS reference repo](https://github.com/SWivid/F5-TTS) using
   `runpod/serverless-base:0.4.0` as the base image.
3. **GPU**: RTX 4090 (24GB) — works for English / multilingual. A6000 if
   you want spare capacity for 30s+ samples.
4. **Network volume**: optional. Add a 50GB volume if you want to keep
   trained voice fingerprints across cold starts (otherwise re-extracted
   on demand from the R2 sample URL).
5. **Workers**: min 0, max 1 → 3 depending on agency volume. Cold start is
   ~12s on this template.
6. After "Create endpoint", grab the **Endpoint URL** and an **API key**.
7. In Vercel project env (Production + Preview):

   ```bash
   RUNPOD_F5TTS_ENDPOINT=https://api.runpod.ai/v2/<your-endpoint>
   RUNPOD_F5TTS_API_KEY=<your-runpod-key>
   ```

8. Redeploy. The `/dashboard/voice-studio` page now shows F5-TTS in the
   provider chip on every clone you train.

### F5-TTS request shape

The router sends:

```json
{
  "input": {
    "operation": "clone" | "synthesize",
    "speaker_wav": "<presigned R2 URL>",
    "ref_audio":  "<presigned R2 URL>",
    "samples":    ["<R2 URL 1>", "<R2 URL 2>"],
    "text":       "<text to synth>",
    "language":   "en",
    "speed":      1.0
  }
}
```

The worker should return `{ status: "COMPLETED", output: { audio_base64? | url? | speaker_id? } }`.
If you adapt a different template, make sure these field names line up — or
edit `src/lib/voice/runpod-clone.ts` accordingly.

## OpenVoice (alternative free path)

Same deployment shape. Useful when you want emotion control on top of voice
cloning. Set:

```bash
RUNPOD_OPENVOICE_ENDPOINT=https://api.runpod.ai/v2/<endpoint>
RUNPOD_OPENVOICE_API_KEY=<key>
```

Reference template: [`myshell-ai/OpenVoice`](https://github.com/myshell-ai/OpenVoice).

## XTTS (alternative free path)

Already configured if you set `RUNPOD_XTTS_URL` for the existing TTS
synthesis pipeline. Voice Studio reuses the same endpoint via the
`runpod_xtts` provider.

## ElevenLabs (paid premium path)

If you already have `ELEVENLABS_API_KEY` set, you're done — Voice Studio
uses it automatically for both:

- Instant Voice Cloning (when no RunPod endpoint is available)
- Preset library playback

Cost reference: $22/month for 100k chars on Creator tier (~$0.18 per 1k chars).

## R2 (required either way)

Voice samples and rendered audio are stored in Cloudflare R2 — same bucket
the rest of ShortStack uses. These env vars must already be set:

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_S3_ENDPOINT
R2_BUCKET_NAME       # shortstack-cdn
R2_PUBLIC_URL        # https://cdn.shortstack.cloud
```

Sample uploads go to `voice-samples/<owner_id>/<ts>-<i>-<filename>`.
Rendered audio goes to `voice-renders/<owner_id>/<clone_id>/<text-hash>.mp3`.

## Cron — RunPod job polling

`*/2 * * * *` → `/api/cron/voice-clone-poll`

Polls every `voice_clones.status='training'` row backed by a RunPod
provider and flips it to `ready` / `failed` once the worker finishes.
F5-TTS often returns `ready` synchronously during training, so this cron
mostly handles slower XTTS-style endpoints.

`CRON_SECRET` is the auth shared with every other ShortStack cron.

## Consent gates

Three values for `voice_clones.consent_kind`:

- `self` — the cloning user is also the voice owner. No additional payload.
- `team_member_signed` — a team member signed off. Required: `consent_evidence`
  with `signed_by` + `signed_at`.
- `client_signed` — an agency client signed off. Same payload as above.

The API route rejects signed-consent submissions without evidence (400).
Presets are seeded with `consent_kind='preset'` and skip these checks.

## TCPA disclosure

The dialer voice picker exposes a "TCPA disclosure spoken" checkbox. When
checked, the metadata flag `tcpa_accepted=true` is persisted on the
`voice_calls.metadata` JSON. This is the audit trail for your compliance
review — it doesn't currently change call flow but it's there for the day
the FCC asks.

## Surface defaults

Each clone has five default flags:

- `is_default_for_user` — overall default
- `is_default_for_dialer`
- `is_default_for_voicemail`
- `is_default_for_sms`
- `is_default_for_dm`

When you toggle a surface flag on a clone, every other clone for the same
agency has the corresponding flag cleared (single-default invariant). The
"Use my default" option in the picker resolves to:
1. surface-specific default for this owner
2. fallback to `is_default_for_user`
3. fallback to first preset row

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Clone trains as `failed` with "elevenlabs requires inline sample buffers" | RunPod isn't configured; the API tried to fall back to ElevenLabs but the form upload didn't include the buffers. Fix by setting `RUNPOD_F5TTS_ENDPOINT` or by re-uploading. |
| Synthesise returns 500 with "RunPod x synth incomplete: IN_PROGRESS" | The RunPod worker took longer than 120s. F5-TTS is the fastest open model — try shorter text or warm the worker first. |
| Preset playback returns 500 | `ELEVENLABS_API_KEY` not set (presets are ElevenLabs voices). |
| MMS voice send fails on certain numbers | Carrier-dependent. Pass `fallback_text` so the route sends a plain SMS when MMS audio is rejected. |
| Telegram DM returns 400 with "chat not found" | Make sure the recipient has `/start`-ed your bot at least once — Telegram bots can't initiate chats. |

## What's not in v1 (but the abstraction is ready)

- WhatsApp Business voice — needs an approved Media Template; the
  `sendVoiceDm()` router stubs the path so adding it later is one branch.
- LinkedIn voice DMs — LinkedIn's API doesn't expose them. The router
  returns `unsupported: true` with a clear UI message.
- Live conversational voice on cold calls — that's Pipecat / ElevenLabs
  Convai territory. Voice Studio just pre-renders the opening line; the
  bridge to a live conversational agent is a separate phase.
- Voice editing / waveform trim UI — record + upload + waveform preview is
  v1; trimming, denoising, EQ are deferred.
