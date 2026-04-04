import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Email Template Generator — Creates professional emails for any client situation
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { template_type, client_name, client_email, custom_context } = await request.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const templates: Record<string, string> = {
    welcome: `Write a warm welcome email for new client ${client_name}. Thank them for choosing ShortStack, outline next steps (onboarding call, portal access, timeline), and set expectations.`,
    invoice_reminder: `Write a friendly payment reminder email for ${client_name}. Be professional but not pushy. Mention the invoice is overdue and provide payment options.`,
    monthly_report: `Write an email to ${client_name} sharing their monthly performance report. Highlight key wins, mention areas of improvement, and tease next month's strategy.`,
    upsell: `Write a value-driven email to ${client_name} suggesting they upgrade their package. Reference their current results and show how additional services could accelerate growth.`,
    check_in: `Write a casual check-in email to ${client_name}. Ask how things are going, if they have any feedback, and remind them of upcoming deliverables.`,
    onboarding: `Write an onboarding email for ${client_name} with: portal login instructions (shortstack-os.vercel.app), what to expect in week 1, items we need from them (brand assets, passwords, goals), and contact info.`,
    contract_followup: `Write a follow-up email to ${client_name} about the contract we sent. Keep it casual but professional, ask if they have any questions.`,
    win_announcement: `Write an internal team email announcing a new client win: ${client_name}. Include what services they signed up for and who's assigned.`,
    feedback_request: `Write an email to ${client_name} requesting a testimonial/review. Make it easy for them — suggest they can reply with a few sentences or record a quick video.`,
    offboarding: `Write a professional offboarding email for ${client_name}. Thank them for their business, wish them well, and leave the door open for future work.`,
    custom: custom_context || `Write a professional email for ${client_name}.`,
  };

  const prompt = templates[template_type] || templates.custom;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: "You are writing emails on behalf of ShortStack digital marketing agency. Be professional, warm, and concise. Return JSON with: subject, body (HTML formatted with <p>, <br>, <strong> tags), plain_text (same content without HTML).",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const email = JSON.parse(cleaned);
    return NextResponse.json({ success: true, email, template_type });
  } catch {
    return NextResponse.json({ success: true, email: { subject: "Email", body: text, plain_text: text } });
  }
}
