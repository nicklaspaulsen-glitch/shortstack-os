"""
RunPod Serverless Handler for Higgsfield Video Generation
Deploy: docker build + push to Docker Hub, then create RunPod serverless endpoint
"""

import runpod
import torch
import os
import uuid
import boto3
from diffusers import DiffusionPipeline, DPMSolverMultistepScheduler

# Load model on cold start
MODEL_ID = os.getenv("MODEL_ID", "damo-vilab/text-to-video-ms-1.7b")
S3_BUCKET = os.getenv("S3_BUCKET", "")
S3_REGION = os.getenv("S3_REGION", "us-east-1")

pipe = None

def load_model():
    global pipe
    if pipe is not None:
        return pipe

    pipe = DiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        variant="fp16",
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.enable_model_cpu_offload()
    pipe.enable_vae_slicing()
    return pipe


def upload_video(frames, fps=8):
    """Export frames to mp4 and upload to S3/R2, return public URL."""
    from diffusers.utils import export_to_video

    video_id = str(uuid.uuid4())
    local_path = f"/tmp/{video_id}.mp4"
    export_to_video(frames, local_path, fps=fps)

    if S3_BUCKET:
        s3 = boto3.client("s3", region_name=S3_REGION)
        key = f"videos/{video_id}.mp4"
        s3.upload_file(local_path, S3_BUCKET, key, ExtraArgs={"ContentType": "video/mp4"})
        url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}"
    else:
        # Return base64 if no S3 configured
        import base64
        with open(local_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        url = f"data:video/mp4;base64,{b64}"

    os.remove(local_path)
    return url, video_id


def handler(job):
    """RunPod serverless handler — receives generation requests."""
    input_data = job["input"]

    prompt = input_data.get("prompt", "A beautiful sunset over the ocean")
    negative_prompt = input_data.get("negative_prompt", "blurry, low quality, distorted, watermark")
    num_frames = input_data.get("num_frames", 24)
    num_inference_steps = input_data.get("num_inference_steps", 25)
    guidance_scale = input_data.get("guidance_scale", 7.5)
    width = input_data.get("width", 512)
    height = input_data.get("height", 512)
    fps = input_data.get("fps", 8)

    # Map aspect ratio to dimensions if provided
    aspect_ratio = input_data.get("aspect_ratio", "")
    if aspect_ratio == "9:16":
        width, height = 384, 672
    elif aspect_ratio == "16:9":
        width, height = 672, 384
    elif aspect_ratio == "1:1":
        width, height = 512, 512
    elif aspect_ratio == "4:5":
        width, height = 448, 560

    # Cap frames to avoid OOM
    num_frames = min(num_frames, 120)

    model = load_model()

    video_frames = model(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_frames=num_frames,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        width=width,
        height=height,
    ).frames[0]

    url, video_id = upload_video(video_frames, fps=fps)

    return {
        "id": video_id,
        "url": url,
        "status": "completed",
        "frames": num_frames,
        "dimensions": f"{width}x{height}",
    }


runpod.serverless.start({"handler": handler})
