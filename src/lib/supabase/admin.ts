import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for operations that cannot be performed with
 * the user's anon session, such as creating an invited Auth user.
 *
 * Never import this module from a Client Component and never expose the
 * service-role key to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY ở server.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
