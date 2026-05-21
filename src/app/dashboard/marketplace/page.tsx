import { redirect } from "next/navigation";

// Marketplace listing page lives under /marketplace/listings (seller) and /marketplace/orders (buyer)
export default function MarketplacePage() {
  redirect("/dashboard/marketplace/listings");
}
