/**
 * Alias for /api/portal/book-call (POST). Accepts the same body shape
 * including the optional team_id field that routes a booking through the
 * round-robin engine. Re-exports the underlying handlers so behaviour is
 * identical to /api/portal/book-call.
 *
 * This route exists so frontends can call /api/portal/bookings when they
 * think of the entity in plural form.
 */
export { GET, POST } from "../book-call/route";
