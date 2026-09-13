/**
 * payment.js
 * Payment page (payment.html?slug=...).
 *
 * Manual payment only — QRIS image and DANA number both come from
 * store_settings, edited by the admin. There is no payment gateway
 * and no automatic verification: the buyer pays manually, then taps
 * "Hubungi Admin" to confirm over WhatsApp.
 */

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function showNotFound(refs) {
  refs.section.hidden = true;
  refs.notFound.hidden = false;
  if (refs.unavailable) refs.unavailable.hidden = true;
}

/**
 * Stock is the source of truth for purchasability (see the
 * products_sync_availability DB trigger in supabase/schema.sql, which
 * keeps is_available in sync with stock). Falls back to is_available
 * if stock wasn't selected/returned, for safety.
 */
function validateStock(product) {
  if (!product) return false;
  if (typeof product.stock === "number") return product.stock > 0;
  return product.is_available !== false;
}

/** Only "qris" or "dana" are valid payment methods on this page. */
function validatePaymentMethod(method) {
  return method === "qris" || method === "dana";
}

/** Reflects the active payment method in the toggle buttons + panels. */
function updatePaymentMethodUI(refs, method) {
  const isQris = method === "qris";
  refs.methodQrisBtn.classList.toggle("active", isQris);
  refs.methodDanaBtn.classList.toggle("active", !isQris);
  refs.methodQrisBtn.setAttribute("aria-selected", String(isQris));
  refs.methodDanaBtn.setAttribute("aria-selected", String(!isQris));
  refs.qrisPanel.hidden = !isQris;
  refs.danaPanel.hidden = isQris;
}

/** Wire up the QRIS/DANA toggle buttons; keeps refs.currentMethod in sync for the WA message. */
function initMethodToggle(refs) {
  function switchPaymentMethod(method) {
    if (!validatePaymentMethod(method)) return;
    refs.currentMethod = method;
    updatePaymentMethodUI(refs, method);
  }

  refs.methodQrisBtn.addEventListener("click", () => switchPaymentMethod("qris"));
  refs.methodDanaBtn.addEventListener("click", () => switchPaymentMethod("dana"));

  // Default: QRIS selected.
  switchPaymentMethod("qris");
}

/** Populates the QRIS and DANA panels from store_settings, each with its own empty state. */
function renderPaymentMethods(settings, refs) {
  const qrisUrl = settings && settings.qris_url;
  if (qrisUrl) {
    refs.qrisImage.src = qrisUrl;
    refs.qrisFrame.hidden = false;
    refs.qrisEmptyState.hidden = true;
  } else {
    refs.qrisFrame.hidden = true;
    refs.qrisEmptyState.hidden = false;
  }

  const danaNumber = settings && settings.dana_number;
  if (danaNumber) {
    refs.danaNumber.textContent = danaNumber;
    refs.danaRow.hidden = false;
    refs.danaEmptyState.hidden = true;
  } else {
    refs.danaRow.hidden = true;
    refs.danaEmptyState.hidden = false;
  }

  refs.paymentNoteText.textContent =
    (settings && settings.payment_note) || APP_CONFIG.defaultPaymentNote;
}

/** "Salin Nomor" → "Disalin" → back to "Salin Nomor", with a fallback if clipboard access fails. */
function initCopyDanaButton(refs) {
  refs.copyDanaBtn.addEventListener("click", async () => {
    const number = refs.danaNumber.textContent.trim();
    if (!number || number === "–") return;

    const originalLabel = "Salin Nomor";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(number);
      } else {
        throw new Error("Clipboard API tidak tersedia.");
      }
      refs.copyDanaBtn.textContent = "Disalin";
      showToast("Nomor DANA disalin.", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal menyalin. Salin manual nomor di atas.", "error");
      return;
    }

    setTimeout(() => {
      refs.copyDanaBtn.textContent = originalLabel;
    }, 1800);
  });
}

/**
 * Builds the "Hubungi Admin" WhatsApp message: product, price, chosen
 * payment method, and the customer's free-text request (or "Tidak ada"
 * if left blank). Plain text only — encodeURIComponent() (in
 * buildWhatsAppUrl / buildWhatsAppLink) handles newlines, emoji, and
 * special characters safely, so nothing here needs manual escaping.
 */
function buildWhatsAppMessage({ storeName, productName, priceText, method, request }) {
  const methodLabel = method === "dana" ? "DANA" : "QRIS";
  const trimmedRequest = (request || "").trim();
  const requestLine = trimmedRequest || "Tidak ada";

  return `Halo Admin ${storeName},

Saya ingin membeli:

Produk: ${productName}
Harga: ${priceText}
Metode Pembayaran: ${methodLabel}

Request Customer:
${requestLine}

Mohon diproses.`;
}

/** Thin wrapper over buildWhatsAppLink, named to match the WA-URL-building step. */
function buildWhatsAppUrl(rawNumber, message) {
  return buildWhatsAppLink(rawNumber, message);
}

document.addEventListener("DOMContentLoaded", async () => {
  const refs = {
    loading: document.getElementById("paymentLoading"),
    section: document.getElementById("paymentSection"),
    notFound: document.getElementById("paymentNotFound"),
    unavailable: document.getElementById("paymentUnavailable"),
    backLink: document.getElementById("backToProduct"),
    orderImage: document.getElementById("orderImage"),
    orderName: document.getElementById("orderName"),
    orderDescription: document.getElementById("orderDescription"),
    orderPrice: document.getElementById("orderPrice"),
    methodQrisBtn: document.getElementById("methodQrisBtn"),
    methodDanaBtn: document.getElementById("methodDanaBtn"),
    qrisPanel: document.getElementById("qrisPanel"),
    danaPanel: document.getElementById("danaPanel"),
    qrisFrame: document.getElementById("qrisFrame"),
    qrisImage: document.getElementById("qrisImage"),
    qrisEmptyState: document.getElementById("qrisEmptyState"),
    danaRow: document.getElementById("danaRow"),
    danaNumber: document.getElementById("danaNumber"),
    danaEmptyState: document.getElementById("danaEmptyState"),
    copyDanaBtn: document.getElementById("copyDanaBtn"),
    paymentNoteText: document.getElementById("paymentNoteText"),
    customerRequestInput: document.getElementById("customerRequestInput"),
    contactAdminBtn: document.getElementById("contactAdminBtn"),
    footerNameEl: document.getElementById("footerStoreName"),
    currentMethod: "qris",
  };

  const brandEl = document.getElementById("brandName");

  initAnnouncementBanner();

  const slug = getSlugFromUrl();
  if (!slug) {
    refs.loading.hidden = true;
    showNotFound(refs);
    return;
  }

  try {
    const [{ data: product, error: productError }, { data: settings }] = await Promise.all([
      supabaseClient
        .from("products")
        .select("name, slug, description, price, image_url, is_available, stock")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseClient
        .from("store_settings")
        .select("store_name, admin_whatsapp, qris_url, dana_number, payment_note, announcement_text")
        .limit(1)
        .maybeSingle(),
    ]);

    refs.loading.hidden = true;
    showAnnouncementBanner(settings && settings.announcement_text);

    const storeName = (settings && settings.store_name) || APP_CONFIG.storeNameFallback;
    if (brandEl) brandEl.textContent = storeName;
    if (refs.footerNameEl) {
      refs.footerNameEl.textContent = `© ${new Date().getFullYear()} ${storeName}`;
    }

    if (productError || !product) {
      showNotFound(refs);
      return;
    }

    if (!validateStock(product)) {
      refs.loading.hidden = true;
      refs.section.hidden = true;
      refs.notFound.hidden = true;
      refs.unavailable.hidden = false;
      return;
    }

    refs.section.hidden = false;
    refs.notFound.hidden = true;
    refs.unavailable.hidden = true;
    refs.backLink.href = `product.html?slug=${encodeURIComponent(product.slug)}`;

    refs.orderImage.src = product.image_url || "assets/placeholder.svg";
    refs.orderImage.alt = product.name;
    refs.orderImage.onerror = () => {
      refs.orderImage.src = "assets/placeholder.svg";
    };
    refs.orderName.textContent = product.name;
    refs.orderDescription.textContent = product.description || "";
    refs.orderPrice.textContent = formatPrice(product.price);
    document.title = `Pembayaran — ${product.name} — ${storeName}`;

    renderPaymentMethods(settings, refs);
    initMethodToggle(refs);
    initCopyDanaButton(refs);

    const whatsapp = settings && settings.admin_whatsapp;
    const priceText = refs.orderPrice.textContent;

    if (!whatsapp) {
      refs.contactAdminBtn.href = "#";
      refs.contactAdminBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Nomor WhatsApp admin belum diatur.", "error");
      });
    } else {
      // Built fresh on click (not once on load) so it always reflects
      // whichever payment method is currently selected and whatever the
      // customer has typed into Request Customer at that moment.
      refs.contactAdminBtn.addEventListener("click", (event) => {
        event.preventDefault();
        const message = buildWhatsAppMessage({
          storeName,
          productName: product.name,
          priceText,
          method: refs.currentMethod,
          request: refs.customerRequestInput ? refs.customerRequestInput.value : "",
        });
        const url = buildWhatsAppUrl(whatsapp, message);
        if (url) {
          window.open(url, "_blank", "noopener");
        } else {
          showToast("Nomor WhatsApp admin belum diatur.", "error");
        }
      });
    }
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat halaman pembayaran.");
    refs.loading.hidden = true;
    showNotFound(refs);
  }
});
