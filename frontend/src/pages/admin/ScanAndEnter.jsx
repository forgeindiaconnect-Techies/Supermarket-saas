import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Barcode,
  Camera,
  Upload,
  Zap,
  CheckCircle,
  AlertCircle,
  Package,
  RotateCcw,
  X,
  Save,
  Check,
  Tag,
  Info,
  Sparkles,
  Radio,
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import API from "../../services/api";
import BarcodeSVG from "../../components/BarcodeSVG";
import ErpPageBanner from "../../components/ErpPageBanner";
import { addPersistentProduct, getPersistentProducts } from "../../utils/realtimeStorage";
import "./ScanAndEnter.css";

// Built-in Supermarket Catalog matching reference items & user's database with crystal-clear high-res assets
// Re-trigger Vite HMR clean compile


export default function ScanAndEnter() {
  const navigate = useNavigate();

  // Mode: "generate" (Auto-GenerateScan / Enter), "upload", "camera"
  const [activeMode, setActiveMode] = useState("generate");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [activeBarcode, setActiveBarcode] = useState("");
  const [autoRegisterOnScan, setAutoRegisterOnScan] = useState(false);
  const [uploadedImagePreview, setUploadedImagePreview] = useState(null);

  // Product state
  const [product, setProduct] = useState({
    name: "",
    category: "Groceries",
    brand: "",
    price: "",
    discount: 0,
    sellingPrice: "",
    costPrice: "",
    stock: "",
    lowStockThreshold: 5,
    imageUrl: "",
    description: "",
  });

  const [detailsFetched, setDetailsFetched] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Barcode Lookup logic
  const lookupBarcode = async (rawCode, autoSave = false) => {
    const code = String(rawCode || "").trim();
    if (!code) {
      setMessage({ type: "error", text: "Please enter or scan a valid barcode number." });
      return;
    }

    // Format validation (EAN-13, EAN-8, UPC-A, UPC-E, Code 128)
    const isEanUpc = /^\d{6,14}$/.test(code);
    const isCode128 = /^[A-Za-z0-9\-_./]{3,32}$/.test(code);
    if (!isEanUpc && !isCode128) {
      setMessage({
        type: "error",
        text: `Invalid barcode format "${code}". Must be 6-14 numeric digits (EAN/UPC) or alphanumeric (Code 128).`,
      });
      return;
    }

    setIsLookingUp(true);
    setActiveBarcode(code);
    setBarcodeInput(code);
    setMessage({ type: "info", text: `Analyzing barcode: ${code}... Searching catalog & verified databases.` });

    let found = null;

    // 1. Check MongoDB Atlas for this supermarket
    try {
      const res = await API.get(`/products/barcode/${encodeURIComponent(code)}`);
      if (res.data?.success && res.data.product) {
        found = res.data.product;
      }
    } catch (_) {}

    // 2. Check local persistent inventory
    if (!found) {
      const local = getPersistentProducts();
      const match = local.find((p) => String(p.barcode || "").trim() === code);
      if (match) found = match;
    }

    // 3. External verified barcode and product lookup
    if (!found) {
      try {
        const ext = await API.get(`/products/external/${encodeURIComponent(code)}`);
        if (ext.data?.success && ext.data.product) {
          const ep = ext.data.product;
          found = {
            name: ep.name || "",
            brand: ep.brand || "",
            category: ep.category || "Groceries",
            imageUrl: ep.imageUrl || "",
            price: ep.price || "",
            discount: 0,
            sellingPrice: ep.price || "",
            costPrice: "",
            stock: "",
            lowStockThreshold: 5,
            description: `Verified product data from ${ext.data.source || "catalog"}.`,
          };
        }
      } catch (_) {}
    }

    setIsLookingUp(false);

    if (found && found.name) {
      const pPrice = found.price ?? "";
      const pDisc = Number(found.discount) || 0;
      const pSell = pPrice !== "" ? Number(pPrice) - pDisc : "";

      setProduct({
        name: found.name || "",
        brand: found.brand || "",
        category: found.category || "Groceries",
        price: pPrice,
        discount: pDisc,
        sellingPrice: pSell,
        costPrice: Number(found.costPrice) || 0,
        stock: found.stock ?? "",
        lowStockThreshold: Number(found.lowStockThreshold) || 5,
        imageUrl: found.imageUrl || "",
        description: found.description || "",
      });
      setDetailsFetched(true);
      setMessage({
        type: "success",
        text: `✓ Product "${found.name}" verified for barcode ${code}! Review details and click Save.`,
      });

      if (autoSave || autoRegisterOnScan) {
        executeRegisterProduct(code, found);
      }
    } else {
      // Barcode is valid, but product is not yet in databases - KEEP barcode active!
      setDetailsFetched(false);
      setProduct((prev) => ({
        ...prev,
        barcode: code,
      }));
      setMessage({
        type: "info",
        text: `Barcode ${code} decoded successfully! Product not found in database. Please enter product details and save to register.`,
      });
    }
  };

  // Register Product
  const executeRegisterProduct = async (barcodeToSave, productData) => {
    const code = barcodeToSave || activeBarcode;
    const data = productData || product;

    const mrp = Number(data.price);
    const sell = data.sellingPrice !== "" && data.sellingPrice != null ? Number(data.sellingPrice) : mrp;
    const stk = Number(data.stock);

    if (!code || !data.name?.trim()) {
      setMessage({ type: "error", text: "Please enter product name and ensure barcode is detected." });
      return;
    }

    if (data.price === "" || !Number.isFinite(mrp) || mrp <= 0) {
      setMessage({ type: "error", text: "Please enter a valid MRP price greater than 0." });
      return;
    }

    if (!Number.isFinite(sell) || sell <= 0 || sell > mrp) {
      setMessage({ type: "error", text: "Selling price must be greater than 0 and cannot exceed MRP." });
      return;
    }

    if (data.stock === "" || !Number.isInteger(stk) || stk < 0) {
      setMessage({ type: "error", text: "Please enter a valid stock quantity (whole number, 0 or greater)." });
      return;
    }

    setIsSaving(true);

    const payload = {
      name: data.name.trim(),
      barcode: code,
      category: data.category || "Groceries",
      brand: (data.brand || "").trim(),
      price: mrp,
      discount: Math.max(0, mrp - sell),
      costPrice: Number(data.costPrice) || 0,
      stock: stk,
      lowStockThreshold: Number(data.lowStockThreshold) || 5,
      imageUrl: (data.imageUrl || "").trim(),
      description: data.description || "",
      status: stk > 0 ? "In Stock" : "Out of Stock",
      isActive: true,
    };

    let saved = false;

    // 1. Save to MongoDB Atlas Backend
    try {
      let existingId = null;
      try {
        const existingRes = await API.get(`/products/barcode/${encodeURIComponent(code)}`);
        existingId = existingRes.data?.product?._id || null;
      } catch (_) {}

      const res = existingId
        ? await API.put(`/products/${existingId}`, payload)
        : await API.post("/products", payload);

      if (res.data?.success || res.status === 201 || res.status === 200) {
        saved = true;
      }
    } catch (err) {
      console.warn("MongoDB product save error:", err?.response?.data || err.message);
    }

    if (!saved) {
      setIsSaving(false);
      setMessage({
        type: "error",
        text: "Could not save product to database. Please check connection and try again.",
      });
      return;
    }

    // 2. Save to local storage after successful MongoDB registration
    addPersistentProduct({
      ...payload,
      _id: `prod_${Date.now()}`,
      createdAt: new Date().toISOString(),
    });

    setIsSaving(false);
    setMessage({
      type: "success",
      text: `✓ Successfully registered "${payload.name}" (Barcode: ${code}) to Super Admin Dashboard!`,
    });
  };

  // Toggle camera scanner
  const toggleCamera = async () => {
    if (cameraActive) {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (_) {}
        scannerRef.current = null;
      }
      setCameraActive(false);
      setActiveMode("generate");
    } else {
      setActiveMode("camera");
      setCameraActive(true);
      setTimeout(() => {
        startCameraScanner();
      }, 300);
    }
  };

  const startCameraScanner = () => {
    const qrDiv = document.getElementById("se-camera-viewport");
    if (!qrDiv) return;

    const html5QrCode = new Html5Qrcode("se-camera-viewport", {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 160 } },
        (decodedText) => {
          html5QrCode.stop().catch(() => {});
          setCameraActive(false);
          setActiveBarcode(decodedText);
          setBarcodeInput(decodedText);
          lookupBarcode(decodedText, autoRegisterOnScan);
        },
        () => {}
      )
      .catch((err) => {
        setCameraActive(false);
        setMessage({
          type: "error",
          text: `Camera permission denied: ${err?.message || "Please allow webcam access"}`,
        });
      });
  };

  // Handle uploaded image file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected if needed
    e.target.value = "";

    // 1. Immediately create and display uploaded image preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImagePreview(event.target?.result || null);
    };
    reader.readAsDataURL(file);

    setActiveMode("upload");
    setMessage({ type: "info", text: "Scanning & analyzing uploaded barcode image..." });

    let detectedText = null;

    // Pass 1: Html5Qrcode multi-format scanner
    try {
      const html5QrCode = new Html5Qrcode("se-hidden-canvas", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        verbose: false,
      });

      detectedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
    } catch (_) {}

    // Pass 2: Native BarcodeDetector API if available in browser
    if (!detectedText && typeof window !== "undefined" && window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"],
        });
        const bitmap = await createImageBitmap(file);
        const barcodes = await detector.detect(bitmap);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          detectedText = barcodes[0].rawValue;
        }
      } catch (_) {}
    }

    if (detectedText) {
      const cleanCode = String(detectedText).trim();
      setActiveBarcode(cleanCode);
      setBarcodeInput(cleanCode);
      lookupBarcode(cleanCode, autoRegisterOnScan);
    } else {
      setMessage({
        type: "error",
        text: "Could not detect a clear barcode from this image. Please ensure the barcode is visible, unblurred, and well-lit, or type the numbers directly.",
      });
    }
  };

  // Reset form
  const handleReset = () => {
    setBarcodeInput("");
    setActiveBarcode("");
    setUploadedImagePreview(null);
    setProduct({
      name: "",
      category: "Groceries",
      brand: "",
      price: "",
      discount: 0,
      sellingPrice: "",
      costPrice: "",
      stock: "",
      lowStockThreshold: 5,
      imageUrl: "",
      description: "",
    });
    setDetailsFetched(false);
    setActiveMode("generate");
    setMessage({ type: "", text: "" });
  };

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (_) { }
      }
    };
  }, []);

  return (
    <div className="se-container">
      {/* 1. Hero Top Banner - EXACT MATCH TO REGISTER NEW PRODUCT */}
      <ErpPageBanner
        title="Scan & Enter"
        subtitle="Scan, fetch & register products instantly to your supermarket catalog"
        badges={["Instant Barcode Lookup", "Auto-Fetch Product Data", "Real-Time Inventory Sync"]}
        icon={<Barcode size={22} color="#ffffff" strokeWidth={2.4} />}
      />

      {/* 2. Notification / Alert Toast (Only shown when active) */}
      {message.text && (
        <div className={`se-notice ${message.type || "info"}`}>
          <div className="se-notice-content">
            {message.type === "success" ? (
              <CheckCircle size={18} />
            ) : message.type === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Info size={18} />
            )}
            <span>{message.text.replace(/^[✓✔❌ℹ️]\s*/, "")}</span>
          </div>
          <button
            type="button"
            className="se-notice-close"
            onClick={() => setMessage({ type: "", text: "" })}
            aria-label="Dismiss notice"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 3. Main Grid (Left Scanner + Right Preview) */}
      <div className="se-grid">
        {/* LEFT CARD: Barcode Configuration & Live Preview */}
        <div className="se-card se-left-card">
          {/* Action Mode Buttons */}
          <div className="se-mode-btn-row">
            <button
              type="button"
              className={`se-mode-btn ${activeMode === "generate" ? "active" : ""}`}
              onClick={() => {
                if (cameraActive) toggleCamera();
                setActiveMode("generate");
              }}
            >
              <Barcode size={16} />
              <span>Scan / Enter</span>
            </button>

            <button
              type="button"
              className={`se-mode-btn ${activeMode === "upload" ? "active" : ""}`}
              onClick={() => {
                if (cameraActive) toggleCamera();
                setActiveMode("upload");
                fileInputRef.current?.click();
              }}
            >
              <Upload size={16} />
              <span>Upload Barcode Image</span>
            </button>

            <button
              type="button"
              className={`se-mode-btn ${activeMode === "camera" || cameraActive ? "active" : ""}`}
              onClick={toggleCamera}
            >
              <Camera size={16} />
              <span>{cameraActive ? "Stop Camera" : "Scan via Camera"}</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            style={{ display: "none" }}
          />
          <div id="se-hidden-canvas" style={{ display: "none" }} />

          {/* Camera Viewport */}
          {cameraActive && (
            <div className="se-camera-box">
              <div id="se-camera-viewport" className="se-camera-stream" />
              <div className="se-camera-reticle">
                <span className="se-scan-laser-line" />
              </div>
            </div>
          )}

          {/* Helper Info Banner */}
          <div className="se-info-pill">
            <Info size={16} className="se-info-icon" />
            <span>
              Scan with camera, upload a barcode picture, or type/scan manufacturer code to
              auto-fetch details & register to dashboard.
            </span>
          </div>

          {/* Barcode Input Group */}
          <div className="se-input-section">
            <label className="se-input-label">
              <Tag size={13} fill="#0f172a" stroke="#0f172a" />
              <span>Manufacturer Barcode (EAN / UPC / Code-128)</span>
            </label>
            <div className="se-input-row">
              <div className="se-input-box">
                <Barcode size={18} className="se-input-icon" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      lookupBarcode(barcodeInput);
                    }
                  }}
                  placeholder="Enter or scan barcode number..."
                  className="se-text-input"
                />
              </div>

              <button
                type="button"
                className="se-fetch-btn"
                disabled={isLookingUp}
                onClick={() => lookupBarcode(barcodeInput)}
              >
                <Zap size={15} fill="#ffffff" />
                <span>{isLookingUp ? "Fetching..." : "Fetch Details"}</span>
              </button>
            </div>
          </div>

          {/* Auto Register Checkbox */}
          <label className="se-checkbox-row">
            <input
              type="checkbox"
              checked={autoRegisterOnScan}
              onChange={(e) => setAutoRegisterOnScan(e.target.checked)}
              className="se-checkbox"
            />
            <span className="se-checkbox-text">
              <Zap size={13} color="#f59e0b" fill="#f59e0b" />
              <strong>Automatically register to Super Admin Dashboard upon scan / upload</strong>
            </span>
          </label>

          {/* LIVE BARCODE PREVIEW BOX with Wave Ribbon Header */}
          <div className="se-live-preview-box">
            <div className="se-live-preview-header">
              <div className="se-live-preview-title-wrap">
                <Radio size={14} className="se-pulse-icon" />
                <span className="se-live-preview-title">LIVE BARCODE PREVIEW</span>
              </div>
            </div>

            <div className="se-barcode-canvas-wrap">
              {/* Cyan Viewfinder Corner Reticles */}
              <div className="se-corner top-left" />
              <div className="se-corner top-right" />
              <div className="se-corner bottom-left" />
              <div className="se-corner bottom-right" />

              {uploadedImagePreview ? (
                /* When Barcode Image is uploaded: Show ONLY the uploaded barcode image inside viewfinder */
                <div className="se-uploaded-barcode-view">
                  <div className="se-uploaded-barcode-topbar">
                    <span className="se-uploaded-barcode-tag">
                      <Sparkles size={13} color="#16a34a" />
                      <span>Uploaded Barcode Image Verified</span>
                    </span>
                    <button
                      type="button"
                      className="se-uploaded-barcode-clear"
                      onClick={() => setUploadedImagePreview(null)}
                      title="Clear uploaded barcode image"
                    >
                      <X size={12} />
                      <span>Clear</span>
                    </button>
                  </div>
                  <div className="se-uploaded-barcode-img-box">
                    <img
                      src={uploadedImagePreview}
                      alt="Uploaded Barcode File"
                      className="se-uploaded-barcode-img"
                    />
                  </div>
                  <span className="se-barcode-digits">
                    {activeBarcode || ""}
                  </span>
                </div>
              ) : (
                /* When Barcode is typed or default: Show ONLY the SVG barcode */
                <div className="se-barcode-render">
                  <BarcodeSVG
                    barcode={activeBarcode || ""}
                    width={2.2}
                    height={54}
                    showText={false}
                  />
                  <span className="se-barcode-digits">
                    {activeBarcode || ""}
                  </span>
                </div>
              )}

              {detailsFetched && (
                <div className="se-fetched-badge">
                  <span className="se-check-circle">✓</span>
                  <span>Details Auto-Fetched</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT CARD: Product Image Preview & Details */}
        <div className="se-card se-right-card">
          <div className="se-card-header">
            <div className="se-card-title">
              <Package size={17} color="#1455d9" />
              <h3>Product Image Preview</h3>
            </div>
            <span className="se-live-url-pill">
              <span className="se-live-dot" />
              <span>Live URL Active</span>
            </span>
          </div>

          {/* Large Image Preview with Crisp High-Res Display (Never renders empty src) */}
          <div className="se-img-preview-wrap">
            {product.imageUrl && product.imageUrl.trim() ? (
              <img
                src={product.imageUrl.trim()}
                alt={product.name || "Product Image Preview"}
                className="se-main-img"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "155px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#f8fafc",
                  borderRadius: "12px",
                  border: "1.5px dashed #cbd5e1",
                  color: "#94a3b8",
                  gap: "6px",
                }}
              >
                <Package size={34} strokeWidth={1.5} color="#94a3b8" />
                <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#64748b" }}>
                  Product Image Preview
                </span>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Auto-fetched image or custom image URL will appear here
                </span>
              </div>
            )}
          </div>

          {/* Product Form Fields: Name, Brand, Category, Image URL, Price, Stock */}
          <div className="se-form-fields-container">
            {/* Row 1: Product Name & Brand */}
            <div className="se-form-row se-row-2col">
              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Product Name</span>
                  <span className="required-star">*</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fortune Sunflower Oil 1L"
                    value={product.name}
                    onChange={(e) => setProduct((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Brand</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="text"
                    placeholder="e.g. Fortune"
                    value={product.brand}
                    onChange={(e) => setProduct((prev) => ({ ...prev, brand: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Category & Image URL */}
            <div className="se-form-row se-row-category-url">
              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Category</span>
                </label>
                <div className="se-field-input-box">
                  <select
                    value={product.category}
                    onChange={(e) => setProduct((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="Groceries">Groceries</option>
                    <option value="Food Items">Food Items</option>
                    <option value="Dairy & Eggs">Dairy &amp; Eggs</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Snacks & Branded Foods">Snacks &amp; Foods</option>
                    <option value="Bakery & Bread">Bakery &amp; Bread</option>
                    <option value="Fruits & Vegetables">Fruits &amp; Vegetables</option>
                    <option value="Personal Care">Personal Care</option>
                    <option value="Household Care">Household Care</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Image URL (Optional)</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={product.imageUrl}
                    onChange={(e) => setProduct((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: MRP, Selling Price, Available Stock */}
            <div className="se-form-row se-row-3col">
              <div className="se-field-group">
                <label className="se-field-label">
                  <span>MRP (₹)</span>
                  <span className="required-star">*</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="MRP"
                    value={product.price}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProduct((prev) => ({
                        ...prev,
                        price: val,
                        sellingPrice: prev.sellingPrice === "" || prev.sellingPrice === prev.price ? val : prev.sellingPrice,
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Selling Price (₹)</span>
                  <span className="required-star">*</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="Selling Price"
                    value={product.sellingPrice ?? ""}
                    onChange={(e) => setProduct((prev) => ({ ...prev, sellingPrice: e.target.value }))}
                  />
                </div>
              </div>

              <div className="se-field-group">
                <label className="se-field-label">
                  <span>Available Stock</span>
                  <span className="required-star">*</span>
                </label>
                <div className="se-field-input-box">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="Stock Qty"
                    value={product.stock}
                    onChange={(e) => setProduct((prev) => ({ ...prev, stock: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Sticky Action Bar */}
      <div className="se-action-bar">
        <div className="se-action-bar-left">
          <button
            type="button"
            className="se-btn se-btn-secondary"
            onClick={handleReset}
          >
            <RotateCcw size={15} />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            className="se-btn se-btn-cancel"
            onClick={() => navigate("/admin/products")}
          >
            <X size={15} />
            <span>Cancel</span>
          </button>
        </div>

        <div className="se-action-bar-right">
          <div className="se-sparkle-btn-wrap">
            <Sparkles size={16} className="se-btn-sparkle-decor" />
            <button
              type="button"
              className="se-btn se-btn-primary"
              disabled={isSaving}
              onClick={() => executeRegisterProduct(activeBarcode, product)}
            >
              <Save size={16} />
              <span>
                {isSaving ? "Saving..." : "Save & Register to Inventory →"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


























