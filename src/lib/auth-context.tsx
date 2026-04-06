"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return !localStorage.getItem("ss_profile");
  });
  const [isPWA, setIsPWA] = useState(false);
  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (data) {
        setProfile(data);
        localStorage.setItem("ss_profile", JSON.stringify(data));
        return true;
      }
    } catch {}
    return false;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    setIsPWA(window.matchMedia("(display-mode: standalone)").matches);

    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setUser(session.user);
          fetchProfile(session.user.id); // Don't await — let it run in background
          setLoading(false);
          return;
        }
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && mounted) {
          setUser(authUser);
          fetchProfile(authUser.id);
        }
        if (mounted) setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    };

    init();

    // 2s safety timeout (was 5s)
    const timeout = setTimeout(() => { if (mounted) setLoading(false); }, 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) fetchProfile(u.id);
        else { setProfile(null); localStorage.removeItem("ss_profile"); }
        setLoading(false);
      }
    );

    return () => { mounted = false; clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null);
    localStorage.removeItem("ss_profile");
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPWA, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
