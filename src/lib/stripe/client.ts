import Stripe from "stripe";

/**
 * Lazy-initialised Stripe client.
 *
 * The previous pattern across ~24 API routes was
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
 * at the top of every file. That worked on Stripe SDK v17 and earlier
 * (empty-string apiKey was tolerated as "no auth"), but Stripe v22 made
 * the constructor stricter — it now throws
 *   Error: Neither apiKey nor config.authenticator provided
 * the moment you call `new Stripe("")`.
 *
 * Next.js's production build runs a page-data-collection pass that
 * imports every route module to determine dynamic-ness. During that
 * pass STRIPE_SECRET_KEY is sometimes unset (build-time vs runtime
 * env), and the empty-string fallback fires the throw — bricking the
 * whole build.
 *
 * Fixes:
 *   1. Stripe is constructed lazily on first call, NOT at module load.
 *   2. Throws a clear error inside the handler if the env var is missing,
 *      so the route can return a 500 with a useful message instead of
 *      taking down the build.
 *   3. Singleton — reused across requests so we don't pay the construction
 *      cost on every call.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured. Set it in Vercel env (or .env.local for dev) before calling Stripe-backed routes.",
    );
  }
  _stripe = new Stripe(key);
  return _stripe;
}

/**
 * Returns the lazy Stripe client, or null if STRIPE_SECRET_KEY is missing.
 * Use this in routes that should *gracefully* skip Stripe ops (e.g. webhook
 * pre-checks where signature validation comes first) instead of throwing.
 */
export function getStripeOrNull(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  _stripe = new Stripe(key);
  return _stripe;
}
