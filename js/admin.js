/**
 * admin.js
 * Powers manage-x7k/dashboard.html: store settings, product CRUD,
 * and image upload. Uses toast notifications and a custom confirm
 * dialog instead of window.alert()/window.confirm() (see utils.js).
 */

/* ------------------------------------------------------------
 * Image upload abstraction
 * IMAGE_CONFIG.provider decides which host is used. The rest of
 * the app only ever calls uploadProductImage(file) and stores the
 * returned public URL — never a binary blob, never a local path.
 * ------------------------------------------------------------ */
function validateImageFile(file) {
  if (!file) return { ok: false, reason: "Tidak ada file dipilih." };
  if (!IMAGE_CONFIG.allowedMimeTypes.includes(file.type)) {
    return { ok: false, reason: "Tipe file tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF." };
  }
  if (file.size > IMAGE_CONFIG.maxFileSizeBytes) {
    return { ok: false, reason: "Ukuran file terlalu besar (maksimal 5MB)." };
  }
  return { ok: true };
}

async function uploadToCatbox(file) {
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", file);

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("Upload gagal.");
  const url = (await response.text()).trim();
  if (!url.startsWith("http")) throw new Error("Respons upload tidak valid.");
  return url;
}

/**
 * Kappa.lol — simple single-request host, usable directly from the
 * browser (unlike Upload.ee, it doesn't need a multi-step session
 * flow or headers the browser refuses to let JS set).
 */
async function uploadToKappa(file) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  const response = await fetch("https://kappa.lol/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error(`Kappa upload gagal (${response.status}).`);

  const data = await response.json().catch(() => null);
  const url = data && (data.link || data.url);
  if (!url) throw new Error("Respons upload Kappa tidak valid.");
  return url;
}

/**
 * Uploads a product image using the configured provider and
 * returns a public URL. Swap the provider here (or add a new
 * branch) without touching any calling code.
 */
async function uploadProductImage(file) {
  const validation = validateImageFile(file);
  if (!validation.ok) throw new Error(validation.reason);

  switch (IMAGE_CONFIG.provider) {
    case "catbox":
      return uploadToCatbox(file);
    case "kappa":
      return uploadToKappa(file);
    default:
      throw new Error(`Image provider "${IMAGE_CONFIG.provider}" belum didukung.`);
  }
}

/* ------------------------------------------------------------
 * Store settings
 * ------------------------------------------------------------ */
async function loadSettingsForm() {
  const form = document.getElementById("settingsForm");
  const qrisPreview = document.getElementById("qrisPreview");
  const brandNameEl = document.getElementById("adminBrandName");

  try {
    const { data, error } = await supabaseClient
      .from("store_settings")
      .select("id, store_name, store_description, admin_whatsapp, qris_url, dana_number, payment_note, banner_url, hero_media_url")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    form.elements.storeName.value = data.store_name || "";
    form.elements.storeDescription.value = data.store_description || "";
    form.elements.adminWhatsapp.value = data.admin_whatsapp || "";
    form.elements.qrisUrl.value = data.qris_url || "";
    form.elements.danaNumber.value = data.dana_number || "";
    form.elements.paymentNote.value = data.payment_note || APP_CONFIG.defaultPaymentNote;
    form.elements.bannerUrl.value = data.banner_url || "";
    form.elements.heroMediaUrl.value = data.hero_media_url || "";
    form.dataset.settingsId = data.id;

    if (data.store_name) brandNameEl.textContent = data.store_name;
    updateImagePreview(qrisPreview, data.qris_url, "Belum ada QRIS");
  } catch (error) {
    safeErrorMessage(error, "Gagal memuat pengaturan toko.");
  }
}

/** Generic helper for the small square preview boxes (QRIS, product image). */
function updateImagePreview(previewEl, url, emptyLabel) {
  previewEl.innerHTML = "";
  if (!url) {
    previewEl.textContent = emptyLabel;
    return;
  }
  const img = document.createElement("img");
  img.src = url;
  img.alt = "";
  img.onerror = () => {
    previewEl.innerHTML = "";
    previewEl.textContent = "Gambar tidak dapat dimuat";
  };
  previewEl.appendChild(img);
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const statusEl = document.getElementById("settingsStatus");

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";
  statusEl.textContent = "";

  const payload = {
    store_name: form.elements.storeName.value.trim(),
    store_description: form.elements.storeDescription.value.trim(),
    admin_whatsapp: form.elements.adminWhatsapp.value.trim(),
    qris_url: form.elements.qrisUrl.value.trim(),
    dana_number: form.elements.danaNumber.value.trim(),
    payment_note: form.elements.paymentNote.value.trim() || APP_CONFIG.defaultPaymentNote,
    banner_url: form.elements.bannerUrl.value.trim(),
    hero_media_url: form.elements.heroMediaUrl.value.trim(),
  };

  try {
    const settingsId = form.dataset.settingsId;
    const { error } = settingsId
      ? await supabaseClient.from("store_settings").update(payload).eq("id", settingsId)
      : await supabaseClient.from("store_settings").insert(payload);

    if (error) throw error;

    showToast("Saved.", "success");
    document.getElementById("adminBrandName").textContent =
      payload.store_name || APP_CONFIG.storeNameFallback;
    updateImagePreview(document.getElementById("qrisPreview"), payload.qris_url, "Belum ada QRIS");
  } catch (error) {
    safeErrorMessage(error, "Could not save changes.");
    statusEl.textContent = "Could not save changes.";
    showToast("Could not save changes.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Changes";
  }
}

/* ------------------------------------------------------------
 * Product list (card grid) + overview stats
 * ------------------------------------------------------------ */
let allProducts = [];

function updateOverviewStats(products) {
  const total = products.length;
  const active = products.filter((p) => p.is_active).length;
  const inactive = total - active;

  const totalEl = document.getElementById("statTotalProducts");
  const activeEl = document.getElementById("statActiveProducts");
  const inactiveEl = document.getElementById("statInactiveProducts");
  const categoriesEl = document.getElementById("statTotalCategories");

  if (totalEl) totalEl.textContent = String(total);
  if (activeEl) activeEl.textContent = String(active);
  if (inactiveEl) inactiveEl.textContent = String(inactive);
  if (categoriesEl) categoriesEl.textContent = String(allCategories.length);
}

async function loadProducts() {
  const grid = document.getElementById("productManageGrid");
  const emptyRow = document.getElementById("productEmptyState");

  grid.innerHTML = `<p class="loading-text">Memuat produk...</p>`;
  emptyRow.hidden = true;

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name, slug, description, price, image_url, category_id, is_active, created_at, updated_at, categories ( name )")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allProducts = data || [];
    updateOverviewStats(allProducts);
    applyProductFilters();
  } catch (error) {
    const message = safeErrorMessage(error, "Gagal memuat daftar produk.");
    grid.innerHTML = "";
    emptyRow.hidden = false;
    emptyRow.textContent = message;
  }
}

/** Filters allProducts by the current search + status controls and re-renders. */
function applyProductFilters() {
  const searchInput = document.getElementById("productSearchInput");
  const filterSelect = document.getElementById("productFilterSelect");
  const query = (searchInput && searchInput.value.trim().toLowerCase()) || "";
  const status = (filterSelect && filterSelect.value) || "all";

  const filtered = allProducts.filter((product) => {
    const matchesQuery = !query || product.name.toLowerCase().includes(query);
    const matchesStatus =
      status === "all" ||
      (status === "active" && product.is_active) ||
      (status === "inactive" && !product.is_active);
    return matchesQuery && matchesStatus;
  });

  renderProductGrid(filtered);
}

function renderProductGrid(products) {
  const grid = document.getElementById("productManageGrid");
  const emptyRow = document.getElementById("productEmptyState");
  grid.innerHTML = "";

  if (!products.length) {
    emptyRow.hidden = false;
    emptyRow.textContent = allProducts.length
      ? "Tidak ada produk yang cocok dengan pencarian/filter."
      : "Belum ada produk.";
    return;
  }
  emptyRow.hidden = true;

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "manage-card";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    if (product.image_url) {
      const img = document.createElement("img");
      img.src = product.image_url;
      img.alt = product.name;
      thumb.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb-placeholder";
      placeholder.textContent = "L";
      thumb.appendChild(placeholder);
    }

    const body = document.createElement("div");
    body.className = "body";

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = product.name;

    const descEl = document.createElement("div");
    descEl.className = "desc";
    descEl.textContent = product.description || "";

    const metaRow = document.createElement("div");
    metaRow.className = "meta-row";

    const priceEl = document.createElement("span");
    priceEl.className = "price";
    priceEl.textContent = formatPrice(product.price);

    const categoryEl = document.createElement("span");
    categoryEl.className = "status-pill";
    categoryEl.textContent = (product.categories && product.categories.name) || "Tanpa kategori";

    const pill = document.createElement("span");
    pill.className = `status-pill ${product.is_active ? "active" : ""}`.trim();
    pill.textContent = product.is_active ? "Active" : "Inactive";

    metaRow.append(priceEl, categoryEl, pill);

    const actionsRow = document.createElement("div");
    actionsRow.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openProductModal(product));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => confirmDeleteProduct(product));

    actionsRow.append(editBtn, deleteBtn);
    body.append(nameEl, descEl, metaRow, actionsRow);
    card.append(thumb, body);
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------
 * Add / edit product modal
 * ------------------------------------------------------------ */
let editingProductId = null;
let pendingImageFile = null;

function openProductModal(product = null) {
  const overlay = document.getElementById("productModal");
  const form = document.getElementById("productForm");
  const title = document.getElementById("productModalTitle");
  const preview = document.getElementById("productImagePreview");
  const errorEl = document.getElementById("productFormError");
  const uploadStatus = document.getElementById("uploadStatus");

  form.reset();
  errorEl.textContent = "";
  uploadStatus.textContent = "";
  uploadStatus.className = "upload-status";
  pendingImageFile = null;
  editingProductId = product ? product.id : null;

  populateCategorySelect(form.elements.categoryId);

  title.textContent = product ? "Edit Product" : "Add Product";

  if (product) {
    form.elements.name.value = product.name;
    form.elements.slug.value = product.slug;
    form.elements.description.value = product.description || "";
    form.elements.price.value = product.price;
    form.elements.categoryId.value = product.category_id || "";
    form.elements.imageUrl.value = product.image_url || "";
    form.elements.isActive.checked = product.is_active;
    form.dataset.slugTouched = "true";
    updateImagePreview(preview, product.image_url, "Belum ada gambar");
  } else {
    form.dataset.slugTouched = "";
    updateImagePreview(preview, null, "Belum ada gambar");
  }

  overlay.hidden = false;
}

function closeProductModal() {
  document.getElementById("productModal").hidden = true;
  editingProductId = null;
  pendingImageFile = null;
}

function handleProductNameInput(event) {
  const form = event.target.form;
  if (form.dataset.slugTouched === "true") return;
  form.elements.slug.value = slugify(event.target.value);
}

function handleSlugInput(event) {
  event.target.form.dataset.slugTouched = "true";
}

function handleImageFileChange(event) {
  const file = event.target.files[0];
  const preview = document.getElementById("productImagePreview");
  const uploadStatus = document.getElementById("uploadStatus");
  if (!file) return;

  const validation = validateImageFile(file);
  if (!validation.ok) {
    uploadStatus.textContent = validation.reason;
    uploadStatus.className = "upload-status error";
    event.target.value = "";
    return;
  }

  pendingImageFile = file;
  uploadStatus.textContent = `Dipilih: ${file.name}`;
  uploadStatus.className = "upload-status";
  const localUrl = URL.createObjectURL(file);
  updateImagePreview(preview, localUrl, "Belum ada gambar");
}

function handleImageUrlInput(event) {
  if (pendingImageFile) return; // an uploaded file takes precedence in the preview
  updateImagePreview(
    document.getElementById("productImagePreview"),
    event.target.value,
    "Belum ada gambar"
  );
}

async function handleProductFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorEl = document.getElementById("productFormError");
  const uploadStatus = document.getElementById("uploadStatus");
  errorEl.textContent = "";

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    let imageUrl = form.elements.imageUrl.value.trim();

    if (pendingImageFile) {
      uploadStatus.textContent = "Uploading...";
      uploadStatus.className = "upload-status uploading";
      try {
        imageUrl = await uploadProductImage(pendingImageFile);
        uploadStatus.textContent = "Uploaded.";
        uploadStatus.className = "upload-status success";
      } catch (uploadError) {
        uploadStatus.textContent = "Upload failed.";
        uploadStatus.className = "upload-status error";
        throw uploadError;
      }
    }

    const payload = {
      name: form.elements.name.value.trim(),
      slug: slugify(form.elements.slug.value.trim()),
      description: form.elements.description.value.trim(),
      price: Number(form.elements.price.value) || 0,
      category_id: form.elements.categoryId.value || null,
      image_url: imageUrl || null,
      is_active: form.elements.isActive.checked,
    };

    if (!payload.name || !payload.slug) {
      errorEl.textContent = "Nama dan slug produk wajib diisi.";
      return;
    }

    const { error } = editingProductId
      ? await supabaseClient.from("products").update(payload).eq("id", editingProductId)
      : await supabaseClient.from("products").insert(payload);

    if (error) {
      if (error.code === "23505") {
        errorEl.textContent = "Slug sudah digunakan produk lain. Gunakan slug yang berbeda.";
      } else {
        errorEl.textContent = "Gagal menyimpan produk. Coba lagi.";
        console.error(error);
      }
      return;
    }

    closeProductModal();
    showToast(editingProductId ? "Product updated." : "Product added.", "success");
    await loadProducts();
  } catch (error) {
    errorEl.textContent = error.message || "Gagal menyimpan produk.";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Product";
  }
}

async function confirmDeleteProduct(product) {
  const confirmed = await confirmDialog({
    title: "Delete product?",
    message: `"${product.name}" will be removed. This action cannot be undone.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.from("products").delete().eq("id", product.id);
    if (error) throw error;
    showToast("Product deleted.", "success");
    await loadProducts();
  } catch (error) {
    safeErrorMessage(error, "Gagal menghapus produk.");
    showToast("Could not delete product.", "error");
  }
}

/* ------------------------------------------------------------
 * Categories (list + add/edit/delete modal)
 * ------------------------------------------------------------ */
let allCategories = [];
let editingCategoryId = null;

async function loadCategories() {
  const list = document.getElementById("categoryManageList");
  const emptyRow = document.getElementById("categoryEmptyState");

  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("id, name, slug, created_at")
      .order("name", { ascending: true });

    if (error) throw error;

    allCategories = data || [];
    renderCategoryList();
    updateOverviewStats(allProducts);
  } catch (error) {
    const message = safeErrorMessage(error, "Gagal memuat kategori.");
    list.innerHTML = "";
    emptyRow.hidden = false;
    emptyRow.textContent = message;
  }
}

function renderCategoryList() {
  const list = document.getElementById("categoryManageList");
  const emptyRow = document.getElementById("categoryEmptyState");
  list.innerHTML = "";

  if (!allCategories.length) {
    emptyRow.hidden = false;
    emptyRow.textContent = "Belum ada kategori.";
    return;
  }
  emptyRow.hidden = true;

  allCategories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "category-row";

    const info = document.createElement("div");
    info.className = "category-row-info";
    const nameEl = document.createElement("span");
    nameEl.className = "name";
    nameEl.textContent = category.name;
    const slugEl = document.createElement("span");
    slugEl.className = "slug";
    slugEl.textContent = category.slug;
    info.append(nameEl, slugEl);

    const actions = document.createElement("div");
    actions.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => openCategoryModal(category));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => confirmDeleteCategory(category));

    actions.append(editBtn, deleteBtn);
    row.append(info, actions);
    list.appendChild(row);
  });
}

/** Fills a <select> with "Tanpa kategori" + one <option> per category, keeping any current value. */
function populateCategorySelect(selectEl) {
  const currentValue = selectEl.value;
  selectEl.innerHTML = '<option value="">Tanpa kategori</option>';
  allCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    selectEl.appendChild(option);
  });
  selectEl.value = currentValue;
}

function openCategoryModal(category = null) {
  const overlay = document.getElementById("categoryModal");
  const form = document.getElementById("categoryForm");
  const title = document.getElementById("categoryModalTitle");
  const errorEl = document.getElementById("categoryFormError");

  form.reset();
  errorEl.textContent = "";
  editingCategoryId = category ? category.id : null;
  title.textContent = category ? "Edit Category" : "Add Category";

  if (category) {
    form.elements.name.value = category.name;
    form.elements.slug.value = category.slug;
    form.dataset.slugTouched = "true";
  } else {
    form.dataset.slugTouched = "";
  }

  overlay.hidden = false;
}

function closeCategoryModal() {
  document.getElementById("categoryModal").hidden = true;
  editingCategoryId = null;
}

function handleCategoryNameInput(event) {
  const form = event.target.form;
  if (form.dataset.slugTouched === "true") return;
  form.elements.slug.value = slugify(event.target.value);
}

function handleCategorySlugInput(event) {
  event.target.form.dataset.slugTouched = "true";
}

async function handleCategoryFormSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorEl = document.getElementById("categoryFormError");
  errorEl.textContent = "";

  const payload = {
    name: form.elements.name.value.trim(),
    slug: slugify(form.elements.slug.value.trim()),
  };

  if (!payload.name || !payload.slug) {
    errorEl.textContent = "Nama dan slug kategori wajib diisi.";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const { error } = editingCategoryId
      ? await supabaseClient.from("categories").update(payload).eq("id", editingCategoryId)
      : await supabaseClient.from("categories").insert(payload);

    if (error) {
      if (error.code === "23505") {
        errorEl.textContent = "Slug sudah digunakan kategori lain. Gunakan slug yang berbeda.";
      } else {
        errorEl.textContent = "Gagal menyimpan kategori. Coba lagi.";
        console.error(error);
      }
      return;
    }

    closeCategoryModal();
    showToast(editingCategoryId ? "Category updated." : "Category added.", "success");
    await loadCategories();
  } catch (error) {
    errorEl.textContent = error.message || "Gagal menyimpan kategori.";
    console.error(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Category";
  }
}

async function confirmDeleteCategory(category) {
  const confirmed = await confirmDialog({
    title: "Delete category?",
    message: `"${category.name}" will be removed. Products in this category will become uncategorized. This action cannot be undone.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  });

  if (!confirmed) return;

  try {
    const { error } = await supabaseClient.from("categories").delete().eq("id", category.id);
    if (error) throw error;
    showToast("Category deleted.", "success");
    await loadCategories();
  } catch (error) {
    safeErrorMessage(error, "Gagal menghapus kategori.");
    showToast("Could not delete category.", "error");
  }
}

/* ------------------------------------------------------------
 * Sidebar navigation (mobile drawer + active link highlight)
 * ------------------------------------------------------------ */
function initSidebarNav() {
  const sidebar = document.getElementById("adminSidebar");
  const toggle = document.getElementById("sidebarToggle");
  const navLinks = Array.from(document.querySelectorAll(".sidebar-nav a"));
  const sections = navLinks
    .map((link) => document.getElementById(link.dataset.nav))
    .filter(Boolean);

  if (toggle && sidebar) {
    toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      if (sidebar) sidebar.classList.remove("open");
    });
  });

  if (!sections.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.dataset.nav === entry.target.id);
        });
      });
    },
    { rootMargin: "-40% 0px -50% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
}

/* ------------------------------------------------------------
 * Init
 * ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  const profile = await requireAdminSession();
  if (!profile) return; // requireAdminSession already redirected

  watchSessionExpiry();
  initSidebarNav();

  await loadSettingsForm();
  await loadCategories();
  await loadProducts();

  document.getElementById("settingsForm").addEventListener("submit", handleSettingsSubmit);

  document.getElementById("addProductBtn").addEventListener("click", () => openProductModal());
  document.getElementById("cancelProductForm").addEventListener("click", closeProductModal);
  document.getElementById("productForm").addEventListener("submit", handleProductFormSubmit);
  document.getElementById("productForm").elements.name.addEventListener("input", handleProductNameInput);
  document.getElementById("productForm").elements.slug.addEventListener("input", handleSlugInput);
  document.getElementById("productForm").elements.imageFile.addEventListener("change", handleImageFileChange);
  document.getElementById("productForm").elements.imageUrl.addEventListener("input", handleImageUrlInput);

  document.getElementById("productSearchInput").addEventListener("input", applyProductFilters);
  document.getElementById("productFilterSelect").addEventListener("change", applyProductFilters);

  // Clicking the dimmed overlay background also closes the modal.
  document.getElementById("productModal").addEventListener("click", (event) => {
    if (event.target.id === "productModal") closeProductModal();
  });

  document.getElementById("addCategoryBtn").addEventListener("click", () => openCategoryModal());
  document.getElementById("cancelCategoryForm").addEventListener("click", closeCategoryModal);
  document.getElementById("categoryForm").addEventListener("submit", handleCategoryFormSubmit);
  document.getElementById("categoryForm").elements.name.addEventListener("input", handleCategoryNameInput);
  document.getElementById("categoryForm").elements.slug.addEventListener("input", handleCategorySlugInput);
  document.getElementById("categoryModal").addEventListener("click", (event) => {
    if (event.target.id === "categoryModal") closeCategoryModal();
  });
});
