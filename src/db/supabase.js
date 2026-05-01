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

function mockQuery(data = []) {
  const response = () => Promise.resolve({ data, error: null });
  const single = () => Promise.resolve({ data: Array.isArray(data) ? (data[0] || null) : data, error: null });
  const api = {
    select: () => api,
    insert: (payload) => {
      data = Array.isArray(payload) ? payload : [payload];
      return api;
    },
    upsert: (payload) => {
      data = Array.isArray(payload) ? payload : [payload];
      return api;
    },
    update: () => api,
    delete: () => api,
    eq: () => api,
    neq: () => api,
    lte: () => api,
    gte: () => api,
    lt: () => api,
    gt: () => api,
    in: () => api,
    order: () => api,
    limit: () => api,
    range: () => api,
    single,
    maybeSingle: single,
    then: (resolve, reject) => response().then(resolve, reject),
    catch: (reject) => response().catch(reject),
  };
  return api;
}

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
        signInWithOAuth:   async () => ({ error: new Error("Add Supabase env vars to enable sign-in.") }),
        signInWithIdToken: async () => ({ error: new Error("Add Supabase env vars to enable sign-in.") }),
        signOut:           async () => ({ error: null }),
      },
      from:  () => mockQuery([]),
      rpc:   async () => ({ data: null, error: null }),
    };
