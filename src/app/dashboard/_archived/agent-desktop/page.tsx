import { redirect } from "next/navigation";

// Agent Desktop (service health) merged into Monitor — use /dashboard/monitor
export default function AgentDesktopRedirect() {
  redirect("/dashboard/monitor");
}
