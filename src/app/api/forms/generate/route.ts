import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_SONNET,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

export const maxDuration = 60;

type FormType =
  | "contact"
  | "signup"
  | "survey"
  | "booking"
  | "application"
  | "feedback"
  | "quote"
  | "custom";

type FieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea"
  | "date"
  | "file";

interface FormGenerateInput {
  description: string;
  form_type?: FormType;
  fields_count?: number;
}

interface FieldValidation {
  pattern?: string;
  min?: number;
  max?: number;
  custom_message?: string;
}

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: FieldValidation;
}

interface FormGenerateOutput {
  name: string;
  title: string;
  description: string;
  fields: FormField[];
  submit_button_text: string;
  success_message: string;
  confirmation_email?: string;
}

const SYSTEM_PROMPT = `You are a form design expert who builds high-converting, accessible, well-validated forms for lead capture, onboarding, and surveys. You generate well-structured forms that maximize completion rates.

FORM PRINCIPLES
1. Ask for the minimum viable information. Every required field costs completion rate.
2. Order fields from easiest (name, email) to highest-friction (phone, open text) last.
3. Use the right input type: email for email, phone for phone, date for dates, select for 5+ mutually exclusive options, radio for 2-4.
4. Labels are short and specific. Placeholders show format, not replace the label.
5. Mark required fields honestly — don't over-require.
6. Validation: add regex patterns only when they genuinely help (email, phone). Provide custom_message when a pattern is present.
7. For select/radio/checkbox fields, provide sensible options.

FIELD TYPES
text, email, phone, number, select, radio, checkbox, textarea, date, file

ID CONVENTION
Use lowercase snake_case ids, stable and unique within the form (first_name, email, budget_range, etc.)

SUCCESS MESSAGE
Warm, specific, set expectations ("We'll reply within one business day.")

CONFIRMATION_EMAIL (optional)
If the form type warrants a confirmation email (contact, quote, booking, application), draft a short plain-text confirmation body the system can send to the submitter. Otherwise omit.

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary):
{
  "name": "<short internal name>",
  "title": "<visible form title>",
  "description": "<one or two sentence form description>",
  "fields": [
    {
      "id": "first_name",
      "type": "text",
      "label": "First name",
      "placeholder": "Alex",
      "required": true,
      "options": null,
      "validation": null
    }
  ],
  "submit_button_text": "<CTA text>",
  "success_message": "<message>",
  "confirmation_email": "<plain text or omit>"
}`;

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: FormGenerateInput;
  try {
    body = (await request.json()) as FormGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const formType = body.form_type ?? "custom";
  const fieldsCount = body.fields_count && body.fields_count > 0
    ? Math.min(20, body.fields_count)
    : undefined;

  const userPrompt = `Generate a form.

FORM TYPE: ${formType}
DESCRIPTION: ${body.description}
${fieldsCount ? `TARGET FIELD COUNT: ${fieldsCount}` : "Use the minimum number of fields needed."}

JSON only.`;

  const ALLOWED_FIELD_TYPES: FieldType[] = [
    "text", "email", "phone", "number", "select", "radio", "checkbox", "textarea", "date", "file",
  ];

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 3000,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<FormGenerateOutput>(text);

    if (!parsed || !Array.isArray(parsed.fields)) {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const usedIds = new Set<string>();
    const fields: FormField[] = parsed.fields
      .filter(
        (f): f is FormField =>
          !!f &&
          typeof f.label === "string" &&
          typeof f.type === "string" &&
          ALLOWED_FIELD_TYPES.includes(f.type as FieldType)
      )
      .map((f, idx) => {
        let id = (f.id || f.label)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 40) || `field_${idx + 1}`;
        let i = 1;
        const base = id;
        while (usedIds.has(id)) {
          id = `${base}_${i++}`;
        }
        usedIds.add(id);

        const needsOptions = ["select", "radio", "checkbox"].includes(f.type);
        return {
          id,
          type: f.type,
          label: f.label.trim(),
          placeholder: f.placeholder?.trim() || undefined,
          required: Boolean(f.required),
          options: needsOptions && Array.isArray(f.options)
            ? f.options.slice(0, 20).map((o) => String(o).trim()).filter(Boolean)
            : undefined,
          validation: f.validation && typeof f.validation === "object"
            ? {
              pattern: f.validation.pattern?.trim() || undefined,
              min: typeof f.validation.min === "number" ? f.validation.min : undefined,
              max: typeof f.validation.max === "number" ? f.validation.max : undefined,
              custom_message: f.validation.custom_message?.trim() || undefined,
            }
            : undefined,
        };
      });

    const out: FormGenerateOutput = {
      name: parsed.name?.trim() || `${formType} form`,
      title: parsed.title?.trim() || parsed.name?.trim() || "Contact us",
      description: parsed.description?.trim() || "",
      fields,
      submit_button_text: parsed.submit_button_text?.trim() || "Submit",
      success_message: parsed.success_message?.trim() || "Thanks! We'll be in touch soon.",
      confirmation_email: parsed.confirmation_email?.trim() || undefined,
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_form_generate",
      description: `Form generated: ${out.name}`,
      profile_id: user.id,
      status: "completed",
      result: {
        form_type: formType,
        field_count: out.fields.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[forms/generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate form", detail: message },
      { status: 500 }
    );
  }
}
