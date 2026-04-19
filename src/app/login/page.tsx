"use client";

import { useState, Suspense } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Loader, ArrowLeft, Zap } from "lucide-react";
import toast from "react-hot-toast";
import { PLAN_TIERS, PlanTier } from "@/lib/plan-config";
import { BRAND } from "@/lib/brand-config";

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
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        // Sign up as "admin" when coming from pricing page, otherwise "client"
        const role = planParam ? "admin" : "client";
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, role } },
        });
        if (error) throw error;
        toast.success("Account created! You can now sign in.");
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // If a plan was selected from pricing, redirect to Stripe checkout
        if (planParam && planConfig) {
          toast.loading("Redirecting to checkout...");
          const res = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: planParam, billing: billingParam || "monthly" }),
          });
          const data = await res.json();
          if (data.checkout_url) {
            window.location.href = data.checkout_url;
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
    } catch {
      toast.error("Connection error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Image src={BRAND.logo_svg} alt={BRAND.product_name} width={56} height={56} />
          <h1 className="text-lg font-bold text-foreground tracking-tight mt-4">{BRAND.product_name}</h1>
          <p className="text-[10px] text-gold/80 font-medium mt-0.5 tracking-wide">by {BRAND.company_name}</p>
          <p className="text-[11px] text-muted mt-1 tracking-wide">Agency Operating System</p>
        </div>

        {/* Selected plan banner */}
        {planConfig && selectedPlan && (
          <div className="mb-4 px-4 py-3 rounded-xl border text-center" style={{ borderColor: `${planConfig.color}30`, background: `${planConfig.color}08` }}>
            <div className="flex items-center justify-center gap-2 text-sm font-semibold" style={{ color: planConfig.color }}>
              <Zap size={14} />
              {selectedPlan} Plan — ${planConfig.price_monthly.toLocaleString("en-US")}/mo
            </div>
            <p className="text-[10px] text-muted mt-1">
              {isSignUp ? "Create your account to get started" : "Sign in to complete checkout"}
            </p>
          </div>
        )}

        {/* Password Reset View */}
        {showReset ? (
          <div className="card space-y-4">
            <button onClick={() => { setShowReset(false); setResetSent(false); }}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
              <ArrowLeft size={12} /> Back to login
            </button>

            {resetSent ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Mail size={20} className="text-success" />
                </div>
                <h2 className="text-sm font-semibold text-foreground mb-1">Check your email</h2>
                <p className="text-xs text-muted">
                  We sent a password reset link to <span className="text-foreground font-medium">{email}</span>
                </p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-3">
                <div className="text-center mb-2">
                  <h2 className="text-sm font-semibold">Reset Password</h2>
                  <p className="text-[10px] text-muted mt-0.5">Enter your email to receive a reset link</p>
                </div>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input w-full text-sm pl-9" placeholder="you@company.com" required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader size={14} className="animate-spin" /> : <Mail size={14} />}
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Login / Signup Form */
          <form onSubmit={handleAuth} className="card space-y-3">
            {isSignUp && (
              <div>
                <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider font-medium">Full Name</label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                    className="input w-full text-sm pl-9" placeholder="Your name" required={isSignUp} />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] text-muted mb-1.5 uppercase tracking-wider font-medium">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="input w-full text-sm pl-9" placeholder="you@company.com" required />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] text-muted uppercase tracking-wider font-medium">Password</label>
                {!isSignUp && (
                  <button type="button" onClick={() => setShowReset(true)} className="text-[10px] text-gold hover:text-gold-light transition-colors">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  className="input w-full text-sm pl-9 pr-10" placeholder="Enter password" required minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </button>
          </form>
        )}

        {!showReset && (
          <p className="text-center text-[11px] text-muted mt-6">
            {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-gold hover:text-gold-dark transition-colors font-medium">
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        )}

        {/* Footer */}
        <div className="text-center mt-10 space-y-1">
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted">
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
            <span className="text-border">·</span>
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <span className="text-border">·</span>
            <a href="/changelog" className="hover:text-foreground transition-colors">Changelog</a>
          </div>
          <p className="text-[10px] text-muted-light">Powered by ShortStack</p>
        </div>
      </div>
    </div>
  );
}
