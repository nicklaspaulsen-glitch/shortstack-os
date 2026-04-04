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
  user: null,
  profile: null,
  loading: true,
  isPWA: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPWA, setIsPWA] = useState(false);
  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data && !error) {
        setProfile(data);
        return true;
      }
    } catch {
      // Silently fail
    }
    return false;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Detect PWA (installed app) vs browser
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (window.navigator as unknown as Record<string, boolean>).standalone === true;
    setIsPWA(isStandalone);

    let mounted = true;

    const init = async () => {
      try {
        // Try session first
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          setUser(session.user);
          const profileLoaded = await fetchProfile(session.user.id);
          // If profile didn't load via RLS, try fetching without auth filter
          if (!profileLoaded && mounted) {
            // Direct fetch as fallback
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=*`, {
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            const profiles = await res.json();
            if (Array.isArray(profiles) && profiles.length > 0) {
              setProfile(profiles[0]);
            }
          }
          if (mounted) setLoading(false);
          return;
        }

        // Fallback: try getUser
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser && mounted) {
          setUser(authUser);
          await fetchProfile(authUser.id);
        }
        if (mounted) setLoading(false);
      } catch {
        if (mounted) setLoading(false);
      }
    };

    init();

    // Safety timeout
    const timeout = setTimeout(() => {
      if (mounted && loading) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          await fetchProfile(u.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isPWA, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
