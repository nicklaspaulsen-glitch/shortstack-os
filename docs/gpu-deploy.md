# GPU Model Deployment Guide (RunPod Serverless)

Deploy these 7 models on RunPod Serverless to power the AI Studio features.

## Prerequisites
- RunPod account with API key (`RUNPOD_API_KEY`)
- Each model runs as a **Serverless Endpoint** — you only pay when requests come in

---

## 1. Whisper V3 (Speech-to-Text)

**Docker Image:** `runpod/worker-whisper:latest`
**GPU:** Any (A40, A100, or 4090 — runs fast on all)
**Min Workers:** 0 | **Max Workers:** 3
**Idle Timeout:** 5s

```
Endpoint URL → RUNPOD_WHISPER_URL
```

Input format:
```json
{ "input": { "audio_url": "https://...", "model": "large-v3", "language": "en" } }
```

---

## 2. Real-ESRGAN (Image Upscaling)

**Docker Image:** `runpod/worker-real-esrgan:latest`
**GPU:** Any with 8GB+ VRAM
**Min Workers:** 0 | **Max Workers:** 2
**Idle Timeout:** 5s

```
Endpoint URL → RUNPOD_UPSCALE_URL
```

Input format:
```json
{ "input": { "image_url": "https://...", "scale": 4, "face_enhance": true } }
```

---

## 3. REMBG (Background Removal)

**Docker Image:** `runpod/worker-rembg:latest` or custom with SAM
**GPU:** Any with 4GB+ VRAM (CPU also works but slower)
**Min Workers:** 0 | **Max Workers:** 3
**Idle Timeout:** 5s

```
Endpoint URL → RUNPOD_REMBG_URL
```

Input format:
```json
{ "input": { "image_url": "https://...", "alpha_matting": true, "bg_color": null } }
```

---

## 4. Stable Video Diffusion (Image-to-Video)

**Docker Image:** Custom worker with SVD 1.1
**GPU:** A100 80GB or H100 (needs 40GB+ VRAM)
**Min Workers:** 0 | **Max Workers:** 1
**Idle Timeout:** 5s
**Execution Timeout:** 300s (video gen is slow)

```
Endpoint URL → RUNPOD_SVD_URL
```

Input format:
```json
{
  "input": {
    "image_url": "https://...",
    "motion_bucket_id": 127,
    "fps": 7,
    "num_frames": 25
  }
}
```

---

## 5. MusicGen (Music Generation)

**Docker Image:** Custom worker with facebook/musicgen-medium
**GPU:** Any with 16GB+ VRAM (A40, A100, 4090)
**Min Workers:** 0 | **Max Workers:** 2
**Idle Timeout:** 5s

```
Endpoint URL → RUNPOD_MUSICGEN_URL
```

Input format:
```json
{
  "input": {
    "prompt": "upbeat electronic music, energetic, 120 bpm",
    "duration": 15,
    "temperature": 1.0
  }
}
```

---

## 6. XTTS v2 (Voice Cloning + TTS)

**Docker Image:** Custom worker with coqui/XTTS-v2
**GPU:** Any with 8GB+ VRAM
**Min Workers:** 0 | **Max Workers:** 2
**Idle Timeout:** 5s

```
Endpoint URL → RUNPOD_XTTS_URL
```

Two modes:

Clone voice:
```json
{ "input": { "mode": "clone", "audio_url": "https://sample.wav" } }
```

Generate speech:
```json
{
  "input": {
    "mode": "speak",
    "text": "Hello world",
    "speaker_embedding": { ... },
    "language": "en"
  }
}
```

---

## 7. LoRA Training (Fine-tuning)

**Docker Image:** Custom worker with kohya_ss or diffusers training
**GPU:** A100 80GB (training needs lots of VRAM)
**Min Workers:** 0 | **Max Workers:** 1
**Idle Timeout:** 5s
**Execution Timeout:** 3600s (training takes 15-60 min)

```
Endpoint URL → RUNPOD_LORA_URL
```

Input format:
```json
{
  "input": {
    "images": ["https://img1.jpg", "https://img2.jpg", ...],
    "trigger_word": "mymodel",
    "steps": 1500,
    "learning_rate": 0.0001
  }
}
```

---

## Quick Setup Steps

1. Go to [runpod.io/console/serverless](https://runpod.io/console/serverless)
2. Click **New Endpoint** for each model
3. Select the Docker image and GPU type listed above
4. Set Min Workers to **0** (scale to zero when idle — saves money)
5. Copy the Endpoint URL and paste into your `.env.local`
6. Test with: `curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT/run -H "Authorization: Bearer YOUR_API_KEY" -d '{"input":{...}}'`

## Cost Estimates (scale-to-zero)

| Model | GPU | Cost/hr | Avg Request |
|-------|-----|---------|-------------|
| Whisper | A40 | $0.39/hr | ~$0.01/min audio |
| ESRGAN | 4090 | $0.44/hr | ~$0.01/image |
| REMBG | 4090 | $0.44/hr | ~$0.005/image |
| SVD | A100-80 | $1.64/hr | ~$0.15/video |
| MusicGen | A40 | $0.39/hr | ~$0.02/track |
| XTTS | A40 | $0.39/hr | ~$0.01/generation |
| LoRA | A100-80 | $1.64/hr | ~$1-5/training |
