FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install dependencies
RUN pip install --no-cache-dir \
    runpod \
    diffusers[torch] \
    transformers \
    accelerate \
    safetensors \
    boto3 \
    imageio[ffmpeg] \
    opencv-python-headless

# Pre-download model weights at build time (faster cold starts)
RUN python -c "from diffusers import DiffusionPipeline; DiffusionPipeline.from_pretrained('damo-vilab/text-to-video-ms-1.7b', torch_dtype='auto')"

COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
