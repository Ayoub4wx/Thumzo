import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL: Supabase credentials (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are missing! Authentication and database features will not work. Please add them to your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
