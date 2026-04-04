"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { Profile } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      if (data && !error) setProfile(data);
    } catch {
      // Profile fetch failed silently
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const getUser = async () => {
      try {
        // Try getSession first (faster, uses local storage)
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          setLoading(false);
          return;
        }

        // Fallback to getUser (makes API call)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (mounted) {
          setUser(authUser);
          if (authUser) await fetchProfile(authUser.id);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };

    getUser();

    // Safety timeout — never stay loading forever
    const timeout = setTimeout(() => {
      if (mounted && loading) setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
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
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
