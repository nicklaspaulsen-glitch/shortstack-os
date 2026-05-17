import { redirect } from "next/navigation";

// A/B tests consolidated into Analytics — use /dashboard/analytics
export default function AbTestsRedirect() {
  redirect("/dashboard/analytics");
}
