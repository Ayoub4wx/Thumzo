import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "";

const missingCredentialsMessage =
  "Supabase credentials are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable auth, database, and storage features.";

function missingCredentialsError() {
  return new Error(missingCredentialsMessage);
}

function createQueryBuilder() {
  const builder: any = {
    select: async () => ({ data: [], error: missingCredentialsError() }),
    insert: async () => ({ data: null, error: missingCredentialsError() }),
    update: () => builder,
    delete: () => builder,
    upsert: async () => ({ data: null, error: missingCredentialsError() }),
    eq: () => builder,
    order: async () => ({ data: [], error: missingCredentialsError() }),
  };

  return builder;
}

function createStorageBucket() {
  return {
    list: async () => ({ data: [], error: missingCredentialsError() }),
    getPublicUrl: (path: string) => ({ data: { publicUrl: path } }),
    upload: async () => ({ data: null, error: missingCredentialsError() }),
    createSignedUrl: async () => ({ data: null, error: missingCredentialsError() }),
    remove: async () => ({ data: null, error: missingCredentialsError() }),
  };
}

function createFallbackSupabaseClient() {
  const subscription = { unsubscribe: () => undefined };

  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: missingCredentialsError() }),
      refreshSession: async () => ({ data: { session: null, user: null }, error: missingCredentialsError() }),
      onAuthStateChange: () => ({ data: { subscription } }),
      signInWithOAuth: async () => ({ data: { url: null }, error: missingCredentialsError() }),
      signInWithPassword: async () => ({ data: null, error: missingCredentialsError() }),
      signInWithOtp: async () => ({ data: null, error: missingCredentialsError() }),
      signUp: async () => ({ data: { session: null, user: null }, error: missingCredentialsError() }),
      resetPasswordForEmail: async () => ({ data: null, error: missingCredentialsError() }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: { user: null }, error: missingCredentialsError() }),
      updateUser: async (attributes: any) => ({ data: { user: null }, error: missingCredentialsError() }),
    },
    storage: {
      from: () => createStorageBucket(),
    },
    from: () => createQueryBuilder(),
    channel: () => ({
      on: () => ({
        subscribe: () => subscription,
      }),
    }),
    removeChannel: () => undefined,
  };
}

if (!supabaseUrl || !supabaseKey) {
  console.error(`CRITICAL: ${missingCredentialsMessage}`);
}

export const supabase: any =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : createFallbackSupabaseClient();
