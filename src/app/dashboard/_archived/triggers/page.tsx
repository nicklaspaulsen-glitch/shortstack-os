import { redirect } from "next/navigation";

// Triggers merged into Workflows page — use /dashboard/workflows (Triggers & Actions tab)
export default function TriggersRedirect() {
  redirect("/dashboard/workflows");
}
