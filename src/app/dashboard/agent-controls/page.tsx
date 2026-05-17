import { redirect } from "next/navigation";

// Agent Controls merged into Settings — system config lives in /dashboard/settings
export default function AgentControlsRedirect() {
  redirect("/dashboard/settings");
}
