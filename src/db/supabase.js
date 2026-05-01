import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    "⚠️ Supabase not configured — auth and data sync disabled.\n" +
    "Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file."
  );
}

export const isConfigured = !!(supabaseUrl && supabaseAnon);

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "focusmind_auth",
      },
    })
  : {
      // Safe mock — app works fully, just without auth/DB
      auth: {
        getSession:        async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: ()      => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithIdToken: async () => ({ error: new Error("Add Supabase env vars to enable sign-in.") }),
        signOut:           async () => ({ error: null }),
      },
      from:  () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }) }),
      rpc:   async () => ({ error: null }),
    };
