import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

/** POST — test the SMTP connection by sending a test email. */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { host, port, username, password, from_email, from_name, use_tls } =
    body;

  if (!host || !port || !username || !from_email) {
    return NextResponse.json(
      { error: "Missing required SMTP fields" },
      { status: 400 }
    );
  }

  // If password is masked, fetch the real one from the database
  let resolvedPassword = password;
  if (!password || password === "••••••••") {
    const { data: config } = await supabase
      .from("smtp_config")
      .select("password_encrypted")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!config?.password_encrypted) {
      return NextResponse.json(
        { error: "No saved password found. Please enter your SMTP password and save first." },
        { status: 400 }
      );
    }
    resolvedPassword = config.password_encrypted;
  }

  const portNum = Number(port);

  const transporter = nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465,
    auth: {
      user: username,
      pass: resolvedPassword,
    },
    tls: use_tls !== false ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    // Verify the connection first
    await transporter.verify();

    // Send a real test email to the user's own address
    const recipient = user.email || from_email;

    await transporter.sendMail({
      from: from_name ? `"${from_name}" <${from_email}>` : from_email,
      to: recipient,
      subject: "ShortStack OS — SMTP Test Email",
      text: `Your SMTP configuration is working correctly.\n\nHost: ${host}\nPort: ${portNum}\nFrom: ${from_email}\n\nThis is an automated test from ShortStack OS Settings.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a1a1a; border-radius: 12px; border: 1px solid #333;">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 24px; font-weight: 700; color: #C9A84C;">ShortStack OS</span>
          </div>
          <div style="background: #111; border-radius: 8px; padding: 24px; border: 1px solid #2a2a2a;">
            <h2 style="color: #C9A84C; margin: 0 0 12px 0; font-size: 18px;">SMTP Connection Verified</h2>
            <p style="color: #ccc; margin: 0 0 16px 0; font-size: 14px; line-height: 1.6;">
              Your email configuration is working correctly. Emails will be sent from this server.
            </p>
            <table style="width: 100%; font-size: 13px; color: #999;">
              <tr><td style="padding: 4px 0; color: #777;">Host</td><td style="padding: 4px 0; color: #ddd;">${host}</td></tr>
              <tr><td style="padding: 4px 0; color: #777;">Port</td><td style="padding: 4px 0; color: #ddd;">${portNum}</td></tr>
              <tr><td style="padding: 4px 0; color: #777;">From</td><td style="padding: 4px 0; color: #ddd;">${from_email}</td></tr>
              <tr><td style="padding: 4px 0; color: #777;">TLS</td><td style="padding: 4px 0; color: #ddd;">${use_tls !== false ? "Enabled" : "Disabled"}</td></tr>
            </table>
          </div>
          <p style="text-align: center; color: #555; font-size: 11px; margin-top: 20px;">
            Sent from ShortStack OS Settings
          </p>
        </div>
      `,
    });

    // Mark config as verified in the database
    await supabase
      .from("smtp_config")
      .update({ verified: true, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${recipient}`,
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown SMTP error";

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hint: getErrorHint(errorMessage),
      },
      { status: 400 }
    );
  }
}

/** Provide helpful hints for common SMTP errors. */
function getErrorHint(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("auth") || lower.includes("credentials") || lower.includes("535"))
    return "Check your username and password. For Gmail, use an App Password instead of your regular password.";
  if (lower.includes("timeout") || lower.includes("connect"))
    return "Could not connect to the server. Verify the host and port are correct, and that your firewall allows outbound connections.";
  if (lower.includes("certificate") || lower.includes("tls"))
    return "TLS certificate error. Try toggling the TLS/SSL setting or check your host's certificate.";
  if (lower.includes("relay") || lower.includes("550"))
    return "The server rejected the recipient. Verify your From Email is authorized to send from this server.";
  return "Check your SMTP settings and try again.";
}
