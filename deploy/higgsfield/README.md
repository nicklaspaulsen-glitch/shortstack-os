# Higgsfield Video Generation — RunPod Serverless

## Setup Steps

### 1. Build & Push Docker Image

```bash
cd deploy/higgsfield
docker build -t your-dockerhub/higgsfield-video:latest .
docker push your-dockerhub/higgsfield-video:latest
```

### 2. Create RunPod Serverless Endpoint

1. Go to https://www.runpod.io/console/serverless
2. Click **New Endpoint**
3. Settings:
   - **Container Image**: `your-dockerhub/higgsfield-video:latest`
   - **GPU**: RTX A5000 or RTX 4090 (16GB+ VRAM)
   - **Max Workers**: 1-3 (scale based on usage)
   - **Idle Timeout**: 30s (keeps model warm briefly)
   - **Execution Timeout**: 300s
4. Optional env vars:
   - `S3_BUCKET` — for video file storage (otherwise returns base64)
   - `S3_REGION` — AWS region for the bucket
   - `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — S3 credentials

### 3. Get Your Endpoint URL

After creating, RunPod gives you an endpoint ID like `abc123xyz`.
Your API URL is: `https://api.runpod.ai/v2/abc123xyz`

### 4. Set Environment Variables in Vercel

```
HIGGSFIELD_URL=https://api.runpod.ai/v2/YOUR_ENDPOINT_ID
RUNPOD_API_KEY=your_runpod_api_key
```

### 5. API Usage

The endpoint accepts POST requests:

```json
{
  "prompt": "A dog running through a field of flowers",
  "aspect_ratio": "9:16",
  "num_frames": 24,
  "guidance_scale": 7.5
}
```

Returns:
```json
{
  "id": "uuid",
  "url": "https://...",
  "status": "completed"
}
```
