"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Loader, ArrowLeft, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { PLAN_TIERS, PlanTier } from "@/lib/plan-config";
import LoginHero from "@/components/brand/login-hero";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const planParam = searchParams?.get("plan") ?? null; // e.g. "growth" from /login?plan=growth
  const billingParam = searchParams?.get("billing") ?? null; // "annual" or null
  // Post-login redirect target. Used by the Chrome extension handshake
  // (/login?redirect=/extension-auth?ext_id=...). Must be a relative path
  // starting with "/" to prevent open redirects.
  const redirectRaw = searchParams?.get("redirect") ?? null;
  const redirectParam = redirectRaw && redirectRaw.startsWith("/") && !redirectRaw.startsWith("//") ? redirectRaw : null;
  // Referral attribution — ?ref=ABC123 gets stashed in a cookie so it
  // survives Stripe Checkout round-trips and later `/api/referrals/claim`
  // reads it to set `profiles.referred_by_user_id`. First-touch wins.
  const refParam = searchParams?.get("ref") ?? null;
  const selectedPlan = planParam
    ? (planParam.charAt(0).toUpperCase() + planParam.slice(1).toLowerCase()) as PlanTier
    : null;
  const planConfig = selectedPlan && PLAN_TIERS[selectedPlan] ? PLAN_TIERS[selectedPlan] : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(!!planParam); // auto-show signup if coming from pricing
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // Magnetic submit-button effect — slight cursor-follow (CSS-only outside,
  // pointer math here). Disabled under prefers-reduced-motion.
  const submitBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const btn = submitBtnRef.current;
    if (!btn) return;
    const handleMove = (e: PointerEvent) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      btn.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`;
    };
    const handleLeave = () => {
      btn.style.transform = "";
    };
    btn.addEventListener("pointermove", handleMove);
    btn.addEventListener("pointerleave", handleLeave);
    return () => {
      btn.removeEventListener("pointermove", handleMove);
      btn.removeEventListener("pointerleave", handleLeave);
    };
  }, [showReset, isSignUp, loading]);

  // Persist ?ref= code across navigations (e.g. Stripe Checkout round-trip).
  // First-touch attribution: only write the cookie if none exists yet.
  useEffect(() => {
    if (!refParam) return;
    const cleaned = refParam.toString().trim().toUpperCase().replace(/^SS-/, "");
    if (!/^[A-Z0-9]{4,12}$/.test(cleaned)) return;
    const already = document.cookie.split("; ").some(c => c.startsWith("ss_ref="));
    if (already) return;
    // 90-day cookie — more than enough for a signup that stalls for weeks.
    const maxAge = 60 * 60 * 24 * 90;
    document.cookie = `ss_ref=${cleaned}; path=/; max-age=${maxAge}; samesite=lax`;
  }, [refParam]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        // Force a plan to be selected BEFORE signup — otherwise users sneak
        // in with the default "Starter" tier without paying. If they landed
        // on /login without a ?plan= param and toggled to Sign Up, bounce
        // them to /pricing to pick first.
        if (!planParam) {
          toast("Pick a plan first — you'll be sent straight to checkout after signup.", { icon: "👉" });
          router.push("/pricing");
          setLoading(false);
          return;
        }

        // Password-confirmation check — must match exactly.
        if (password !== confirmPassword) {
          toast.error("Passwords don't match.");
          setLoading(false);
          return;
        }

        // Sign up as "admin" when coming from pricing page, otherwise "client"
        const role = planParam ? "admin" : "client";
        const { error: signUpErr } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role } },
        });
        if (signUpErr) throw signUpErr;

        // Immediately sign them in with the same credentials. Supabase auto-
        // signs-in when email confirmation is off, but calling explicitly
        // handles BOTH configurations uniformly.
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) {
          // Usually means email confirmation IS enabled. Tell user to check
          // their email, then they can sign in manually.
          toast.success("Account created! Check your email to confirm, then sign in.");
          setIsSignUp(false);
          return;
        }

        // Claim referral attribution — reads ss_ref cookie server-side and
        // writes profiles.referred_by_user_id. Intentionally fire-and-forget:
        // a failure here MUST NOT block the signup → checkout flow. Server
        // route is idempotent (first-touch wins) so retrying later is safe.
        try {
          void fetch("/api/referrals/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        } catch { /* ignore */ }

        // Signed in. If they picked a plan from pricing, fire Stripe checkout
        // immediately so they don't have to click through a second time.
        if (planParam && planConfig) {
          toast.loading("Redirecting to checkout...");
          const res = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_tier: planParam,
              billing_cycle: billingParam === "annual" || billingParam === "yearly" ? "yearly" : "monthly",
            }),
          });
          const data = await res.json();
          const redirectUrl = data.url || data.checkout_url;
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }
          toast.dismiss();
          toast.error(data.error || "Checkout setup failed — subscribe from Settings.");
        }
        // No plan selected, or checkout setup failed → land on dashboard
        router.push("/dashboard");
        router.refresh();
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // If a plan was selected from pricing, redirect to Stripe checkout
        if (planParam && planConfig) {
          toast.loading("Redirecting to checkout...");
          const res = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plan_tier: planParam,
              billing_cycle: billingParam === "annual" || billingParam === "yearly" ? "yearly" : "monthly",
            }),
          });
          const data = await res.json();
          const redirectUrl = data.url || data.checkout_url;
          if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
          }
          // If checkout fails, still go to dashboard
          toast.dismiss();
          toast.error("Checkout setup failed — you can subscribe from Settings.");
        }

        if (redirectParam) {
          // Used by the extension handshake flow to bounce back to
          // /extension-auth after login.
          router.push(redirectParam);
          router.refresh();
          return;
        }
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Enter your email first"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setResetSent(true);
        toast.success("Reset link sent to your email!");
      } else {
        toast.error(data.error || "Failed to send reset email");
      }
    } catch (err) {
      console.error("Password reset request failed:", err);
      toast.error("Connection error");
    }
    setLoading(false);
  };

  const inputClass =
    "w-full text-[14px] pl-10 pr-3 py-3 rounded-lg bg-bg-base border border-border-subtle text-text-primary placeholder:text-text-muted/70 outline-none transition-all duration-220 ease-out-expo-foundation focus:border-brand-lime/60 focus:ring-2 focus:ring-brand-lime/30 focus:bg-bg-base/80";

  return (
    <div className="relative min-h-screen w-full bg-bg-base text-text-primary overflow-hidden">
      {/* Faint corner gradient that anchors the OLED feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(900px 600px at 0% 0%, rgba(212,255,0,0.04), transparent 60%), radial-gradient(900px 600px at 100% 100%, rgba(63,13,45,0.20), transparent 60%)",
        }}
      />

      <div className="relative z-10 flex flex-col md:flex-row min-h-screen">
        {/* LEFT — editorial hero */}
        <section className="md:flex-[3] md:basis-[60%] md:max-w-[60%] hidden md:block border-r border-border-subtle">
          <LoginHero />
        </section>

        {/* RIGHT — auth card */}
        <section className="flex-1 md:flex-[2] md:basis-[40%] md:max-w-[40%] flex items-center justify-center px-5 py-10 md:p-10">
          <div
            className="w-full max-w-[420px] animate-slide-in-up"
            style={{ animationDelay: "200ms" }}
          >
            {/* Mobile-only: small Stack 3D + product label, since hero column is hidden */}
            <div className="md:hidden flex items-center gap-3 mb-8">
              <div className="font-display text-[20px] tracking-tight text-text-primary">
                ShortStack
              </div>
            </div>

            {/* Selected plan banner */}
            {planConfig && selectedPlan && (
              <div
                className="mb-5 px-4 py-3 rounded-xl border text-center backdrop-blur-md"
                style={{ borderColor: `${planConfig.color}30`, background: `${planConfig.color}0D` }}
              >
                <div className="flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: planConfig.color }}>
                  <Zap size={14} />
                  {selectedPlan} Plan — ${planConfig.price_monthly.toLocaleString("en-US")}/mo
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  {isSignUp ? "Create your account to get started" : "Sign in to complete checkout"}
                </p>
              </div>
            )}

            {/* Glass card */}
            <div className="relative rounded-2xl border border-border-subtle bg-bg-surface-2/80 backdrop-blur-md p-7 shadow-stack-2">
              {/* Top edge highlight to make the card feel layered */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-lime/20 to-transparent"
              />

              {showReset ? (
                <div className="space-y-5">
                  <button
                    onClick={() => { setShowReset(false); setResetSent(false); }}
                    className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary transition-colors duration-220"
                    type="button"
                  >
                    <ArrowLeft size={12} /> Back to login
                  </button>

                  {resetSent ? (
                    <div className="text-center py-2">
                      <div className="w-12 h-12 bg-status-success/10 rounded-2xl flex items-center justify-center mx-auto mb-3 ring-1 ring-status-success/30">
                        <Mail size={20} className="text-status-success" />
                      </div>
                      <h2 className="font-display text-[18px] text-text-primary mb-1">Check your email</h2>
                      <p className="text-[13px] text-text-secondary">
                        We sent a password reset link to{" "}
                        <span className="text-text-primary font-medium">{email}</span>
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleReset} className="space-y-4">
                      <div>
                        <h2 className="font-display text-[22px] text-text-primary tracking-tight">Reset password</h2>
                        <p className="text-[12px] text-text-muted mt-1">Enter your email to receive a reset link.</p>
                      </div>
                      <div className="relative">
                        <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                          className={inputClass} placeholder="you@company.com" required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        ref={submitBtnRef}
                        className="w-full text-[14px] font-medium py-3 rounded-lg bg-brand-lime text-bg-base hover:bg-brand-lime-soft transition-all duration-220 ease-out-expo-foundation disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(212,255,0,0.3),0_0_24px_-6px_rgba(212,255,0,0.45)]"
                      >
                        {loading ? <Loader size={14} className="animate-spin" /> : <Mail size={14} />}
                        {loading ? "Sending..." : "Send reset link"}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* Login / Signup Form */
                <form onSubmit={handleAuth} className="space-y-4">
                  <div className="mb-1">
                    <h2 className="font-display text-[24px] md:text-[28px] tracking-tight text-text-primary">
                      {isSignUp ? "Create your account." : "Sign in."}
                    </h2>
                    <p className="text-[12.5px] text-text-muted mt-1">
                      {isSignUp
                        ? "A few seconds and your operating system is live."
                        : "Welcome back. Pick up where you left off."}
                    </p>
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-[0.18em] font-medium">Full Name</label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={inputClass}
                          placeholder="Your name"
                          required={isSignUp}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-[0.18em] font-medium">Email</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                        placeholder="you@company.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-text-muted uppercase tracking-[0.18em] font-medium">Password</label>
                      {!isSignUp && (
                        <button
                          type="button"
                          onClick={() => setShowReset(true)}
                          className="text-[11px] text-brand-indigo hover:text-brand-lime transition-colors duration-220"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${inputClass} pr-10`}
                        placeholder="Enter password"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors duration-220"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {isSignUp && (
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-[0.18em] font-medium">Confirm Password</label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`${inputClass} pr-10`}
                          placeholder="Re-enter password"
                          required={isSignUp}
                          minLength={6}
                        />
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="mt-1.5 text-[11px] text-status-error">Passwords don&apos;t match</p>
                      )}
                      {confirmPassword && password === confirmPassword && password.length >= 6 && (
                        <p className="mt-1.5 text-[11px] text-status-success">Passwords match</p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    ref={submitBtnRef}
                    className="w-full text-[14px] font-semibold py-3 rounded-lg bg-brand-lime text-bg-base hover:bg-brand-lime-soft transition-all duration-220 ease-out-expo-foundation disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_0_1px_rgba(212,255,0,0.3),0_0_24px_-6px_rgba(212,255,0,0.45)] hover:shadow-[0_0_0_1px_rgba(212,255,0,0.45),0_0_32px_-4px_rgba(212,255,0,0.6)]"
                    style={{ willChange: "transform" }}
                  >
                    {loading ? <Loader size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                    {loading ? "Loading..." : isSignUp ? "Create account" : "Sign in"}
                  </button>
                </form>
              )}
            </div>

            {!showReset && (
              <p className="text-center text-[12px] text-text-muted mt-6">
                {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-brand-lime hover:text-brand-lime-soft transition-colors duration-220 font-medium"
                  type="button"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            )}

            {/* Footer */}
            <div className="text-center mt-10 space-y-1">
              <div className="flex items-center justify-center gap-3 text-[11px] text-text-muted">
                <a href="/terms" className="hover:text-text-primary transition-colors duration-220">Terms</a>
                <span className="text-text-muted/40">·</span>
                <a href="/privacy" className="hover:text-text-primary transition-colors duration-220">Privacy</a>
                <span className="text-text-muted/40">·</span>
                <a href="/changelog" className="hover:text-text-primary transition-colors duration-220">Changelog</a>
              </div>
              <p className="text-[10px] text-text-muted/70 tracking-wide">Powered by ShortStack</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
