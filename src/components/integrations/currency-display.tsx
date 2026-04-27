"use client";

// Multi-currency amount display.
//
// Shows the amount in its native currency, and — if a `displayIn` currency
// is provided and differs from `currency` — appends a parenthetical
// "(≈ €110 EUR)" using the rate fetched from /api/integrations/exchange-rate.
//
// Soft-fail: if the rate fetch fails or no displayIn is set, only the
// native amount renders. Never crashes the parent.

import { useEffect, useState } from "react";

interface CurrencyDisplayProps {
  /** Amount in the native currency, in major units (e.g. 120.50 dollars, not cents). */
  amount: number;
  /** ISO 4217 code of the native currency (e.g. "USD"). */
  currency: string;
  /** Optional ISO 4217 code to display alongside (e.g. client's local currency). */
  displayIn?: string;
  /** Show the source of the rate as a subtle hint (default: false). */
  showRateSource?: boolean;
  className?: string;
}

interface RateResponse {
  success: boolean;
  rate?: {
    from: string;
    to: string;
    rate: number;
    source: string;
  };
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Invalid ISO code — fall back to bare number with code suffix
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export default function CurrencyDisplay({
  amount,
  currency,
  displayIn,
  showRateSource = false,
  className = "",
}: CurrencyDisplayProps) {
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<string | null>(null);

  useEffect(() => {
    if (!displayIn || displayIn.toUpperCase() === currency.toUpperCase()) {
      setConvertedAmount(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/integrations/exchange-rate?from=${encodeURIComponent(currency)}&to=${encodeURIComponent(displayIn)}`,
    )
      .then((res) => res.json())
      .then((data: RateResponse) => {
        if (cancelled || !data.success || !data.rate) return;
        // source="fallback" means both providers failed → don't show a
        // misleading "1.00" conversion.
        if (data.rate.source === "fallback") {
          setConvertedAmount(null);
          return;
        }
        setConvertedAmount(amount * data.rate.rate);
        setRateSource(data.rate.source);
      })
      .catch(() => {
        // Soft-fail — leave conversion off
      });
    return () => {
      cancelled = true;
    };
  }, [amount, currency, displayIn]);

  return (
    <span className={className}>
      <span>{formatAmount(amount, currency)}</span>
      {convertedAmount !== null && displayIn && (
        <span className="text-muted text-[10px] ml-1">
          (≈ {formatAmount(convertedAmount, displayIn)})
          {showRateSource && rateSource && (
            <span className="ml-0.5 text-[9px] opacity-60">via {rateSource}</span>
          )}
        </span>
      )}
    </span>
  );
}
