/**
 * utils.js
 * Small shared helpers used by app.js, product.js, and admin.js.
 * Loaded as a plain script (no bundler) — keep it dependency-free.
 */

const priceFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatPrice(value) {
  const number = Number(value) || 0;
  return priceFormatter.format(number);
}

/**
 * Small country-name → flag-emoji lookup for NOKOS-style products.
 * Purely cosmetic — an unrecognized/typo'd country just renders
 * without a flag, so a miss here is harmless (never used for logic).
 */
const COUNTRY_FLAGS = {
  indonesia: "🇮🇩",
  malaysia: "🇲🇾",
  singapura: "🇸🇬",
  singapore: "🇸🇬",
  thailand: "🇹🇭",
  vietnam: "🇻🇳",
  filipina: "🇵🇭",
  philippines: "🇵🇭",
  kamboja: "🇰🇭",
  cambodia: "🇰🇭",
  myanmar: "🇲🇲",
  laos: "🇱🇦",
  brunei: "🇧🇳",
  india: "🇮🇳",
  pakistan: "🇵🇰",
  bangladesh: "🇧🇩",
  china: "🇨🇳",
  tiongkok: "🇨🇳",
  jepang: "🇯🇵",
  japan: "🇯🇵",
  korea: "🇰🇷",
  "korea selatan": "🇰🇷",
  "hong kong": "🇭🇰",
  hongkong: "🇭🇰",
  taiwan: "🇹🇼",
  australia: "🇦🇺",
  amerika: "🇺🇸",
  "amerika serikat": "🇺🇸",
  usa: "🇺🇸",
  "united states": "🇺🇸",
  inggris: "🇬🇧",
  "united kingdom": "🇬🇧",
  uk: "🇬🇧",
  jerman: "🇩🇪",
  germany: "🇩🇪",
  prancis: "🇫🇷",
  france: "🇫🇷",
  belanda: "🇳🇱",
  netherlands: "🇳🇱",
  rusia: "🇷🇺",
  russia: "🇷🇺",
  nigeria: "🇳🇬",
  global: "🌐",
  internasional: "🌐",
  international: "🌐",
};

/** Looks up a flag emoji for a country name; returns "" if unknown. */
function getCountryFlag(country) {
  if (!country) return "";
  const key = String(country).trim().toLowerCase();
  return COUNTRY_FLAGS[key] || "";
}

/**
 * Centralizes the price/availability display rule (used by the catalog
 * grid, product detail page, and quick-view sheet):
 *  1. is_available === false  -> "Tidak tersedia" (never show Rp 0)
 *  2. price_label has content -> show it verbatim (display override)
 *  3. otherwise                -> normal formatted price
 * Returns { text, available } — `available` drives whether the Beli
 * button should be enabled.
 */
function resolveProductPriceDisplay(product) {
  if (!product) return { text: "", available: true };
  if (product.is_available === false) {
    return { text: "Tidak tersedia", available: false };
  }
  const label = product.price_label && String(product.price_label).trim();
  if (label) {
    return { text: label, available: true };
  }
  return { text: formatPrice(product.price), available: true };
}

/** Set (or create) a <meta name="..."> tag. */
function setMetaName(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Set (or create) a <meta property="..."> tag (Open Graph style). */
function setMetaProperty(property, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Build an absolute URL from the configured site URL + a path. */
function absoluteUrl(path) {
  const base = (APP_CONFIG.siteUrl || "").replace(/\/$/, "");
  if (!base) return path;
  return base + (path.startsWith("/") ? path : `/${path}`);
}

/** Normalize a WhatsApp number (allows 08xx, +62, 62 formats) into wa.me format. */
function normalizeWhatsAppNumber(raw) {
  if (!raw) return "";
  let digits = String(raw).replace(/[^\d]/g, "");
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (!digits.startsWith("62")) {
    digits = "62" + digits;
  }
  return digits;
}

/** Build a wa.me link, optionally with a prefilled message. */
function buildWhatsAppLink(rawNumber, message) {
  const number = normalizeWhatsAppNumber(rawNumber);
  if (!number) return null;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Turn "Product Name Here" into "product-name-here". */
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Replace the contents of an element with a plain-text loading message. */
function showLoading(el, message = "Memuat...") {
  el.innerHTML = "";
  const p = document.createElement("p");
  p.className = "state-message loading-text";
  p.textContent = message;
  el.appendChild(p);
}

/** Replace the contents of an element with a plain-text empty/error message. */
function showMessage(el, message) {
  el.innerHTML = "";
  const p = document.createElement("p");
  p.className = "state-message";
  p.textContent = message;
  el.appendChild(p);
}

/**
 * Log the technical error for developers, but return a safe,
 * user-facing message. Never surface raw Supabase/Postgres errors.
 */
function safeErrorMessage(error, fallback) {
  console.error(error);
  return fallback;
}

/* ------------------------------------------------------------
 * Toast notifications (replaces window.alert() for save feedback)
 * Expects a container: <div class="toast-stack" id="toastStack"></div>
 * ------------------------------------------------------------ */
function showToast(message, type = "default") {
  let stack = document.getElementById("toastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.id = "toastStack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`.trim();
  toast.textContent = message;
  stack.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

/* ------------------------------------------------------------
 * Custom confirm dialog (replaces window.confirm())
 * Returns a Promise<boolean> resolved by the user's choice.
 * Builds its own overlay/modal markup, so no HTML boilerplate
 * needs to be duplicated on every page that needs a confirmation.
 * ------------------------------------------------------------ */
function confirmDialog({ title, message, confirmLabel = "Delete", cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const card = document.createElement("div");
    card.className = "modal-card confirm-card";
    card.setAttribute("role", "alertdialog");
    card.setAttribute("aria-modal", "true");

    const icon = document.createElement("div");
    icon.className = "confirm-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "!";

    const titleEl = document.createElement("h2");
    titleEl.textContent = title;

    const messageEl = document.createElement("p");
    messageEl.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "btn danger";
    confirmBtn.textContent = confirmLabel;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn secondary";
    cancelBtn.textContent = cancelLabel;

    actions.append(confirmBtn, cancelBtn);
    card.append(icon, titleEl, messageEl, actions);
    overlay.appendChild(card);

    function cleanup(result) {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === "Escape") cleanup(false);
    }

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cleanup(false);
    });

    confirmBtn.addEventListener("click", () => cleanup(true));
    cancelBtn.addEventListener("click", () => cleanup(false));

    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
    cancelBtn.focus();
  });
}

/* ------------------------------------------------------------
 * Announcement banner (store_settings.announcement_text), shared
 * across index.html / product.html / payment.html. Editable from
 * the dashboard's Store Settings tab.
 * ------------------------------------------------------------ */
function getAnnouncementRefs() {
  const banner = document.getElementById("announceBanner");
  if (!banner) return null;
  return {
    banner,
    textEl: document.getElementById("announceText"),
    closeBtn: document.getElementById("announceCloseBtn"),
  };
}

/** Wire the ✕ button once per page load. */
function initAnnouncementBanner() {
  const refs = getAnnouncementRefs();
  if (!refs) return;
  refs.closeBtn.addEventListener("click", () => {
    refs.banner.hidden = true;
    const key = refs.banner.dataset.dismissKey;
    if (key) {
      try {
        localStorage.setItem(key, "1");
      } catch (error) {
        /* localStorage unavailable (private mode etc.) — ignore, not critical */
      }
    }
  });
}

/**
 * Show the banner with `text`, unless the visitor already dismissed this
 * exact message (tracked per-text, so editing the announcement in the
 * dashboard makes it reappear even for visitors who closed the old one).
 */
function showAnnouncementBanner(text) {
  const refs = getAnnouncementRefs();
  if (!refs) return;

  const trimmed = (text || "").trim();
  if (!trimmed) {
    refs.banner.hidden = true;
    return;
  }

  const key = `announceDismissed:${trimmed}`;
  refs.banner.dataset.dismissKey = key;

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(key) === "1";
  } catch (error) {
    dismissed = false;
  }

  if (dismissed) {
    refs.banner.hidden = true;
    return;
  }

  refs.textEl.textContent = trimmed;
  refs.banner.hidden = false;
}
