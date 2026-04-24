// hyperframes-worker - a minimal Express shim intended to run on a RunPod
// pod (or any long-lived node host). It accepts composition HTML + metadata,
// renders it to MP4 via `npx hyperframes render`, uploads the MP4 to
// Supabase Storage, and POSTs back to the callback URL with the public URL.
//
// Why not Vercel: hyperframes needs headless Chrome + FFmpeg which exceed
// Vercel serverless function limits (memory/time/binary size). A long-lived
// GPU-capable pod is the right home.
//
// Env vars:
//   PORT                            listen port (default 8080)
//   WORKER_SECRET                   bearer token the ShortStack API must send
//   SUPABASE_URL                    Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY       service role key for uploads
//   SUPABASE_STORAGE_BUCKET         bucket to upload renders into
//                                   (default 'hyperframes-renders')

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 8080;
const WORKER_SECRET = process.env.WORKER_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "hyperframes-renders";

function requireAuth(req, res, next) {
  if (!WORKER_SECRET) return next(); // dev mode
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, worker: "hyperframes" });
});

app.post("/render", requireAuth, async (req, res) => {
  const {
    render_id,
    composition_id,
    html_source,
    duration_seconds,
    fps,
    width,
    height,
    callback_url,
    callback_secret,
  } = req.body || {};

  if (!render_id || !html_source || !callback_url) {
    return res.status(400).json({
      error: "render_id, html_source, and callback_url are required",
    });
  }

  // Acknowledge immediately - render runs async so the HTTP call doesn't hang
  res.status(202).json({ accepted: true, render_id });

  renderJob({
    render_id,
    composition_id,
    html_source,
    duration_seconds,
    fps,
    width,
    height,
    callback_url,
    callback_secret,
  }).catch((err) => {
    console.error("[hyperframes-worker] Job failed:", err);
  });
});

async function renderJob(job) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "hf-"));
  const htmlPath = path.join(workDir, "composition.html");
  const outPath = path.join(workDir, "output.mp4");

  try {
    await fs.writeFile(htmlPath, job.html_source, "utf8");

    // Run `npx hyperframes render <html> -o <mp4>`
    const args = ["hyperframes", "render", htmlPath, "-o", outPath];
    if (job.fps) args.push("--fps", String(job.fps));
    if (job.width) args.push("--width", String(job.width));
    if (job.height) args.push("--height", String(job.height));

    await runCmd("npx", args);

    const buf = await fs.readFile(outPath);
    const size = buf.length;

    // Upload to Supabase Storage
    let publicUrl = "";
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const objectKey = `${job.composition_id || "misc"}/${job.render_id}.mp4`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(objectKey, buf, {
          contentType: "video/mp4",
          upsert: true,
        });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectKey);
      publicUrl = pub.publicUrl;
    }

    await postback(job, {
      status: "complete",
      output_url: publicUrl,
      duration_seconds: job.duration_seconds,
      file_size_bytes: size,
    });
  } catch (err) {
    await postback(job, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
    throw err;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function postback(job, payload) {
  const res = await fetch(job.callback_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(job.callback_secret
        ? { Authorization: `Bearer ${job.callback_secret}` }
        : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Callback ${res.status}: ${body}`);
  }
}

function runCmd(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve(null);
      else reject(new Error(`${cmd} exited ${code}`));
    });
  });
}

app.listen(PORT, () => {
  console.log(`[hyperframes-worker] listening on :${PORT}`);
});
