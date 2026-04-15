"use client";

import { createContext, useContext, useEffect, useState, useRef, useMemo, ReactNode } from "react";
import { createAuthClient, setAccessToken } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Profile } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isPWA: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, loading: true, isPWA: false,
  signOut: async () => {}, refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // Load cached profile INSTANTLY from localStorage (no flash)
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem("ss_profile");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  // Always start loading=true so the layout waits for auth.getSession()
  // before deciding whether to redirect to /login. The cached profile
  // above is only for UI display (sidebar name, role) — it must NOT
  // cause loading to start as false, which would trigger a premature
  // redirect when user is still null.
  const [loading, setLoading] = useState(true);
  const [isPWA, setIsPWA] = useState(false);

  // Stable supabase client for AUTH operations only (cookie-based singleton).
  // Data queries go through createClient() which uses the access token header.
  const supabase = useMemo(() => createAuthClient(), []);

  // Track whether the fresh profile has been fetched (vs stale cache)
  const profileFetchedRef = useRef(false);

  const fetchProfile = async (userId: string): Promise<boolean> => {
    // Primary: fetch via server API (reliable — uses service client, bypasses RLS)
    try {
      const res = await fetch(`/api/profile?t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        if (json.profile) {
          setProfile(json.profile);
          localStorage.setItem("ss_profile", JSON.stringify(json.profile));
          profileFetchedRef.current = true;
          return true;
        }
      }
    } catch {
      console.warn("[auth] Server profile fetch failed — trying client");
    }

    // Fallback: client-side Supabase query
    try {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) {
        console.warn("[auth] Client profile fetch error:", error.message);
        return false;
      }
      if (data) {
        setProfile(data);
        localStorage.setItem("ss_profile", JSON.stringify(data));
        profileFetchedRef.current = true;
        return true;
      }
    } catch (err) {
      console.warn("[auth] Profile fetch exception:", err);
    }
    return false;
  };

  // refreshProfile bypasses cache by fetching from the server API directly
  const refreshProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/profile?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          localStorage.setItem("ss_profile", JSON.stringify(data.profile));
          profileFetchedRef.current = true;
          return;
        }
      }
    } catch {}
    // Fallback to supabase client
    await fetchProfile(user.id);
  };

  useEffect(() => {
    setIsPWA(window.matchMedia("(display-mode: standalone)").matches);

    let mounted = true;

    const init = async () => {
      try {
        // Step 1: Sync browser client from server session.
        // The middleware always has valid auth (cookie-based). The browser
        // client's cookies may be corrupted/incomplete. This fetches the
        // server's session tokens and injects them into the browser client.
        let validUser = null;
        try {
          const res = await fetch("/api/auth/session");
          if (res.ok) {
            const { access_token, refresh_token } = await res.json();
            if (access_token && refresh_token) {
              const { data } = await supabase.auth.setSession({
                access_token,
                refresh_token,
              });
              validUser = data.user;
              // Inject token globally so createClient() returns a
              // token-based client — bypasses broken cookie auth
              if (validUser) {
                setAccessToken(access_token);
              }
            }
          }
        } catch {
          // Session sync failed — try local methods
        }

        // Step 2: Fallback to local getUser/getSession
        if (!validUser) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            validUser = user;
          } catch {}
        }
        if (!validUser) {
          const { data: { session } } = await supabase.auth.getSession();
          validUser = session?.user ?? null;
        }

        if (validUser && mounted) {
          setUser(validUser);
          await fetchProfile(validUser.id);
        } else if (mounted) {
          setProfile(null);
          localStorage.removeItem("ss_profile");
        }
        if (mounted) setLoading(false);
      } catch (err) {
        console.warn("[auth] Init error:", err);
        if (mounted) {
          // Clear stale state on error to prevent showing cached admin data
          setProfile(null);
          localStorage.removeItem("ss_profile");
          setLoading(false);
        }
      }
    };

    init();

    // 3s safety timeout — prevents infinite loading if network is slow
    const timeout = setTimeout(() => { if (mounted) setLoading(false); }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);

        // Keep the global access token in sync so createClient()
        // always returns a client with a valid token.
        if (session?.access_token) {
          setAccessToken(session.access_token);
        } else {
          setAccessToken(null);
        }

        if (u) {
          await fetchProfile(u.id);
        } else {
          setProfile(null);
          localStorage.removeItem("ss_profile");
          profileFetchedRef.current = false;
        }
        setLoading(false);

        // Handle token refresh events — session stayed alive, profile may have changed
        if (event === "TOKEN_REFRESHED" && u) {
          fetchProfile(u.id);
        }
      }
    );

    return () => { mounted = false; clearTimeout(timeout); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const signOut = async () => {
    setAccessToken(null); // Clear global token first
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
    localStorage.removeItem("ss_profile");
    profileFetchedRef.current = false;
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPWA, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
