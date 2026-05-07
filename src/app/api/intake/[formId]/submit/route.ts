import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAnthropic } from "@/lib/ai/claude-helpers";

function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

interface SubmitBody {
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  responses: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { formId: string } }
) {
  // 1. Validate form exists + is active
  const anon = anonClient();
  const { data: form, error: formErr } = await anon
    .from("intake_forms")
    .select("id, agency_owner_id, ai_qualification, ai_system_prompt, name, welcome_message")
    .eq("id", params.formId)
    .eq("is_active", true)
    .single();

  if (formErr || !form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  // 2. Parse body
  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // 3. Insert submission (public INSERT allowed via RLS)
  const service = serviceClient();
  const { data: submission, error: insertErr } = await service
    .from("intake_submissions")
    .insert({
      form_id: form.id,
      agency_owner_id: form.agency_owner_id,
      contact_name: body.contact_name ?? null,
      contact_email: body.contact_email ?? null,
      contact_phone: body.contact_phone ?? null,
      responses: body.responses ?? {},
      ip_address: ip,
      status: "new",
    })
    .select("id")
    .single();

  if (insertErr || !submission) {
    console.error("[intake/submit] insert failed", insertErr);
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }

  // 4. AI qualification (async — don't block the response)
  if (form.ai_qualification) {
    qualifyAsync(service, form, submission.id, body).catch((err) => {
      console.error("[intake/submit] async qualify failed", err);
    });
  }

  return NextResponse.json({ submissionId: submission.id, success: true });
}

async function qualifyAsync(
  service: ReturnType<typeof serviceClient>,
  form: {
    id: string;
    agency_owner_id: string;
    ai_system_prompt: string | null;
    name: string;
  },
  submissionId: string,
  body: SubmitBody
) {
  const anthropic = getAnthropic();

  const systemPrompt =
    form.ai_system_prompt ??
    `You are an expert lead qualifier for an agency called "${form.name}".
Analyze the prospect's responses and:
1. Rate their overall fit score from 0–100 (100 = perfect prospect)
2. Summarize their situation in 2-3 sentences
3. List 2-4 smart follow-up questions that would help qualify them further

Return ONLY valid JSON matching this exact shape:
{
  "score": <number 0-100>,
  "summary": "<string>",
  "questions": ["<q1>", "<q2>", "<q3>"]
}`;

  const userMsg = `Prospect info:
Name: ${body.contact_name ?? "Unknown"}
Email: ${body.contact_email ?? "Unknown"}
Phone: ${body.contact_phone ?? "Unknown"}

Their responses:
${Object.entries(body.responses)
  .map(([k, v]) => `${k}: ${String(v)}`)
  .join("\n")}`;

  let score = 50;
  let summary = "No AI analysis available.";
  let questions: string[] = [];

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
    // Extract JSON even if model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        score?: unknown;
        summary?: unknown;
        questions?: unknown;
      };
      score = typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : 50;
      summary = typeof parsed.summary === "string" ? parsed.summary : summary;
      questions = Array.isArray(parsed.questions)
        ? (parsed.questions as unknown[]).filter((q): q is string => typeof q === "string")
        : [];
    }
  } catch (err) {
    console.error("[intake/qualify] LLM call failed", err);
  }

  await service
    .from("intake_submissions")
    .update({ ai_score: score, ai_summary: summary, ai_questions: questions })
    .eq("id", submissionId);
}
