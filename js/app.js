/**
 * app.js
 * Shared/public functionality: store settings + the nested catalog
 * browsing flow for the homepage (index.html).
 *
 * Flow: Etalase (top-level catalogs) -> Sub-catalogs -> Products.
 * A top-level catalog with no sub-catalogs is treated as a leaf and
 * shows its own products directly (keeps flat/legacy catalogs working
 * without forcing every catalog to have a sub-catalog layer).
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
      const safeBannerUrl = sanitizeUrl(bannerUrl);
      if (safeBannerUrl) {
        bannerImgEl.src = safeBannerUrl;
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
function renderHeroMedia(wrapEl, rawUrl, storeName) {
  const url = sanitizeUrl(rawUrl);
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

/* ------------------------------------------------------------
 * Product card (used inside a leaf catalog's product grid)
 * ------------------------------------------------------------ */
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
  const safeImageUrl = sanitizeUrl(product.image_url);
  if (safeImageUrl) {
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = safeImageUrl;
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

/** Catalog / sub-catalog card — same visual language as a product card. */
function renderCatalogCard(catalogItem, onClick) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "product-card catalog-card";
  card.dataset.slug = catalogItem.slug;
  card.addEventListener("click", () => onClick(catalogItem));

  const thumb = document.createElement("div");
  const safeImageUrl = sanitizeUrl(catalogItem.image_url);
  if (safeImageUrl) {
    thumb.className = "thumb";
    const img = document.createElement("img");
    img.src = safeImageUrl;
    img.alt = catalogItem.name;
    img.loading = "lazy";
    img.onerror = () => {
      img.remove();
      thumb.className = "thumb placeholder";
      const icon = document.createElement("div");
      icon.className = "placeholder-icon";
      icon.textContent = (catalogItem.name || "?").charAt(0).toUpperCase();
      icon.setAttribute("aria-hidden", "true");
      thumb.appendChild(icon);
    };
    thumb.appendChild(img);
  } else {
    thumb.className = "thumb placeholder";
    const icon = document.createElement("div");
    icon.className = "placeholder-icon";
    icon.textContent = (catalogItem.name || "?").charAt(0).toUpperCase();
    icon.setAttribute("aria-hidden", "true");
    thumb.append(icon);
  }

  const body = document.createElement("div");
  body.className = "body";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = catalogItem.name;
  body.appendChild(name);

  if (catalogItem.description) {
    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = catalogItem.description;
    body.appendChild(desc);
  }

  const cta = document.createElement("div");
  cta.className = "cta";
  cta.textContent = "Lihat →";
  body.appendChild(cta);

  card.append(thumb, body);
  return card;
}

function updateProductCountDisplays(count) {
  const chipEl = document.getElementById("productCountChip");
  const chipValueEl = document.getElementById("productCountValue");
  if (chipValueEl) chipValueEl.textContent = String(count);
  if (chipEl) chipEl.hidden = count === 0;
}

async function loadHeroProductCount() {
  const heroCountEl = document.getElementById("heroProductCount");
  if (!heroCountEl) return;
  try {
    const { count, error } = await supabaseClient
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    if (error) throw error;
    heroCountEl.textContent = String(count || 0);
  } catch (error) {
    console.error(error);
    heroCountEl.textContent = "–";
  }
}

/* ------------------------------------------------------------
 * Nested catalog navigation state machine.
 * level: 'catalogs' | 'subcatalogs' | 'products'
 * ------------------------------------------------------------ */
let viewState = {
  level: "catalogs",
  catalog: null, // current top-level catalog (or leaf catalog) record
  subcatalog: null, // current sub-catalog record, if any
  products: [],
  query: "",
};

async function fetchTopCatalogs() {
  const { data, error } = await supabaseClient
    .from("catalogs")
    .select("id, name, slug, description, image_url")
    .is("parent_catalog_id", null)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchSubcatalogs(parentId) {
  const { data, error } = await supabaseClient
    .from("catalogs")
    .select("id, name, slug, description, image_url")
    .eq("parent_catalog_id", parentId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchProductsForCatalog(catalogId) {
  const { data, error } = await supabaseClient
    .from("products")
    .select(
      "id, name, slug, description, price, image_url, country, price_label, is_available, stock, catalog_id, catalogs ( name, slug )"
    )
    .eq("catalog_id", catalogId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchCatalogBySlug(slug, parentId) {
  let query = supabaseClient
    .from("catalogs")
    .select("id, name, slug, description, image_url, parent_catalog_id")
    .eq("slug", slug)
    .eq("is_active", true);
  query = parentId ? query.eq("parent_catalog_id", parentId) : query.is("parent_catalog_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

function toggleSearchVisibility(show) {
  const wrap = document.getElementById("productSearchWrap");
  if (wrap) wrap.hidden = !show;
}

function pushCatalogUrl(params) {
  const url = new URL(window.location.href);
  url.searchParams.delete("cat");
  url.searchParams.delete("sub");
  if (params.cat) url.searchParams.set("cat", params.cat);
  if (params.sub) url.searchParams.set("sub", params.sub);
  history.pushState({}, "", url);
}

/** Renders "Etalase → Catalog → Sub-catalog", overflow-safe on mobile. */
function renderBreadcrumb() {
  const el = document.getElementById("catalogBreadcrumb");
  if (!el) return;
  el.innerHTML = "";

  const crumbs = [{ label: "Etalase", onClick: () => showCatalogsLevel() }];
  if (viewState.catalog) {
    const catalog = viewState.catalog;
    crumbs.push({ label: catalog.name, onClick: () => showSubcatalogsLevel(catalog) });
  }
  if (viewState.subcatalog) {
    crumbs.push({ label: viewState.subcatalog.name, onClick: null });
  }

  crumbs.forEach((crumb, index) => {
    if (index > 0) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "→";
      sep.setAttribute("aria-hidden", "true");
      el.appendChild(sep);
    }

    const isCurrent = index === crumbs.length - 1;
    if (isCurrent) {
      const span = document.createElement("span");
      span.className = "crumb-current";
      span.textContent = crumb.label;
      el.appendChild(span);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "crumb-link";
      btn.textContent = crumb.label;
      btn.addEventListener("click", crumb.onClick);
      el.appendChild(btn);
    }
  });
}

function updateBackButton() {
  const btn = document.getElementById("catalogBackBtn");
  if (!btn) return;

  if (viewState.level === "catalogs") {
    btn.hidden = true;
    return;
  }

  btn.hidden = false;
  btn.onclick = () => {
    if (viewState.level === "subcatalogs") {
      showCatalogsLevel();
    } else if (viewState.level === "products") {
      if (viewState.subcatalog) {
        showSubcatalogsLevel(viewState.catalog);
      } else {
        showCatalogsLevel();
      }
    }
  };
}

async function showCatalogsLevel(options = {}) {
  viewState.level = "catalogs";
  viewState.catalog = null;
  viewState.subcatalog = null;
  viewState.products = [];

  renderBreadcrumb();
  updateBackButton();
  toggleSearchVisibility(false);
  updateProductCountDisplays(0);

  const stage = document.getElementById("catalogStage");
  if (stage) {
    showLoading(stage, "Memuat etalase...");
    try {
      const catalogs = await fetchTopCatalogs();
      stage.innerHTML = "";
      if (!catalogs.length) {
        showMessage(stage, "Belum ada katalog.");
      } else {
        const grid = document.createElement("div");
        grid.className = "product-grid catalog-grid";
        catalogs.forEach((catalogItem) => {
          grid.appendChild(renderCatalogCard(catalogItem, () => showSubcatalogsLevel(catalogItem)));
        });
        stage.appendChild(grid);
      }
    } catch (error) {
      showMessage(stage, safeErrorMessage(error, "Gagal memuat katalog."));
    }
  }

  if (!options.skipHistory) pushCatalogUrl({});
}

async function showSubcatalogsLevel(catalogItem, options = {}) {
  viewState.level = "subcatalogs";
  viewState.catalog = catalogItem;
  viewState.subcatalog = null;

  renderBreadcrumb();
  updateBackButton();
  toggleSearchVisibility(false);
  updateProductCountDisplays(0);

  const stage = document.getElementById("catalogStage");
  try {
    const subcatalogs = await fetchSubcatalogs(catalogItem.id);

    if (subcatalogs.length === 0) {
      // No sub-catalogs: treat this catalog itself as a leaf and show
      // its products directly (keeps flat/legacy catalogs working).
      await showProductsLevel(catalogItem, null, { skipHistory: true });
      if (!options.skipHistory) pushCatalogUrl({ cat: catalogItem.slug });
      return;
    }

    if (stage) {
      stage.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "product-grid catalog-grid";
      subcatalogs.forEach((sub) => {
        grid.appendChild(renderCatalogCard(sub, () => showProductsLevel(catalogItem, sub)));
      });
      stage.appendChild(grid);
    }
  } catch (error) {
    if (stage) showMessage(stage, safeErrorMessage(error, "Gagal memuat sub-katalog."));
  }

  if (!options.skipHistory) pushCatalogUrl({ cat: catalogItem.slug });
}

async function showProductsLevel(catalogItem, subcatalogItem, options = {}) {
  viewState.level = "products";
  viewState.catalog = catalogItem;
  viewState.subcatalog = subcatalogItem || null;
  viewState.query = "";

  const searchInput = document.getElementById("productSearchInput");
  if (searchInput) searchInput.value = "";

  renderBreadcrumb();
  updateBackButton();
  toggleSearchVisibility(true);

  const stage = document.getElementById("catalogStage");
  const leafId = (subcatalogItem || catalogItem).id;

  if (stage) {
    showLoading(stage, "Memuat produk...");
    try {
      const products = await fetchProductsForCatalog(leafId);
      viewState.products = products;
      stage.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "product-grid";
      grid.id = "productGrid";
      stage.appendChild(grid);
      renderFilteredProducts();
    } catch (error) {
      showMessage(stage, safeErrorMessage(error, "Gagal memuat produk. Coba muat ulang halaman."));
    }
  }

  if (!options.skipHistory) {
    pushCatalogUrl({ cat: catalogItem.slug, sub: subcatalogItem ? subcatalogItem.slug : undefined });
  }
}

function renderFilteredProducts() {
  const gridEl = document.getElementById("productGrid");
  if (!gridEl) return;

  const query = viewState.query.trim().toLowerCase();
  const filtered = viewState.products.filter((product) => {
    if (!query) return true;
    return (
      product.name.toLowerCase().includes(query) ||
      (product.description && product.description.toLowerCase().includes(query))
    );
  });

  gridEl.innerHTML = "";
  if (filtered.length === 0) {
    showMessage(
      gridEl,
      viewState.products.length ? "Tidak ada produk yang cocok." : "Belum ada produk di katalog ini."
    );
  } else {
    filtered.forEach((product) => gridEl.appendChild(renderProductCard(product)));
  }
  updateProductCountDisplays(filtered.length);
}

/** Re-derives the current view purely from the URL's ?cat=&sub= params. */
async function restoreCatalogFromUrl(options = {}) {
  const params = new URLSearchParams(window.location.search);
  const catSlug = params.get("cat");
  const subSlug = params.get("sub");

  if (!catSlug) {
    await showCatalogsLevel({ skipHistory: true });
    return;
  }

  try {
    const catalogItem = await fetchCatalogBySlug(catSlug, null);
    if (!catalogItem) {
      await showCatalogsLevel({ skipHistory: true });
      return;
    }

    if (subSlug) {
      const sub = await fetchCatalogBySlug(subSlug, catalogItem.id);
      if (!sub) {
        await showSubcatalogsLevel(catalogItem, { skipHistory: true });
        return;
      }
      await showProductsLevel(catalogItem, sub, { skipHistory: true });
    } else {
      await showSubcatalogsLevel(catalogItem, { skipHistory: true });
    }
  } catch (error) {
    console.error(error);
    await showCatalogsLevel({ skipHistory: true });
  }
}

/* ------------------------------------------------------------
 * Product quick-view bottom sheet (index.html only).
 * ------------------------------------------------------------ */
let sheetState = {
  whatsapp: null,
  storeName: "",
  refs: null,
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

  const safeSheetImageUrl = sanitizeUrl(product.image_url);
  if (safeSheetImageUrl) {
    refs.image.src = safeSheetImageUrl;
    refs.image.alt = product.name;
    refs.image.onerror = () => {
      refs.image.src = "assets/placeholder.svg";
    };
  } else {
    refs.image.src = "assets/placeholder.svg";
    refs.image.alt = product.name;
  }

  refs.category.textContent = (product.catalogs && product.catalogs.name) || "Produk Digital";
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

  if (!options.skipHistory) {
    const url = new URL(window.location.href);
    url.searchParams.set("produk", product.slug);
    history.pushState({}, "", url);
  }
}

function closeProductSheet(options = {}) {
  const refs = getSheetRefs();
  if (!refs || refs.overlay.hidden) return;

  refs.overlay.classList.remove("open");
  document.body.style.overflow = "";
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

/** Deep-link/independent lookup: fetches a single product by slug and opens the sheet. */
async function openProductSheetBySlug(slug, options = {}) {
  try {
    const { data: product, error } = await supabaseClient
      .from("products")
      .select(
        "id, name, slug, description, price, image_url, country, price_label, is_available, stock, catalog_id, catalogs ( name, slug )"
      )
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !product) return;
    openProductSheet(product, options);
  } catch (error) {
    console.error(error);
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
}

document.addEventListener("DOMContentLoaded", async () => {
  const brandEl = document.getElementById("brandName");
  const headingEl = document.getElementById("storeHeading");
  const descEl = document.getElementById("storeDescription");
  const footerNameEl = document.getElementById("footerStoreName");
  const footerWaEl = document.getElementById("footerWhatsApp");
  const bannerWrapEl = document.getElementById("storeBanner");
  const bannerImgEl = document.getElementById("storeBannerImage");
  const heroMediaWrapEl = document.getElementById("heroMedia");
  const searchEl = document.getElementById("productSearchInput");

  initProductSheet();
  initAnnouncementBanner();

  const settings = await loadStoreSettingsInto({ brandEl, headingEl, descEl, footerNameEl, footerWaEl, bannerWrapEl, bannerImgEl, heroMediaWrapEl });
  if (settings) {
    sheetState.whatsapp = settings.whatsapp;
    sheetState.storeName = settings.storeName;
  }

  loadHeroProductCount();

  // Initial render: restore whichever catalog/sub-catalog level (if any)
  // is encoded in the URL, then open the quick-view sheet on top of it
  // if a ?produk= deep link is also present.
  await restoreCatalogFromUrl({ skipHistory: true });

  const initialSlug = new URLSearchParams(window.location.search).get("produk");
  if (initialSlug) {
    openProductSheetBySlug(initialSlug, { skipHistory: true });
  }

  if (searchEl) {
    searchEl.addEventListener("input", (event) => {
      viewState.query = event.target.value;
      renderFilteredProducts();
    });
  }

  window.addEventListener("popstate", () => {
    const slug = new URLSearchParams(window.location.search).get("produk");
    if (!slug) {
      closeProductSheet({ skipHistory: true });
    } else {
      openProductSheetBySlug(slug, { skipHistory: true });
    }
    restoreCatalogFromUrl({ skipHistory: true });
  });
});
