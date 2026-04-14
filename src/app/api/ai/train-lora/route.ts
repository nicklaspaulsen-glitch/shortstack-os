import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

/**
 * LoRA Training — Fine-tune Stable Diffusion with client brand imagery on RunPod.
 * Upload 10-20 reference images → train a LoRA → use it for on-brand generation.
 * Training takes ~15-30 min on A40/A100.
 * Requires: Business or Unlimited plan.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = checkAiRateLimit(user.id);
  if (limited) return limited;

  // Check plan — LoRA training is Business+ only
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();

  const tier = profile?.plan_tier || "Starter";
  if (!["Business", "Unlimited"].includes(tier)) {
    return NextResponse.json({
      error: "LoRA training requires Business or Unlimited plan",
      upgrade_url: "/dashboard/pricing",
    }, { status: 403 });
  }

  const formData = await request.formData();
  const action = (formData.get("action") as string) || "train"; // train | status | list
  const clientId = formData.get("client_id") as string | null;
  const loraName = (formData.get("name") as string) || "custom-style";
  const triggerWord = (formData.get("trigger_word") as string) || "sks style";
  const trainingSteps = parseInt(formData.get("steps") as string) || 1500;
  const learningRate = parseFloat(formData.get("lr") as string) || 1e-4;
  const resolution = parseInt(formData.get("resolution") as string) || 1024;

  const loraUrl = process.env.RUNPOD_LORA_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;

  if (!loraUrl || !runpodKey) {
    return NextResponse.json({ error: "LoRA training not configured" }, { status: 500 });
  }

  try {
    if (action === "list") {
      // List existing LoRAs for this user
      const { data: loras } = await supabase
        .from("lora_models")
        .select("id, name, trigger_word, status, client_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return NextResponse.json({ loras: loras || [] });
    }

    if (action === "train") {
      // Collect training images from form data
      const images: string[] = [];
      const captions: string[] = [];
      let idx = 0;

      while (true) {
        const img = formData.get(`image_${idx}`) as File | null;
        if (!img) break;

        const buffer = Buffer.from(await img.arrayBuffer());
        images.push(buffer.toString("base64"));

        const caption = formData.get(`caption_${idx}`) as string | null;
        captions.push(caption || `${triggerWord}, high quality`);
        idx++;
      }

      // Also accept image URLs
      const imageUrls = formData.get("image_urls") as string | null;
      if (imageUrls) {
        try {
          const urls = JSON.parse(imageUrls) as string[];
          for (const url of urls) {
            images.push(url); // RunPod handler can accept URLs too
            captions.push(`${triggerWord}, high quality`);
          }
        } catch { /* ignore parse error */ }
      }

      if (images.length < 5) {
        return NextResponse.json({
          error: `Need at least 5 training images (got ${images.length}). 10-20 recommended.`,
        }, { status: 400 });
      }

      // Launch training job
      const res = await fetch(`${loraUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            images,
            captions,
            trigger_word: triggerWord,
            training_steps: Math.min(Math.max(trainingSteps, 500), 5000),
            learning_rate: learningRate,
            resolution,
            lora_rank: 32,
            base_model: "stabilityai/stable-diffusion-xl-base-1.0",
            save_name: loraName,
          },
        }),
      });

      const job = await res.json();

      // Save training record
      if (job.id) {
        await supabase.from("lora_models").insert({
          user_id: user.id,
          client_id: clientId,
          name: loraName,
          trigger_word: triggerWord,
          runpod_job_id: job.id,
          status: "training",
          config: {
            steps: trainingSteps,
            lr: learningRate,
            resolution,
            image_count: images.length,
          },
        });
      }

      return NextResponse.json({
        success: true,
        job_id: job.id,
        status: "training",
        estimated_time: `~${Math.ceil(trainingSteps / 100)} minutes`,
        message: `Training LoRA "${loraName}" with ${images.length} images. You'll be notified when complete.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — Check training status
export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get("job_id");

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!jobId) {
    // List user's LoRAs
    const { data: loras } = await supabase
      .from("lora_models")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return NextResponse.json({ loras: loras || [] });
  }

  const loraUrl = process.env.RUNPOD_LORA_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!loraUrl || !runpodKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${loraUrl}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${runpodKey}` },
    });
    const data = await res.json();

    if (data.status === "COMPLETED" && data.output) {
      // Update DB record
      await supabase
        .from("lora_models")
        .update({
          status: "ready",
          lora_url: data.output.lora_url || data.output.safetensors_url,
        })
        .eq("runpod_job_id", jobId)
        .eq("user_id", user.id);

      return NextResponse.json({
        status: "completed",
        lora_url: data.output.lora_url || data.output.safetensors_url,
        message: "LoRA ready! You can now use it for generation.",
      });
    }

    if (data.status === "FAILED") {
      await supabase
        .from("lora_models")
        .update({ status: "failed" })
        .eq("runpod_job_id", jobId)
        .eq("user_id", user.id);

      return NextResponse.json({
        status: "failed",
        error: data.error || "Training failed",
      });
    }

    return NextResponse.json({
      status: data.status?.toLowerCase() || "training",
      progress: data.output?.progress || null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
