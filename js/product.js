/**
 * product.js
 * Product detail page (product.html?slug=...).
 */

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function updateProductMeta(product, storeName) {
  const title = `${product.name} — ${storeName}`;
  const description = product.description || APP_CONFIG.productDescriptionFallback;
  const image = product.image_url
    ? product.image_url
    : absoluteUrl(APP_CONFIG.defaultOgImage);
  const url = absoluteUrl(`/product.html?slug=${encodeURIComponent(product.slug)}`);

  document.title = title;
  setMetaName("description", description);

  setMetaProperty("og:type", "product");
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:image", image);
  setMetaProperty("og:site_name", storeName);
  setMetaProperty("og:url", url);

  setMetaName("twitter:card", "summary_large_image");
  setMetaName("twitter:title", title);
  setMetaName("twitter:description", description);
  setMetaName("twitter:image", image);
}

function renderProduct(product, storeSettings, refs) {
  refs.detail.hidden = false;
  refs.notFound.hidden = true;

  if (product.image_url) {
    refs.image.src = product.image_url;
    refs.image.alt = product.name;
  } else {
    refs.image.src = APP_CONFIG.defaultOgImage;
    refs.image.alt = product.name;
  }

  refs.name.textContent = product.name;
  refs.price.textContent = formatPrice(product.price);
  refs.description.textContent = product.description || APP_CONFIG.productDescriptionFallback;

  const storeName = (storeSettings && storeSettings.store_name) || APP_CONFIG.storeNameFallback;
  const whatsapp = storeSettings && storeSettings.admin_whatsapp;
  const waMessage = `Halo ${storeName}, saya tertarik dengan produk "${product.name}".`;
  const waLink = buildWhatsAppLink(whatsapp, waMessage);

  if (waLink) {
    refs.contactBtn.href = waLink;
    refs.contactBtn.hidden = false;
  } else {
    refs.contactBtn.hidden = true;
  }

  const qrisUrl = storeSettings && storeSettings.qris_url;
  if (qrisUrl) {
    refs.qrisBox.hidden = false;
    refs.qrisImage.src = qrisUrl;
    refs.qrisImage.alt = "QRIS pembayaran";
  } else {
    refs.qrisBox.hidden = true;
  }

  refs.footerNameEl.textContent = `© ${new Date().getFullYear()} ${storeName}`;
  updateProductMeta(product, storeName);
}

function showNotFound(refs) {
  refs.detail.hidden = true;
  refs.notFound.hidden = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  const refs = {
    loading: document.getElementById("productLoading"),
    detail: document.getElementById("productDetail"),
    notFound: document.getElementById("productNotFound"),
    image: document.getElementById("productImage"),
    name: document.getElementById("productName"),
    price: document.getElementById("productPrice"),
    description: document.getElementById("productDescription"),
    contactBtn: document.getElementById("contactWhatsApp"),
    qrisBox: document.getElementById("qrisBox"),
    qrisImage: document.getElementById("qrisImage"),
    footerNameEl: document.getElementById("footerStoreName"),
  };

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
        .select("store_name, admin_whatsapp, qris_url")
        .limit(1)
        .maybeSingle(),
    ]);

    refs.loading.hidden = true;

    if (productError || !product) {
      showNotFound(refs);
      return;
    }

    renderProduct(product, settings, refs);
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat produk.");
    refs.loading.hidden = true;
    showNotFound(refs);
  }
});
