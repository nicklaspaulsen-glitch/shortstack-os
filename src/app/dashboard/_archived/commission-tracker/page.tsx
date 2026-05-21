import { redirect } from "next/navigation";

// Commission tracking merged into Affiliates — use /dashboard/affiliates
export default function CommissionTrackerRedirect() {
  redirect("/dashboard/affiliates");
}
