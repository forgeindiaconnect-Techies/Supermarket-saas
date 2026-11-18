// Real-Time Multi-Tenant Persistent Storage Helper
// Ensures each supermarket's products, inventory, orders, and barcodes
// are strictly isolated by supermarket ID across browser refreshes and sync with MongoDB Atlas.

export function getActiveSupermarketId() {
  try {
    const raw = localStorage.getItem("grocerease_current_supermarket");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?._id) return parsed._id;
      if (parsed?.code) return parsed.code;
    }
  } catch (_) {}
  return "default";
}

export function getStorageKeyProducts() {
  return `grocerease_real_products_${getActiveSupermarketId()}`;
}

export function getStorageKeyOrders() {
  return `grocerease_real_orders_${getActiveSupermarketId()}`;
}

export const DEFAULT_SUPERMARKET_PRODUCTS_STORE1 = [];

export const DEFAULT_SUPERMARKET_PRODUCTS_STORE2 = [];

export const DEFAULT_SUPERMARKET_PRODUCTS = DEFAULT_SUPERMARKET_PRODUCTS_STORE1;

// Read persistent products for current supermarket tenant
export function getPersistentProducts() {
  const key = getStorageKeyProducts();
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Exclude any legacy mock/dummy products with mock ids
        const clean = parsed.filter(
          (p) =>
            p &&
            !String(p._id || "").startsWith("prod-s1-") &&
            !String(p._id || "").startsWith("prod-s2-") &&
            !String(p._id || "").startsWith("cat-")
        );
        return clean;
      }
    }
  } catch (err) {
    console.warn("Storage read failed:", err);
  }

  // When no data exists yet for this tenant, return clean empty list
  return [];
}

// Save persistent products to localStorage scoped to current supermarket
export function savePersistentProducts(products) {
  const key = getStorageKeyProducts();
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(products) ? products : []));
    window.dispatchEvent(new Event("grocerease_storage_updated"));
  } catch (err) {
    console.warn("Storage write failed:", err);
  }
}

// Update single product stock by _id or barcode
export function updatePersistentStock(identifier, newStock) {
  const products = getPersistentProducts();
  const safeStock = Math.max(0, Number(newStock));
  const updated = products.map((p) =>
    p._id === identifier || p.barcode === identifier || String(p.barcode) === String(identifier)
      ? { ...p, stock: safeStock }
      : p
  );
  savePersistentProducts(updated);
  return updated;
}

// Merge backend API products with local persistent storage
export function mergeApiWithStorage(apiProducts) {
  if (!Array.isArray(apiProducts)) {
    return getPersistentProducts();
  }

  // Backend API is the source of truth for this tenant
  savePersistentProducts(apiProducts);
  return apiProducts;
}

// Add a newly created product
export function addPersistentProduct(newProduct) {
  const products = getPersistentProducts();
  const exists = products.find(
    (p) => p._id === newProduct._id || (newProduct.barcode && p.barcode === newProduct.barcode)
  );
  let updated;
  if (exists) {
    updated = products.map((p) => (p._id === exists._id ? { ...p, ...newProduct } : p));
  } else {
    updated = [newProduct, ...products];
  }
  savePersistentProducts(updated);
  return updated;
}

// Delete product permanently from local persistent storage
export function deletePersistentProduct(productId) {
  if (!productId) return getPersistentProducts();
  const products = getPersistentProducts();
  const target = String(productId).trim();
  const updated = products.filter(
    (p) =>
      p._id !== productId &&
      p.barcode !== productId &&
      String(p._id || "").trim() !== target &&
      String(p.barcode || "").trim() !== target
  );
  savePersistentProducts(updated);
  return updated;
}
