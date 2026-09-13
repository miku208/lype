/**
 * product.js
 * Product detail page (product.html?slug=...).
 * Shows product info only — payment happens on payment.html.
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
    refs.image.onerror = () => {
      refs.image.src = "assets/placeholder.svg";
    };
  } else {
    refs.image.src = "assets/placeholder.svg";
    refs.image.alt = product.name;
  }

  if (product.country) {
    const flag = getCountryFlag(product.country);
    refs.countryBadge.textContent = flag ? `${flag} ${product.country}` : product.country;
    refs.countryBadge.hidden = false;
  } else {
    refs.countryBadge.hidden = true;
  }

  refs.category.textContent =
    (product.categories && product.categories.name) || "Produk Digital";
  refs.name.textContent = product.name;

  const priceInfo = resolveProductPriceDisplay(product);
  refs.price.textContent = priceInfo.text;
  refs.price.classList.toggle("unavailable", !priceInfo.available);

  const stockValue = Number(product.stock) || 0;
  refs.stock.textContent = stockValue > 0 ? `Stok: ${stockValue}` : "Stok habis";
  refs.stock.classList.toggle("out", stockValue <= 0);

  refs.description.textContent = product.description || APP_CONFIG.productDescriptionFallback;

  const storeName = (storeSettings && storeSettings.store_name) || APP_CONFIG.storeNameFallback;
  const whatsapp = storeSettings && storeSettings.admin_whatsapp;
  const nominal = formatPrice(product.price).replace(/^Rp\s*/, "");
  const waMessage = `Hallo Admin ${storeName} 👋

Saya tertarik dengan salah satu produk di ${storeName}.

🛒 Produk: ${product.name}
💳 Nominal: Rp${nominal}

Mohon informasi dan bantuannya. 🙏
Terima kasih, Admin!`;
  const waLink = buildWhatsAppLink(whatsapp, waMessage);

  if (waLink) {
    refs.contactBtn.href = waLink;
    refs.contactBtn.hidden = false;
  } else {
    refs.contactBtn.hidden = true;
  }

  if (priceInfo.available) {
    refs.beliBtn.href = `payment.html?slug=${encodeURIComponent(product.slug)}`;
    refs.beliBtn.classList.remove("is-disabled");
    refs.beliBtn.removeAttribute("aria-disabled");
    refs.beliBtn.innerHTML = `<span aria-hidden="true">🛒</span>&nbsp;Beli`;
  } else {
    refs.beliBtn.href = "#";
    refs.beliBtn.classList.add("is-disabled");
    refs.beliBtn.setAttribute("aria-disabled", "true");
    refs.beliBtn.innerHTML = "Tidak Tersedia";
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
    countryBadge: document.getElementById("productCountryBadge"),
    category: document.getElementById("productCategory"),
    name: document.getElementById("productName"),
    price: document.getElementById("productPrice"),
    stock: document.getElementById("productStock"),
    description: document.getElementById("productDescription"),
    beliBtn: document.getElementById("beliButton"),
    contactBtn: document.getElementById("contactWhatsApp"),
    footerNameEl: document.getElementById("footerStoreName"),
  };

  const brandEl = document.getElementById("brandName");

  initAnnouncementBanner();
  refs.beliBtn.addEventListener("click", (event) => {
    if (refs.beliBtn.classList.contains("is-disabled")) event.preventDefault();
  });

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
        .select("name, slug, description, price, image_url, country, price_label, is_available, stock, categories ( name, slug )")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseClient
        .from("store_settings")
        .select("store_name, admin_whatsapp, announcement_text")
        .limit(1)
        .maybeSingle(),
    ]);

    refs.loading.hidden = true;
    showAnnouncementBanner(settings && settings.announcement_text);

    if (brandEl && settings && settings.store_name) {
      brandEl.textContent = settings.store_name;
    }

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
