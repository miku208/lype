/**
 * app.js
 * Shared/public functionality: store settings + product catalog
 * for the homepage (index.html).
 */

async function loadStoreSettingsInto({ brandEl, headingEl, descEl, footerNameEl, footerWaEl, bannerWrapEl, bannerImgEl, heroMediaWrapEl }) {
  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("store_name, store_description, admin_whatsapp, banner_url, hero_media_url, announcement_text")
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    showAnnouncementBanner(data && data.announcement_text);

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
  card.dataset.slug = product.slug;

  // Open the quick-view bottom sheet instead of navigating away, for a
  // plain left-click. Ctrl/Cmd/middle-click etc. still open product.html
  // normally (new tab), and the href keeps working with JS disabled.
  card.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openProductSheet(product);
  });

  const thumb = document.createElement("div");
  if (product.image_url) {
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = product.image_url;
    img.alt = product.name;
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      thumb.className = "thumb placeholder";
      const icon = document.createElement("div");
      icon.className = "placeholder-icon";
      icon.textContent = "L";
      icon.setAttribute("aria-hidden", "true");
      thumb.appendChild(icon);
    };
    thumb.appendChild(img);
  } else {
    thumb.className = "thumb placeholder";
    const icon = document.createElement("div");
    icon.className = "placeholder-icon";
    icon.textContent = "L";
    icon.setAttribute("aria-hidden", "true");
    thumb.append(icon);
  }

  if (product.country) {
    const flag = getCountryFlag(product.country);
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = flag ? `${flag} ${product.country}` : product.country;
    thumb.appendChild(badge);
  }

  const body = document.createElement("div");
  body.className = "body";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = product.name;
  body.appendChild(name);

  if (product.description) {
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = product.description;
    body.appendChild(desc);
  }

  const priceInfo = resolveProductPriceDisplay(product);
  const price = document.createElement("div");
  price.className = "price" + (priceInfo.available ? "" : " unavailable");
  price.textContent = priceInfo.text;
  body.appendChild(price);

  const stockValue = Number(product.stock) || 0;
  const stockEl = document.createElement("div");
  stockEl.className = "stock" + (stockValue > 0 ? "" : " out");
  stockEl.textContent = stockValue > 0 ? `Stok: ${stockValue}` : "Stok habis";
  body.appendChild(stockEl);

  const cta = document.createElement("div");
  cta.className = "cta";
  cta.textContent = priceInfo.available ? "Lihat Produk →" : "Lihat Detail →";
  body.appendChild(cta);
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

/* ------------------------------------------------------------
 * Category filter + search (client-side, over the already-loaded
 * active product list — keeps the storefront snappy without an
 * extra round-trip per click).
 * ------------------------------------------------------------ */
let catalogState = {
  products: [],
  categories: [],
  activeCategorySlug: "",
  query: "",
};

function renderCategoryChips(filterEl) {
  if (!filterEl) return;

  const total = catalogState.products.length;
  const countsBySlug = {};
  catalogState.products.forEach((p) => {
    const slug = (p.categories && p.categories.slug) || null;
    if (!slug) return;
    countsBySlug[slug] = (countsBySlug[slug] || 0) + 1;
  });

  filterEl.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.type = "button";
  allChip.className = "chip" + (catalogState.activeCategorySlug === "" ? " active" : "");
  allChip.setAttribute("role", "tab");
  allChip.setAttribute("aria-selected", String(catalogState.activeCategorySlug === ""));
  allChip.dataset.slug = "";
  allChip.innerHTML = `Semua <span class="chip-count">${total}</span>`;
  allChip.addEventListener("click", () => setActiveCategory("", filterEl));
  filterEl.appendChild(allChip);

  catalogState.categories.forEach((category) => {
    const count = countsBySlug[category.slug] || 0;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (catalogState.activeCategorySlug === category.slug ? " active" : "");
    chip.setAttribute("role", "tab");
    chip.setAttribute("aria-selected", String(catalogState.activeCategorySlug === category.slug));
    chip.dataset.slug = category.slug;
    chip.innerHTML = `${category.name} <span class="chip-count">${count}</span>`;
    chip.addEventListener("click", () => setActiveCategory(category.slug, filterEl));
    filterEl.appendChild(chip);
  });
}

function setActiveCategory(slug, filterEl) {
  catalogState.activeCategorySlug = slug;
  renderCategoryChips(filterEl);
  renderFilteredProducts();
}

function renderFilteredProducts() {
  const gridEl = document.getElementById("productGrid");
  if (!gridEl) return;

  const query = catalogState.query.trim().toLowerCase();
  const slug = catalogState.activeCategorySlug;

  const filtered = catalogState.products.filter((product) => {
    const matchesCategory = !slug || (product.categories && product.categories.slug === slug);
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      (product.description && product.description.toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });

  gridEl.innerHTML = "";
  if (filtered.length === 0) {
    showMessage(gridEl, "Tidak ada produk yang cocok.");
  } else {
    filtered.forEach((product) => gridEl.appendChild(renderProductCard(product)));
  }
  updateProductCountDisplays(filtered.length);
}

async function loadCategoriesData() {
  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("id, name, slug")
      .order("name", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat kategori.");
    return [];
  }
}

async function loadProductsInto(gridEl, filterEl) {
  showLoading(gridEl, "Memuat produk...");
  try {
    const [{ data, error }, categories] = await Promise.all([
      supabaseClient
        .from("products")
        .select("name, slug, description, price, image_url, country, price_label, is_available, stock, categories ( name, slug )")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      loadCategoriesData(),
    ]);

    if (error) throw error;

    catalogState.products = data || [];
    catalogState.categories = categories;

    if (catalogState.products.length === 0) {
      showMessage(gridEl, "Belum ada produk.");
      updateProductCountDisplays(0);
      renderCategoryChips(filterEl);
      return;
    }

    renderCategoryChips(filterEl);
    renderFilteredProducts();
  } catch (error) {
    const message = safeErrorMessage(error, "Gagal memuat produk. Coba muat ulang halaman.");
    showMessage(gridEl, message);
  }
}

/* ------------------------------------------------------------
 * Product quick-view bottom sheet (index.html only).
 * Reuses the product list already fetched for the grid — no
 * extra request needed to show name/price/description/image.
 * ------------------------------------------------------------ */
let sheetState = {
  whatsapp: null,
  storeName: "",
  refs: null,
  openSlug: null,
};

function getSheetRefs() {
  if (sheetState.refs) return sheetState.refs;
  const overlay = document.getElementById("productSheetOverlay");
  if (!overlay) return null;
  sheetState.refs = {
    overlay,
    sheet: document.getElementById("productSheet"),
    closeBtn: document.getElementById("sheetCloseBtn"),
    image: document.getElementById("sheetProductImage"),
    countryBadge: document.getElementById("sheetCountryBadge"),
    category: document.getElementById("sheetProductCategory"),
    name: document.getElementById("sheetProductName"),
    price: document.getElementById("sheetProductPrice"),
    stock: document.getElementById("sheetProductStock"),
    description: document.getElementById("sheetProductDescription"),
    beliBtn: document.getElementById("sheetBeliBtn"),
    contactBtn: document.getElementById("sheetContactBtn"),
  };
  return sheetState.refs;
}

function openProductSheet(product, options = {}) {
  const refs = getSheetRefs();
  if (!refs || !product) return;

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

  refs.category.textContent = (product.categories && product.categories.name) || "Produk Digital";
  refs.name.textContent = product.name;
  refs.description.textContent = product.description || APP_CONFIG.productDescriptionFallback;

  if (product.country) {
    const flag = getCountryFlag(product.country);
    refs.countryBadge.textContent = flag ? `${flag} ${product.country}` : product.country;
    refs.countryBadge.hidden = false;
  } else {
    refs.countryBadge.hidden = true;
  }

  const priceInfo = resolveProductPriceDisplay(product);
  refs.price.textContent = priceInfo.text;
  refs.price.classList.toggle("unavailable", !priceInfo.available);

  if (refs.stock) {
    const stockValue = Number(product.stock) || 0;
    refs.stock.textContent = stockValue > 0 ? `Stok: ${stockValue}` : "Stok habis";
    refs.stock.classList.toggle("out", stockValue <= 0);
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

  const storeName = sheetState.storeName || APP_CONFIG.storeNameFallback;
  const nominal = formatPrice(product.price).replace(/^Rp\s*/, "");
  const waMessage = `Hallo Admin ${storeName} 👋

Saya tertarik dengan salah satu produk di ${storeName}.

🛒 Produk: ${product.name}
💳 Nominal: Rp${nominal}

Mohon informasi dan bantuannya. 🙏
Terima kasih, Admin!`;
  const waLink = buildWhatsAppLink(sheetState.whatsapp, waMessage);
  if (waLink) {
    refs.contactBtn.href = waLink;
    refs.contactBtn.hidden = false;
  } else {
    refs.contactBtn.hidden = true;
  }

  refs.overlay.hidden = false;
  requestAnimationFrame(() => refs.overlay.classList.add("open"));
  document.body.style.overflow = "hidden";
  sheetState.openSlug = product.slug;

  if (!options.skipHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("produk", product.slug);
    history.pushState({ produkSheet: product.slug }, "", url);
  }
}

function closeProductSheet(options = {}) {
  const refs = getSheetRefs();
  if (!refs || refs.overlay.hidden) return;

  refs.overlay.classList.remove("open");
  document.body.style.overflow = "";
  sheetState.openSlug = null;
  setTimeout(() => {
    refs.overlay.hidden = true;
  }, 320);

  if (!options.skipHistory) {
    const url = new URL(window.location.href);
    if (url.searchParams.has("produk")) {
      url.searchParams.delete("produk");
      history.pushState({}, "", url);
    }
  }
}

function initProductSheet() {
  const refs = getSheetRefs();
  if (!refs) return;

  refs.closeBtn.addEventListener("click", () => closeProductSheet());
  refs.beliBtn.addEventListener("click", (event) => {
    if (refs.beliBtn.classList.contains("is-disabled")) event.preventDefault();
  });
  refs.overlay.addEventListener("click", (event) => {
    if (event.target === refs.overlay) closeProductSheet();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !refs.overlay.hidden) closeProductSheet();
  });
  window.addEventListener("popstate", () => {
    const slug = new URLSearchParams(window.location.search).get("produk");
    if (!slug) {
      closeProductSheet({ skipHistory: true });
      return;
    }
    const product = catalogState.products.find((p) => p.slug === slug);
    if (product) openProductSheet(product, { skipHistory: true });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const brandEl = document.getElementById("brandName");
  const headingEl = document.getElementById("storeHeading");
  const descEl = document.getElementById("storeDescription");
  const footerNameEl = document.getElementById("footerStoreName");
  const footerWaEl = document.getElementById("footerWhatsApp");
  const gridEl = document.getElementById("productGrid");
  const filterEl = document.getElementById("categoryFilter");
  const searchEl = document.getElementById("productSearchInput");
  const bannerWrapEl = document.getElementById("storeBanner");
  const bannerImgEl = document.getElementById("storeBannerImage");
  const heroMediaWrapEl = document.getElementById("heroMedia");

  initProductSheet();
  initAnnouncementBanner();

  const settings = await loadStoreSettingsInto({ brandEl, headingEl, descEl, footerNameEl, footerWaEl, bannerWrapEl, bannerImgEl, heroMediaWrapEl });
  if (settings) {
    sheetState.whatsapp = settings.whatsapp;
    sheetState.storeName = settings.storeName;
  }

  if (gridEl) await loadProductsInto(gridEl, filterEl);

  // Deep link support: open the sheet directly if ?produk=slug is in the URL.
  const initialSlug = new URLSearchParams(window.location.search).get("produk");
  if (initialSlug) {
    const product = catalogState.products.find((p) => p.slug === initialSlug);
    if (product) openProductSheet(product, { skipHistory: true });
  }

  if (searchEl) {
    searchEl.addEventListener("input", (event) => {
      catalogState.query = event.target.value;
      renderFilteredProducts();
    });
  }
});
