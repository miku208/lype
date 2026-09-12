/**
 * app.js
 * Shared/public functionality: store settings + product catalog
 * for the homepage (index.html).
 */

async function loadStoreSettingsInto({ brandEl, headingEl, descEl, footerNameEl, footerWaEl, bannerWrapEl, bannerImgEl, heroMediaWrapEl }) {
  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("store_name, store_description, admin_whatsapp, banner_url, hero_media_url")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    const storeName = (data && data.store_name) || APP_CONFIG.storeNameFallback;
    const storeDescription =
      (data && data.store_description) || APP_CONFIG.storeDescriptionFallback;
    const whatsapp = data && data.admin_whatsapp;
    const bannerUrl = data && data.banner_url;
    const heroMediaUrl = data && data.hero_media_url;

    if (brandEl) brandEl.textContent = storeName;
    if (headingEl) headingEl.textContent = storeName;
    if (descEl) descEl.textContent = storeDescription;
    if (footerNameEl) footerNameEl.textContent = `© ${new Date().getFullYear()} ${storeName}`;

    if (bannerWrapEl && bannerImgEl) {
      if (bannerUrl) {
        bannerImgEl.src = bannerUrl;
        bannerImgEl.alt = storeName;
        bannerWrapEl.hidden = false;
      } else {
        bannerWrapEl.hidden = true;
      }
    }

    if (heroMediaWrapEl) {
      renderHeroMedia(heroMediaWrapEl, heroMediaUrl, storeName);
    }

    if (footerWaEl) {
      const link = buildWhatsAppLink(whatsapp, `Halo ${storeName}, saya ingin bertanya.`);
      if (link) {
        footerWaEl.href = link;
        footerWaEl.textContent = "Hubungi via WhatsApp";
        footerWaEl.hidden = false;
      } else {
        footerWaEl.hidden = true;
      }
    }

    document.title = `${storeName} — Katalog Produk Digital`;
    setMetaName("description", storeDescription);
    setMetaProperty("og:title", storeName);
    setMetaProperty("og:description", storeDescription);
    setMetaProperty("og:site_name", storeName);
    setMetaProperty("og:url", absoluteUrl("/"));
    setMetaProperty("og:image", absoluteUrl(APP_CONFIG.defaultOgImage));
    setMetaName("twitter:title", storeName);
    setMetaName("twitter:description", storeDescription);
    setMetaName("twitter:image", absoluteUrl(APP_CONFIG.defaultOgImage));

    return { storeName, storeDescription, whatsapp };
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat informasi toko.");
    if (brandEl) brandEl.textContent = APP_CONFIG.storeNameFallback;
    if (headingEl) headingEl.textContent = APP_CONFIG.storeNameFallback;
    if (descEl) descEl.textContent = APP_CONFIG.storeDescriptionFallback;
    return null;
  }
}

/**
 * Fills the hero visual with a real image/GIF/video when
 * store_settings.hero_media_url is set; otherwise hides the wrap.
 */
function renderHeroMedia(wrapEl, url, storeName) {
  if (!url) {
    wrapEl.hidden = true;
    wrapEl.innerHTML = "";
    return;
  }

  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  wrapEl.innerHTML = "";

  if (isVideo) {
    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    wrapEl.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = url;
    img.alt = storeName;
    img.loading = "lazy";
    wrapEl.appendChild(img);
  }

  wrapEl.hidden = false;
}

function renderProductCard(product) {
  const card = document.createElement("a");
  card.className = "product-card";
  card.href = `product.html?slug=${encodeURIComponent(product.slug)}`;

  const thumb = document.createElement("div");
  if (product.image_url) {
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = product.image_url;
    img.alt = product.name;
    img.loading = "lazy";
    thumb.appendChild(img);
  } else {
    thumb.className = "thumb placeholder";
    const icon = document.createElement("div");
    icon.className = "placeholder-icon";
    icon.textContent = "L";
    icon.setAttribute("aria-hidden", "true");
    thumb.append(icon);
  }

  const body = document.createElement("div");
  body.className = "body";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = product.name;

  const price = document.createElement("div");
  price.className = "price";
  price.textContent = formatPrice(product.price);

  const cta = document.createElement("div");
  cta.className = "cta";
  cta.textContent = "Lihat Produk →";

  body.append(name, price, cta);
  card.append(thumb, body);
  return card;
}

function updateProductCountDisplays(count) {
  const heroCountEl = document.getElementById("heroProductCount");
  const chipEl = document.getElementById("productCountChip");
  const chipValueEl = document.getElementById("productCountValue");

  if (heroCountEl) heroCountEl.textContent = String(count);
  if (chipValueEl) chipValueEl.textContent = String(count);
  if (chipEl) chipEl.hidden = count === 0;
}

async function loadProductsInto(gridEl) {
  showLoading(gridEl, "Memuat produk...");
  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("name, slug, description, price, image_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      showMessage(gridEl, "Belum ada produk.");
      updateProductCountDisplays(0);
      return;
    }

    gridEl.innerHTML = "";
    data.forEach((product) => {
      gridEl.appendChild(renderProductCard(product));
    });
    updateProductCountDisplays(data.length);
  } catch (error) {
    const message = safeErrorMessage(error, "Gagal memuat produk. Coba muat ulang halaman.");
    showMessage(gridEl, message);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const brandEl = document.getElementById("brandName");
  const headingEl = document.getElementById("storeHeading");
  const descEl = document.getElementById("storeDescription");
  const footerNameEl = document.getElementById("footerStoreName");
  const footerWaEl = document.getElementById("footerWhatsApp");
  const gridEl = document.getElementById("productGrid");
  const bannerWrapEl = document.getElementById("storeBanner");
  const bannerImgEl = document.getElementById("storeBannerImage");
  const heroMediaWrapEl = document.getElementById("heroMedia");

  await loadStoreSettingsInto({ brandEl, headingEl, descEl, footerNameEl, footerWaEl, bannerWrapEl, bannerImgEl, heroMediaWrapEl });
  if (gridEl) await loadProductsInto(gridEl);
});
