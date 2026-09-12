/**
 * config.js
 * Central configuration for Lyppe Store.
 *
 * IMPORTANT — SECURITY:
 * Only the Supabase project URL and the ANON/PUBLIC key belong here.
 * NEVER put the service_role key, database password, or any secret
 * credential in this file or anywhere in frontend code. The anon key
 * is safe to expose publicly as long as Row Level Security (RLS) is
 * configured correctly in Supabase (see schema.sql).
 *
 * When this project migrates to Next.js on Vercel, move these values
 * into environment variables (NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, etc.) instead of a static file.
 */

const SUPABASE_CONFIG = {
  url: "https://uprpkhgfikpbwjaiksjs.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcnBraGdmaWtwYndqYWlrc2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTE3MTIsImV4cCI6MjEwNDY4NzcxMn0.9Syfetnrqp5BFNOTjHvHAxieLxuji8Hcybajlci07KU",
};

const APP_CONFIG = {
  // Admin path is an obscurity convenience, NOT a security boundary.
  // Real protection comes from Supabase Auth + RLS (see auth.js / schema.sql).
  adminPath: "/manage-x7k/",
  siteUrl: "https://lype-rho.vercel.app/",
  storeNameFallback: "Lyppe Store",
  storeDescriptionFallback: "Katalog produk digital Lyppe Store.",
  productDescriptionFallback: "Lihat detail produk di Lyppe Store.",
  defaultOgImage: "/assets/og-default.png",
};

const IMAGE_CONFIG = {
  // Which provider uploadProductImage() (in admin.js) should use.
  // Swap this value to change providers without touching call sites.
  provider: "kappa",
  maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

// Single shared Supabase client instance, used by every page.
// Requires the Supabase JS CDN script to be loaded before this file.
const supabaseClient = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);
