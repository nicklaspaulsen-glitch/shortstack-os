import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Public health check endpoint for uptime monitoring.
 * GET /api/health
 *
 * Returns:
 * - 200 if all critical services are reachable
 * - 503 if any critical service is down
 *
 * Use with: Better Uptime, Pinger, UptimeRobot, etc.
 */
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  let healthy = true;

  // 1. Database connectivity
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);
    checks.database = error ? "error" : "ok";
    if (error) healthy = false;
  } catch {
    checks.database = "error";
    healthy = false;
  }

  // 2. Environment variables present
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ANTHROPIC_API_KEY",
    "STRIPE_SECRET_KEY",
  ];
  const missingEnv = requiredEnvVars.filter(v => !process.env[v]);
  checks.env = missingEnv.length === 0 ? "ok" : "error";
  if (missingEnv.length > 0) healthy = false;

  // 3. Memory usage check (< 90% threshold)
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  checks.memory = heapUsedMB < 450 ? "ok" : "error"; // Vercel functions have ~512MB
  if (heapUsedMB >= 450) healthy = false;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
      uptime: Math.round(process.uptime()),
      memory_mb: heapUsedMB,
    },
    { status: healthy ? 200 : 503 }
  );
}
