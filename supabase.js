/**
 * supabase.js
 * Initializes the single shared Supabase client instance, used by
 * every page (public storefront + admin dashboard).
 *
 * Requires, in this order, before this file is loaded:
 *   1. The Supabase JS CDN script (https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2)
 *   2. config.js (defines SUPABASE_CONFIG)
 *
 * Only the anon/public key is used here — never the service_role key.
 * Access control is enforced by Postgres Row Level Security policies
 * (see supabase/schema.sql), not by anything in this file.
 */

const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);
