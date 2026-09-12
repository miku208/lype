/**
 * config.js
 * Central configuration for Lyppe Store.
 *
 * IMPORTANT — SECURITY:
 * Only the Supabase project URL and the ANON/PUBLIC key belong here.
 * NEVER put the service_role key, database password, or any secret
 * credential in this file or anywhere in frontend code. The anon key
 * is safe to expose publicly as long as Row Level Security (RLS) is
 * configured correctly in Supabase (see supabase/schema.sql).
 *
 * This file only holds plain config values. The actual Supabase
 * client is created in supabase.js, which reads SUPABASE_CONFIG below.
 */

const SUPABASE_CONFIG = {
  url: "https://uprpkhgfikpbwjaiksjs.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcnBraGdmaWtwYndqYWlrc2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTE3MTIsImV4cCI6MjEwNDY4NzcxMn0.9Syfetnrqp5BFNOTjHvHAxieLxuji8Hcybajlci07KU",
};

const APP_CONFIG = {
  // Admin path is an obscurity convenience, NOT a security boundary.
  // Real protection comes from Supabase Auth + RLS (see auth.js / supabase/schema.sql).
  adminPath: "/manage-x7k/",
  siteUrl: "https://lyppemarket.web.id/",
  storeNameFallback: "Lyppe Store",
  storeDescriptionFallback: "Digital product simpel, cepat, dan mudah.",
  productDescriptionFallback: "Lihat detail produk di Lyppe Store.",
  defaultOgImage: "/assets/og-default.png",
  defaultPaymentNote: "NOTE : JIKA SUDAH BAYAR - HUBUNGI ADMIN",
};

const IMAGE_CONFIG = {
  // Which provider uploadProductImage() (in admin.js) should use.
  // Swap this value to change providers without touching call sites.
  // Structured so it can later be swapped for Supabase Storage.
  provider: "kappa",
  maxFileSizeBytes: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};
