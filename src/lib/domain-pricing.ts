/**
 * Domain pricing math — used by checkout endpoint + domains page UI.
 * Shared here so both prices stay identical and both can be unit-tested.
 */

export const DEFAULT_REGISTRAR_MARKUP = 0.35;
export const DEFAULT_OPS_FEE_PER_MONTH = 4;
export const YEARLY_DISCOUNT = 0.2; // 20% off vs monthly * 12
export const MONTHLY_FLOOR = 9;

export function computeMonthlyPrice(
  basePriceYearly: number,
  registrarMarkup = DEFAULT_REGISTRAR_MARKUP,
  opsFeePerMonth = DEFAULT_OPS_FEE_PER_MONTH,
): number {
  const annual = basePriceYearly * (1 + registrarMarkup);
  return Math.max(MONTHLY_FLOOR, Math.round(annual / 12 + opsFeePerMonth));
}

export function computeYearlyPrice(monthlyPrice: number, discount = YEARLY_DISCOUNT): number {
  return Math.round(monthlyPrice * 12 * (1 - discount));
}

export function priceDomain(basePriceYearly: number) {
  const monthly = computeMonthlyPrice(basePriceYearly);
  const yearly = computeYearlyPrice(monthly);
  return { monthly, yearly };
}
