"use client";

import { ReceiptText } from "lucide-react";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export default function InvoiceTemplatesPage() {
  return (
    <ComingSoon
      title="Invoice Templates"
      tagline="Branded invoice and estimate templates — reusable across every client."
      icon={ReceiptText}
      eta="~2 weeks"
      features={[
        "Design once, reuse forever — templates stored per brand",
        "Pull client name, line items, and totals automatically from CRM",
        "Localized formats, tax rules, and currencies per jurisdiction",
        "Recurring invoice schedules (monthly retainer, annual prepay)",
        "Estimate → invoice one-click conversion when the deal closes",
        "PDF export, email send, or post to Stripe/Xero with one button",
      ]}
      alternatives={[
        { label: "Billing", href: "/dashboard/billing" },
        { label: "Clients → Invoices", href: "/dashboard/clients" },
        { label: "Financials", href: "/dashboard/financials" },
      ]}
      gradient={["#3d3020", "#1a1611"]}
    />
  );
}
