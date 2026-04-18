import { describe, it, expect } from "vitest";
import {
  computeMonthlyPrice,
  computeYearlyPrice,
  priceDomain,
  MONTHLY_FLOOR,
} from "@/lib/domain-pricing";

describe("domain pricing", () => {
  it("applies the monthly floor for cheap domains", () => {
    // A $5 base would compute to ~$4.56/mo, floor keeps it at $9
    expect(computeMonthlyPrice(5)).toBe(MONTHLY_FLOOR);
  });

  it("computes a premium .com correctly", () => {
    // $12.99 * 1.35 / 12 + $4 = ~$5.46/mo, floor -> $9
    expect(computeMonthlyPrice(12.99)).toBe(MONTHLY_FLOOR);
  });

  it("computes a $50 TLD correctly", () => {
    // $50 * 1.35 / 12 + $4 = $9.625 -> $10
    expect(computeMonthlyPrice(50)).toBe(10);
  });

  it("computes a $120 premium TLD correctly", () => {
    // $120 * 1.35 / 12 + $4 = $17.5 -> $18
    expect(computeMonthlyPrice(120)).toBe(18);
  });

  it("yearly price is 20% off monthly * 12", () => {
    // $15/mo -> $180/yr -> $144/yr after 20% off
    expect(computeYearlyPrice(15)).toBe(144);
  });

  it("priceDomain returns both", () => {
    const p = priceDomain(12.99);
    expect(p.monthly).toBe(MONTHLY_FLOOR);
    expect(p.yearly).toBe(computeYearlyPrice(p.monthly));
  });

  it("yearly always saves money vs monthly*12", () => {
    for (const base of [5, 12.99, 50, 120, 500]) {
      const { monthly, yearly } = priceDomain(base);
      expect(yearly).toBeLessThan(monthly * 12);
    }
  });
});
