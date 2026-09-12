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
}

/** Wire up the QRIS/DANA toggle buttons and reveal the active panel. */
function initMethodToggle(refs) {
  function activate(method) {
    const isQris = method === "qris";
    refs.methodQrisBtn.classList.toggle("active", isQris);
    refs.methodDanaBtn.classList.toggle("active", !isQris);
    refs.methodQrisBtn.setAttribute("aria-selected", String(isQris));
    refs.methodDanaBtn.setAttribute("aria-selected", String(!isQris));
    refs.qrisPanel.hidden = !isQris;
    refs.danaPanel.hidden = isQris;
  }

  refs.methodQrisBtn.addEventListener("click", () => activate("qris"));
  refs.methodDanaBtn.addEventListener("click", () => activate("dana"));

  // Default: QRIS selected.
  activate("qris");
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

document.addEventListener("DOMContentLoaded", async () => {
  const refs = {
    loading: document.getElementById("paymentLoading"),
    section: document.getElementById("paymentSection"),
    notFound: document.getElementById("paymentNotFound"),
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
    contactAdminBtn: document.getElementById("contactAdminBtn"),
    footerNameEl: document.getElementById("footerStoreName"),
  };

  const brandEl = document.getElementById("brandName");

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
        .select("name, slug, description, price, image_url")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseClient
        .from("store_settings")
        .select("store_name, admin_whatsapp, qris_url, dana_number, payment_note")
        .limit(1)
        .maybeSingle(),
    ]);

    refs.loading.hidden = true;

    const storeName = (settings && settings.store_name) || APP_CONFIG.storeNameFallback;
    if (brandEl) brandEl.textContent = storeName;
    if (refs.footerNameEl) {
      refs.footerNameEl.textContent = `© ${new Date().getFullYear()} ${storeName}`;
    }

    if (productError || !product) {
      showNotFound(refs);
      return;
    }

    refs.section.hidden = false;
    refs.notFound.hidden = true;
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
    const waMessage = `Halo Admin ${storeName}, saya sudah melakukan pembayaran untuk produk: ${product.name}. Mohon dibantu proses pesanannya.`;
    const waLink = buildWhatsAppLink(whatsapp, waMessage);
    if (waLink) {
      refs.contactAdminBtn.href = waLink;
    } else {
      refs.contactAdminBtn.href = "#";
      refs.contactAdminBtn.addEventListener("click", (event) => {
        event.preventDefault();
        showToast("Nomor WhatsApp admin belum diatur.", "error");
      });
    }
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat halaman pembayaran.");
    refs.loading.hidden = true;
    showNotFound(refs);
  }
});
