# Transcription Setup

ShortStack OS uses a unified transcription router that picks the best
available provider per request. Three providers are supported:

| Provider | Speed | Diarization | Cost | When to use |
| --- | --- | --- | --- | --- |
| `runpod_whisperx` | ~1x realtime | Yes (pyannote 3.1) | Free at GPU-cost | Sales calls + meetings where speaker labels matter |
| `runpod_faster_whisper` | ~4x realtime | No | Free at GPU-cost | General transcription, single-speaker recordings |
| `openai_whisper` | ~3x realtime | No | $0.006/min | Fallback when RunPod isn't configured |

Provider selection logic (`src/lib/transcription/router.ts`):

1. If `diarize: true` and `RUNPOD_WHISPERX_ENDPOINT` is set → WhisperX.
2. Else if `RUNPOD_FASTER_WHISPER_ENDPOINT` is set → faster-whisper.
3. Else fall through to OpenAI Whisper API.

If no provider is configured, the router throws and the caller surfaces a
501 to the UI with a configure-provider hint.

## Required environment variables

| Name | Required for | Notes |
| --- | --- | --- |
| `RUNPOD_FASTER_WHISPER_ENDPOINT` | faster-whisper | RunPod serverless URL, e.g. `https://api.runpod.ai/v2/<endpoint-id>` |
| `RUNPOD_FASTER_WHISPER_API_KEY` | faster-whisper | RunPod account API key |
| `RUNPOD_WHISPERX_ENDPOINT` | WhisperX | Separate endpoint — pyannote ships in the worker image |
| `RUNPOD_WHISPERX_API_KEY` | WhisperX | Same RunPod account or a different one |
| `OPENAI_API_KEY` | Fallback | Already set for the existing Whisper path |
| `CRON_SECRET` | Cron poller | Already set — same secret protects every cron route |

The legacy `RUNPOD_WHISPER_URL` / `RUNPOD_API_KEY` env pair used by
`src/lib/meetings/whisper-runpod.ts` is still read by that older helper but
new code paths route through the new abstraction. Keep both during the
transition; the new router doesn't read the legacy names.

## RunPod template suggestions

### faster-whisper

Community template: `runpod-workers/worker-faster_whisper`.
- GPU: RTX A4000 / A5000 / A6000 — A5000 is the sweet spot.
- Container disk: 20 GB.
- Network: idle timeout 5 s, max workers 3 to start.
- Required model: `large-v3` (downloaded on first warm-up).

Expected request:

```json
{
  "input": {
    "audio_url": "https://signed-url.example.com/audio.mp3",
    "language": "en",
    "model": "large-v3",
    "task": "transcribe",
    "return_timestamps": true,
    "word_timestamps": false
  }
}
```

Expected response:

```json
{
  "status": "COMPLETED",
  "output": {
    "text": "Full transcript text…",
    "language": "en",
    "duration": 312.5,
    "segments": [
      { "start": 0.0, "end": 3.4, "text": "Hi there.", "avg_logprob": -0.21 }
    ]
  }
}
```

### WhisperX

Template: a community-maintained `worker-whisperx`. Adjust for the version
you pick — most accept the same input shape with `diarize: true`.

- GPU: RTX 3090 minimum (24 GB VRAM). Diarization OOMs on T4/A10 for
  meetings longer than ~30 minutes.
- Container disk: 30 GB.
- Required env in the worker: `HUGGINGFACE_TOKEN` for an account that has
  accepted the TOS for `pyannote/speaker-diarization-3.1`. Without this
  token the diarization step fails silently and returns segments without
  speaker labels.

Expected request:

```json
{
  "input": {
    "audio_url": "https://signed-url.example.com/audio.mp3",
    "language": "en",
    "model": "large-v3",
    "task": "transcribe",
    "diarize": true,
    "min_speakers": 1,
    "max_speakers": 3,
    "return_timestamps": true,
    "word_timestamps": false
  }
}
```

Expected response:

```json
{
  "status": "COMPLETED",
  "output": {
    "text": "Full transcript text…",
    "language": "en",
    "duration": 312.5,
    "segments": [
      {
        "start": 0.0,
        "end": 3.4,
        "text": "Hi there, thanks for jumping on.",
        "speaker": "SPEAKER_00",
        "avg_logprob": -0.18
      },
      {
        "start": 3.5,
        "end": 5.2,
        "text": "No problem.",
        "speaker": "SPEAKER_01"
      }
    ]
  }
}
```

The router preserves the `SPEAKER_xx` labels on
`meetings.transcript_speaker_labeled` so the AI Sales Coach can compute
diarized talk-ratio metrics. The lowest-numbered speaker is treated as the
rep — sales calls dialed from the dashboard always have the rep speak first
(greeting → pitch), so the heuristic holds in practice.

## Async / cold-start path

Both RunPod endpoints return a job id when the cold-start time exceeds the
runsync timeout. The router surfaces the job id on `TranscribeResult.job_id`
and the calling route persists a `transcription_jobs` row. Every minute,
`/api/cron/poll-transcription-jobs` polls pending jobs and writes the
finished transcript back to the source table.

Rows in `transcription_jobs` look like:

| Column | Notes |
| --- | --- |
| `agency_owner_id` | RLS scope — owner can read their own jobs |
| `source_table` | `meetings` or `voice_calls` |
| `source_id` | The row to update on completion |
| `provider` | `runpod_faster_whisper` / `runpod_whisperx` / `openai_whisper` |
| `provider_job_id` | The id RunPod gave us |
| `status` | `queued` / `processing` / `completed` / `failed` |
| `attempts` | Increment per poll; gives up at 15 (~15 min) |
| `result` | Full `TranscribeResult` jsonb on success |
| `error_message` | Truncated reason on failure |

## Cost notes

- RunPod GPU-second billing is amortised across all agents in the worker
  pool. The router reports `cost_usd: 0` for RunPod providers so the meeting
  / call cost field stays clean for OpenAI-fallback runs.
- OpenAI Whisper API is billed at $0.006/min, surfaced as `cost_usd` on
  both the result and the `meetings.cost_usd` column.

## Migrating callers

Existing call sites that already used `transcribeAudio` from
`src/lib/meetings/whisper-runpod.ts` keep working — that helper is still
imported by `src/lib/meetings/whisper.ts` for the upload path. New code
should import from `@/lib/transcription/router`:

```ts
import { transcribe } from "@/lib/transcription/router";

const result = await transcribe({
  audioUrl: meeting.audio_url,
  diarize: true,
  speakerCountHint: 2,
  userId: user.id,
  context: "/api/meetings/[id]/transcribe",
});
```

The `result` shape is provider-agnostic — segments include `speaker` only
when WhisperX served the request.
