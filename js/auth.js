/**
 * auth.js
 * Handles Supabase Auth for the admin area:
 *  - login form (admin/index.html)
 *  - session + role guard (used by admin/dashboard.html)
 *
 * IMPORTANT: this file never invents its own password system and
 * never trusts a role coming from localStorage/sessionStorage/URL.
 * The only source of truth for "is this user an admin?" is the
 * `profiles.role` row, protected by RLS (see schema.sql).
 */

const LOGIN_PATH = "index.html";
const DASHBOARD_PATH = "dashboard.html";

/**
 * Returns the admin's role row for the current session, or null if
 * there is no session or the profile lookup fails/denies access.
 * Because `profiles` is protected by RLS, a non-admin or forged
 * client-side state cannot fake this — the database enforces it.
 */
async function getCurrentProfile() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Guard for admin/dashboard.html: redirects to login if there is no
 * valid session, or if the session belongs to a non-admin user.
 * Call this before rendering any admin UI.
 */
async function requireAdminSession() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "admin") {
    await supabaseClient.auth.signOut();
    window.location.replace(LOGIN_PATH);
    return null;
  }

  return profile;
}

/** Keeps the dashboard safe if the session expires mid-visit. */
function watchSessionExpiry() {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "TOKEN_REFRESH_FAILED") {
      window.location.replace(LOGIN_PATH);
    }
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.target;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorEl = document.getElementById("loginError");

  errorEl.textContent = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Memproses...";

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      errorEl.textContent = "Email atau password salah.";
      return;
    }

    const profile = await getCurrentProfile();
    if (!profile || profile.role !== "admin") {
      await supabaseClient.auth.signOut();
      errorEl.textContent = "Akun ini tidak memiliki akses admin.";
      return;
    }

    window.location.href = DASHBOARD_PATH;
  } catch (error) {
    console.error(error);
    errorEl.textContent = "Terjadi kesalahan. Coba lagi.";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  window.location.replace(LOGIN_PATH);
}

async function loadLoginBranding() {
  const heading = document.getElementById("loginStoreName");
  if (!heading) return;

  try {
    const { data } = await supabaseClient
      .from("store_settings")
      .select("store_name")
      .limit(1)
      .maybeSingle();

    if (data && data.store_name) {
      heading.textContent = data.store_name;
    }
  } catch (error) {
    // Fallback text already in the HTML — silently keep it.
    console.error(error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadLoginBranding();

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLoginSubmit);
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", handleLogout);
  }
});
