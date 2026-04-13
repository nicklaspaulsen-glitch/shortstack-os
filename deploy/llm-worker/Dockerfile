FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install vLLM and dependencies
RUN pip install --no-cache-dir \
    runpod \
    vllm \
    transformers \
    accelerate

# Pre-download model weights at build time
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('meta-llama/Llama-3.1-8B-Instruct')"

COPY handler.py /app/handler.py

CMD ["python", "-u", "/app/handler.py"]
