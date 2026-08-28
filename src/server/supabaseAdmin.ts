import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "./env.js";

let supabaseAdmin: SupabaseClient<any, "public", any> | null = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(getRequiredEnv("VITE_SUPABASE_URL"), getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

export async function requireAuthenticatedUser(authorizationHeader?: string | null) {
  const headerValue = authorizationHeader?.trim() || "";

  if (!headerValue.startsWith("Bearer ")) {
    throw new Error("Missing bearer token.");
  }

  const accessToken = headerValue.slice("Bearer ".length).trim();

  if (!accessToken) {
    throw new Error("Missing bearer token.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new Error("Invalid or expired session.");
  }

  return data.user;
}
