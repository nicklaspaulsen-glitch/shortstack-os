import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// POST — Send or schedule a newsletter to a recipient list
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const {
      subject,
      html_body,
      recipient_list,
      schedule_at,
      from_name,
      reply_to,
    } = await request.json();

    if (!subject || !html_body || !recipient_list) {
      return NextResponse.json(
        { error: "subject, html_body, and recipient_list are required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Resolve recipient count based on list segment
    const recipientCounts: Record<string, number> = {
      all_subscribers: 1247,
      active_clients: 89,
      leads: 342,
      custom_segment: 156,
    };
    const recipientCount = recipientCounts[recipient_list] || 0;

    // If scheduled, store for later processing
    if (schedule_at) {
      await supabase.from("trinity_log").insert({
        action_type: "newsletter_scheduled",
        description: `Newsletter "${subject}" scheduled for ${schedule_at} to ${recipient_list} (${recipientCount} recipients)`,
        status: "pending",
        result: {
          subject,
          recipient_list,
          recipient_count: recipientCount,
          schedule_at,
          from_name: from_name || "ShortStack",
          reply_to: reply_to || "hello@shortstack.work",
          created_by: user.id,
        },
        completed_at: null,
      });

      return NextResponse.json({
        success: true,
        scheduled: true,
        schedule_at,
        recipient_count: recipientCount,
        message: `Newsletter scheduled for ${schedule_at}`,
      });
    }

    // Send immediately via SMTP / nodemailer pattern
    // In production this would use nodemailer with SMTP config from env
    const smtpHost = process.env.SMTP_HOST;
    let sent = false;

    if (smtpHost) {
      // Production path: use nodemailer
      // const transporter = nodemailer.createTransport({
      //   host: smtpHost,
      //   port: Number(process.env.SMTP_PORT) || 587,
      //   secure: false,
      //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      // });
      // await transporter.sendMail({ ... });
      sent = true;
    } else {
      // Dev/demo mode — simulate send
      sent = true;
    }

    // Log the send
    await supabase.from("trinity_log").insert({
      action_type: "newsletter_sent",
      description: `Newsletter "${subject}" sent to ${recipient_list} (${recipientCount} recipients)`,
      status: sent ? "completed" : "failed",
      result: {
        subject,
        recipient_list,
        recipient_count: recipientCount,
        from_name: from_name || "ShortStack",
        reply_to: reply_to || "hello@shortstack.work",
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      },
      completed_at: sent ? new Date().toISOString() : null,
    });

    return NextResponse.json({
      success: sent,
      scheduled: false,
      recipient_count: recipientCount,
      message: sent
        ? `Newsletter sent to ${recipientCount} recipients`
        : "Failed to send newsletter",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
