/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../db/supabase";
import { migrateGuestData } from "../db/userService";

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(isConfigured);
  const [authError, setAuthError] = useState("");
  const [isGuest, setIsGuest]     = useState(false);

  const fetchProfile = useCallback(async (userId) => {
    if (!isConfigured) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (data) setProfile(data);
    } catch (error) {
      console.warn("[Auth] profile fetch failed:", error);
    }
  }, []);

  const loadProfile = useCallback((userId) => {
    // Keep Supabase calls out of onAuthStateChange; that callback runs inside
    // Supabase auth internals and awaiting client calls there can block signOut.
    setTimeout(() => fetchProfile(userId), 0);
  }, [fetchProfile]);

  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setIsGuest(false);
    setLoading(false);
  }, []);

  const applySession = useCallback((session) => {
    if (session?.user) {
      setUser(session.user);
      setIsGuest(false);
      setAuthError("");
      setLoading(false);
      loadProfile(session.user.id);
      setTimeout(() => migrateGuestData(session.user.id), 0);
      return true;
    }
    clearAuthState();
    return false;
  }, [clearAuthState, loadProfile]);

  useEffect(() => {
    if (!isConfigured) return;

    // ── Check session immediately on mount ──────────────────────────────
    // This catches the session after Google OAuth redirect
    let cancelled = false;

    const syncSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) applySession(session);
        return !!session?.user;
      } catch (error) {
        if (!cancelled) {
          console.warn("[Auth] session fetch failed:", error);
          setLoading(false);
        }
        return false;
      }
    };

    syncSession().then((found) => {
      if (found || cancelled) return;
      let attempts = 0;
      const poll = window.setInterval(async () => {
        attempts += 1;
        const ok = await syncSession();
        if (ok || attempts >= 6 || cancelled) window.clearInterval(poll);
      }, 350);
    });

    // ── Listen for future auth changes ──────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth] event:", event, "user:", session?.user?.email);

        if (event === "SIGNED_IN" && session?.user) {
          applySession(session);
        }
        if (event === "SIGNED_OUT") {
          clearAuthState();
        }
        if (event === "TOKEN_REFRESHED" && session?.user) {
          setUser(session.user);
        }
        if (event === "INITIAL_SESSION") {
          // Fires on every page load with current session state
          applySession(session);
        }
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [applySession, clearAuthState]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError("");
    if (!isConfigured) {
      setAuthError("Supabase not configured. Add env vars to .env and restart.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setAuthError(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!isConfigured) {
      clearAuthState();
      return;
    }
    setAuthError("");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("[Auth] signOut failed:", error);
      setAuthError(error.message);
      return;
    }
    clearAuthState();
  }, [clearAuthState]);

  const continueAsGuest = useCallback(() => {
    setAuthError("");
    setUser(null);
    setProfile(null);
    setIsGuest(true);
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(() => {
    if (user?.id) fetchProfile(user.id);
  }, [user, fetchProfile]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      authError,
      isGuest,
      isConfigured,
      isAuthenticated: !!user,
      signInWithGoogle,
      signOut,
      continueAsGuest,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
