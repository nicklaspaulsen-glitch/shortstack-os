"""
RunPod Serverless LLM Worker — replaces Claude API for routine AI tasks.
Uses vLLM with Llama 3.1 8B for fast, free inference.
Saves Claude tokens for complex agent tasks only.

Handles: social posts, ad copy, scripts, emails, lead scoring, content planning
"""

import runpod
import os

MODEL_ID = os.getenv("MODEL_ID", "meta-llama/Llama-3.1-8B-Instruct")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "4096"))

engine = None

def load_engine():
    global engine
    if engine is not None:
        return engine

    from vllm import LLM, SamplingParams
    engine = LLM(
        model=MODEL_ID,
        dtype="half",
        max_model_len=8192,
        gpu_memory_utilization=0.90,
        trust_remote_code=True,
    )
    return engine


def handler(job):
    """
    Compatible with OpenAI chat completions format.
    Input: { messages: [{role, content}], max_tokens, temperature, response_format }
    """
    from vllm import SamplingParams

    input_data = job["input"]
    messages = input_data.get("messages", [])
    max_tokens = min(input_data.get("max_tokens", 2000), MAX_TOKENS)
    temperature = input_data.get("temperature", 0.7)
    top_p = input_data.get("top_p", 0.9)
    json_mode = input_data.get("response_format", {}).get("type") == "json_object"

    # Build prompt from messages
    prompt_parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            prompt_parts.append(f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{content}<|eot_id|>")
        elif role == "user":
            prompt_parts.append(f"<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>")
        elif role == "assistant":
            prompt_parts.append(f"<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>")

    prompt_parts.append("<|start_header_id|>assistant<|end_header_id|>\n\n")

    if json_mode:
        prompt_parts[-1] = "<|start_header_id|>assistant<|end_header_id|>\n\n{"

    prompt = "".join(prompt_parts)

    llm = load_engine()
    sampling_params = SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        stop=["<|eot_id|>", "<|end_of_text|>"],
    )

    outputs = llm.generate([prompt], sampling_params)
    text = outputs[0].outputs[0].text.strip()

    if json_mode:
        text = "{" + text

    # Return in OpenAI-compatible format
    return {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": text,
            },
            "finish_reason": "stop",
        }],
        "model": MODEL_ID,
        "usage": {
            "prompt_tokens": len(prompt) // 4,
            "completion_tokens": len(text) // 4,
        },
    }


runpod.serverless.start({"handler": handler})
