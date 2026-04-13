import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Poll RunPod job status for async video generation
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = request.nextUrl.searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const higgsUrl = process.env.HIGGSFIELD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!higgsUrl || !runpodKey) {
    return NextResponse.json({ error: "Higgsfield not configured" }, { status: 500 });
  }

  const res = await fetch(`${higgsUrl}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${runpodKey}` },
  });
  const job = await res.json();

  return NextResponse.json({
    job_id: jobId,
    status: job.status,
    url: job.output?.url || null,
    generation_id: job.output?.id || null,
  });
}
