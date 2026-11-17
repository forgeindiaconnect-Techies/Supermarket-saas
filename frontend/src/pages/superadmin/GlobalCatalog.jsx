import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Boxes,
  Building2,
  Search,
  Filter,
  DollarSign,
  Package,
  Layers,
  ArrowUpDown,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { io } from "socket.io-client";
import API, { SOCKET_URL } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./SuperAdmin.css";

const DEMO_CATALOG = [
  {
    _id: "cat-1",
    name: "Fresh Red Apples (Washington)",
    brand: "Fresh Orchard",
    category: "Fruits & Vegetables",
    barcode: "2001849201948",
    price: 180,
    costPrice: 130,
    supermarketName: "GrocerEase Flagship - Indiranagar",
    supermarketCode: "STR-001",
    city: "Bangalore",
    stock: 65,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop&q=80",
  },
  {
    _id: "cat-2",
    name: "Fresh Red Apples (Washington)",
    brand: "Fresh Orchard",
    category: "Fruits & Vegetables",
    barcode: "2001739104829",
    price: 180,
    costPrice: 130,
    supermarketName: "FreshMart Supermarket - Koramangala",
    supermarketCode: "STR-002",
    city: "Bangalore",
    stock: 40,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop&q=80",
  },
  {
    _id: "cat-3",
    name: "Chocolate",
    brand: "Zero Sugar",
    category: "Beverages",
    barcode: "2002948102948",
    price: 352,
    costPrice: 280,
    supermarketName: "GrocerEase Flagship - Indiranagar",
    supermarketCode: "STR-001",
    city: "Bangalore",
    stock: 25,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=120&auto=format&fit=crop&q=80",
  },
  {
    _id: "cat-4",
    name: "Lays Potato Chips",
    brand: "Lays",
    category: "Snacks",
    barcode: "2003849102948",
    price: 20,
    costPrice: 14,
    supermarketName: "FreshMart Supermarket - Koramangala",
    supermarketCode: "STR-002",
    city: "Bangalore",
    stock: 50,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=120&auto=format&fit=crop&q=80",
  },
  {
    _id: "cat-5",
    name: "Dove Daily Shampoo 180ml",
    brand: "Dove",
    category: "Household",
    barcode: "2004849102948",
    price: 250,
    costPrice: 195,
    supermarketName: "GrocerEase Flagship - Indiranagar",
    supermarketCode: "STR-001",
    city: "Bangalore",
    stock: 30,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=120&auto=format&fit=crop&q=80",
  },
  {
    _id: "cat-6",
    name: "Royal Basmati Rice 5kg",
    brand: "Royal Heritage",
    category: "Groceries",
    barcode: "2005849102948",
    price: 650,
    costPrice: 520,
    supermarketName: "FreshMart Supermarket - Koramangala",
    supermarketCode: "STR-002",
    city: "Bangalore",
    stock: 40,
    status: "In Stock",
    imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=80",
  },
];

export default function GlobalCatalog() {
  const { supermarkets } = useAuth();
  const [catalog, setCatalog] = useState(DEMO_CATALOG);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const res = await API.get("/super-admin/catalog", {
        params: { supermarketId: selectedStore, search, category: selectedCategory },
      });
      if (res.data?.success && Array.isArray(res.data.products)) {
        setCatalog(
          res.data.products.map((p) => ({
            _id: p._id,
            name: p.name,
            brand: p.brand || "Standard",
            category: p.category || "General",
            barcode: p.barcode,
            price: p.price,
            costPrice: p.costPrice || Math.round(p.price * 0.75),
            supermarketName: p.supermarket?.name || p.supermarketName || "GrocerEase Store",
            supermarketCode: p.supermarket?.code || p.supermarketCode || "STR-001",
            city: p.supermarket?.city || "Bangalore",
            stock: p.stock,
            status: p.stock > 10 ? "In Stock" : p.stock > 0 ? "Low Stock" : "Out of Stock",
            imageUrl: p.imageUrl || "https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&auto=format&fit=crop&q=80",
          }))
        );
      }
    } catch (_) {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();

    let socket;
    try {
      socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
      const refresh = () => loadCatalog();
      socket.on("product:created", refresh);
      socket.on("product:updated", refresh);
      socket.on("product:deleted", (data) => {
        if (data?.id || data?.barcode) {
          setCatalog((prev) => prev.filter((p) => p._id !== data.id && p.barcode !== data.barcode));
        }
        refresh();
      });
      socket.on("platform:stats_updated", refresh);
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [selectedStore, selectedCategory]);

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete product "${product.name}" (${product.barcode || product._id})?\n\nThis will permanently remove it from ${product.supermarketName} in the database.`)) {
      return;
    }
    try {
      setCatalog((prev) => prev.filter((p) => p._id !== product._id && p.barcode !== product.barcode));
      const isMongoId = product._id && /^[0-9a-fA-F]{24}$/.test(product._id);
      const identifier = isMongoId ? product._id : (product.barcode || product._id);
      await API.delete(`/products/${identifier}`, { data: { barcode: product.barcode } });
      loadCatalog();
    } catch (err) {
      alert(`Failed to delete product: ${err.response?.data?.message || err.message}`);
    }
  };

  const filtered = catalog.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search) ||
      item.supermarketName.toLowerCase().includes(search.toLowerCase());
    const matchStore = selectedStore === "all" || item.supermarketCode === selectedStore;
    const matchCat = selectedCategory === "all" || item.category === selectedCategory;
    return matchSearch && matchStore && matchCat;
  });

  return (
    <div className="sa-page-container">
      {/* 1. Header */}
      <div className="sa-page-header">
        <div className="sa-page-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span className="sa-badge active">Centralized Master Directory</span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Multi-Tenant Catalog</span>
          </div>
          <h1>Global Product Catalog Across Supermarkets</h1>
          <p>
            Master inventory matrix tracking pricing, stock quantities, barcodes, and SKU distribution across all supermarket branches.
          </p>
        </div>

        <div className="sa-page-header-actions">
          <button type="button" className="sa-btn-secondary" onClick={loadCatalog}>
            <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            <span>Refresh Catalog</span>
          </button>
          <Link to="/super-admin/product-sales" className="sa-btn-primary">
            <Package size={15} />
            <span>Product-Wise Sales Matrix</span>
          </Link>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="sa-filter-bar">
        <div className="sa-search-input-wrap">
          <Search size={16} className="sa-search-icon" />
          <input
            type="text"
            className="sa-search-input"
            placeholder="Search by product name, barcode, or supermarket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sa-filter-controls">
          <select
            className="sa-select-input"
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <option value="all">All Supermarkets ({supermarkets.length || 2})</option>
            {supermarkets.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>

          <select
            className="sa-select-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Fruits & Vegetables">Fruits & Vegetables</option>
            <option value="Groceries">Groceries</option>
            <option value="Beverages">Beverages</option>
            <option value="Snacks">Snacks</option>
            <option value="Household">Household</option>
          </select>
        </div>
      </div>

      {/* 3. Global Catalog Table */}
      <div className="sa-section-card">
        <div className="sa-table-wrapper">
          <table className="sa-data-table">
            <thead>
              <tr>
                <th>Product & SKU</th>
                <th>Category</th>
                <th>Barcode (UPC/EAN)</th>
                <th>Tenant Supermarket</th>
                <th>Retail Price (₹)</th>
                <th>Cost Price (₹)</th>
                <th>Store Stock</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
                    No products matching your search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {item.imageUrl && item.imageUrl.trim() ? (
                          <img
                            src={item.imageUrl.trim()}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            style={{
                              width: "40px",
                              height: "40px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              if (e.currentTarget.nextSibling) {
                                e.currentTarget.nextSibling.style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: item.imageUrl && item.imageUrl.trim() ? "none" : "flex",
                            width: "40px",
                            height: "40px",
                            borderRadius: "8px",
                            background: "#f1f5f9",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "18px",
                            border: "1px solid #e2e8f0",
                            flexShrink: 0,
                          }}
                        >
                          📦
                        </div>
                        <div>
                          <strong style={{ display: "block", color: "#0f172a" }}>{item.name}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>Brand: {item.brand}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="sa-badge plan">{item.category}</span>
                    </td>
                    <td>
                      <code style={{ fontFamily: "monospace", fontSize: "12px", color: "#2563eb", background: "#eff6ff", padding: "2px 6px", borderRadius: "4px" }}>
                        {item.barcode}
                      </code>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: "13px", color: "#1e293b" }}>{item.supermarketName}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                          {item.supermarketCode} &bull; {item.city}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: "14px" }}>₹{item.price}</strong>
                    </td>
                    <td>
                      <span style={{ color: "#64748b", fontSize: "13px" }}>₹{item.costPrice}</span>
                    </td>
                    <td>
                      <strong style={{ color: item.stock < 15 ? "#dc2626" : "#059669" }}>
                        {item.stock} units
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`sa-badge ${
                          item.status === "In Stock" ? "active" : item.status === "Low Stock" ? "trial" : "suspended"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(item)}
                        title={`Permanently delete "${item.name}"`}
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#dc2626",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        <Trash2 size={13} color="#dc2626" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

