const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const dns = require("dns");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Ensure high-resolution supermarket hero banner & sidebar images are copied to frontend assets & public
function syncInitialAssets() {
  try {
    const assetsDir = path.join(__dirname, "../frontend/src/assets");
    const publicDir = path.join(__dirname, "../frontend/public");
    const mobileAssetsDir = path.join(__dirname, "../mobile-app/assets/images");

    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    if (!fs.existsSync(mobileAssetsDir)) fs.mkdirSync(mobileAssetsDir, { recursive: true });

    const brainDir = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\fb582fb9-2b2b-411c-ac43-40149f4c94a9";
    const syncList = [
      { src: path.join(brainDir, "sidebar_abstract_blue_waves_1794046512095.jpg"), names: ["sidebar-waves-bg.jpg", "sidebar_abstract_blue_waves.jpg"] },
      { src: path.join(brainDir, "grocery_basket_3d_1794046555765.jpg"), names: ["grocery-basket-3d.jpg", "grocery_basket_3d.jpg"] },
      { src: path.join(brainDir, "storefront_3d_supermarket_1794046532029.jpg"), names: ["storefront-3d.jpg", "storefront_3d.jpg"] },
      { src: path.join(brainDir, "dashboard_hero_banner_art_1794046675903.jpg"), names: ["hero-banner-art.jpg", "dashboard_hero_banner_art.jpg"] },
      { src: path.join(brainDir, "dashboard_hero_fresh_cart_aisle_1794053392050.jpg"), names: ["dashboard-hero-fresh-cart.jpg", "hero-aisle-cart.jpg"] },
      { src: path.join(brainDir, "blue_shopping_bag_3d_1794053871902.jpg"), names: ["blue-shopping-bag-3d.jpg"] },
      { src: path.join(brainDir, "gift_box_3d_icon_1794053425724.jpg"), names: ["gift-box-3d.jpg"] },
    ];

    syncList.forEach(item => {
      if (fs.existsSync(item.src)) {
        item.names.forEach(name => {
          fs.copyFileSync(item.src, path.join(assetsDir, name));
          fs.copyFileSync(item.src, path.join(publicDir, name));
        });
      }
    });

    // Sync master Super Admin Reference
    const userUploadedDir = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\c9a15307-ca50-4a98-86d7-d740eabbe413\\.user_uploaded";
    const cartCandidate = path.join(userUploadedDir, "media_1794646062763_01232915.png");
    if (fs.existsSync(cartCandidate)) {
      fs.copyFileSync(cartCandidate, path.join(publicDir, "check-cart.png"));
    }

    // Sync exact user-provided Landing Page Master Image (media_1794910523383_df6dc5b8.jpg)
    const landingRefImg = path.join(userUploadedDir, "media_1794910523383_df6dc5b8.jpg");
    if (fs.existsSync(landingRefImg)) {
      fs.copyFileSync(landingRefImg, path.join(publicDir, "landing-reference-master.jpg"));
      fs.copyFileSync(landingRefImg, path.join(assetsDir, "landing-reference-master.jpg"));
      fs.copyFileSync(landingRefImg, path.join(publicDir, "supermarket-hero-trolley.jpg"));
      fs.copyFileSync(landingRefImg, path.join(assetsDir, "supermarket-hero-trolley.jpg"));
      console.log("✓ Synced user landing reference image -> landing-reference-master.jpg");
    }

    // Master Delivery Reference (Full original saved as reference, while banner and scooter rider stay cropped)
    const deliveryRefCandidate = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\a56cf71a-e1f3-46be-861e-b3f62fc51713\\.user_uploaded\\media_1795089568047_c431b371.jpg";
    if (fs.existsSync(deliveryRefCandidate)) {
      fs.copyFileSync(deliveryRefCandidate, path.join(mobileAssetsDir, "delivery-reference-master.jpg"));
      fs.copyFileSync(deliveryRefCandidate, path.join(publicDir, "delivery-reference-master.jpg"));
    }

    // Sync exact user-provided Mobile App Welcome / Login Screen image with Delivery Button
    const generatedWelcomeCandidate = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\a56cf71a-e1f3-46be-861e-b3f62fc51713\\supermart_delivery_welcome_1795157880308.jpg";
    const welcomeRefCandidate = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\a56cf71a-e1f3-46be-861e-b3f62fc51713\\.user_uploaded\\media_1795157046387_ce8215a1.jpg";
    const welcomeSrc = fs.existsSync(generatedWelcomeCandidate) ? generatedWelcomeCandidate : (fs.existsSync(welcomeRefCandidate) ? welcomeRefCandidate : null);
    if (welcomeSrc) {
      fs.copyFileSync(welcomeSrc, path.join(mobileAssetsDir, "supermart-welcome.jpg"));
      fs.copyFileSync(welcomeSrc, path.join(publicDir, "supermart-welcome.jpg"));
      fs.copyFileSync(welcomeSrc, path.join(assetsDir, "supermart-welcome.jpg"));
      console.log("✓ Synced user welcome image with delivery button -> supermart-welcome.jpg");
    }

    // Sync exact user-provided Super Admin Header Banner (pristine panorama from user prompt)
    const exactHeaderBanner = path.join(userUploadedDir, "media_1794807037848_916ec656.jpg");
    if (fs.existsSync(exactHeaderBanner)) {
      fs.copyFileSync(exactHeaderBanner, path.join(publicDir, "exact-header-banner.jpg"));
      fs.copyFileSync(exactHeaderBanner, path.join(publicDir, "super-admin-exact-header.jpg"));
      fs.copyFileSync(exactHeaderBanner, path.join(publicDir, "supermarket-storefront-banner.png"));
      fs.copyFileSync(exactHeaderBanner, path.join(publicDir, "exact-banner.jpg"));
      fs.copyFileSync(exactHeaderBanner, path.join(assetsDir, "exact-header-banner.jpg"));
      fs.copyFileSync(exactHeaderBanner, path.join(assetsDir, "super-admin-exact-header.jpg"));

      const buf = fs.readFileSync(exactHeaderBanner);
      let w = 0, h = 0;
      for (let i = 0; i < buf.length - 8; i++) {
        if (buf[i] === 0xFF && (buf[i+1] === 0xC0 || buf[i+1] === 0xC2)) {
          h = buf.readUInt16BE(i + 5);
          w = buf.readUInt16BE(i + 7);
          break;
        }
      }
      fs.writeFileSync(path.join(__dirname, "header_banner_dims.json"), JSON.stringify({ w, h, size: buf.length }));
      console.log(`✓ Synced pristine header banner (${w}x${h}) -> super-admin-exact-header.jpg`);
    }

    const refMaster = path.join(userUploadedDir, "media_1794659704107_58fbadce.jpg");
    const refMasterFallback = path.join(userUploadedDir, "media_1794659026168_be103530.jpg");
    const masterToUse = fs.existsSync(refMaster) ? refMaster : (fs.existsSync(refMasterFallback) ? refMasterFallback : path.join(userUploadedDir, "media_1794658309735_226a05fd.jpg"));
    if (fs.existsSync(masterToUse)) {
      fs.copyFileSync(masterToUse, path.join(publicDir, "super-admin-reference-master.jpg"));
      fs.copyFileSync(masterToUse, path.join(assetsDir, "super-admin-reference-master.jpg"));
      console.log(`✓ Synced master reference image (${path.basename(masterToUse)}) to public & assets`);
    }

    // Sync clean login background
    const loginBgSource = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\f36b6542-12a0-4c50-a383-186a05bdb99d\\supermarket_portal_bg_v3_1794561743408.jpg";
    if (fs.existsSync(loginBgSource)) {
      fs.copyFileSync(loginBgSource, path.join(assetsDir, "supermarket-login-bg.jpg"));
      fs.copyFileSync(loginBgSource, path.join(publicDir, "supermarket-login-bg.jpg"));
      fs.copyFileSync(loginBgSource, path.join(publicDir, "grocerease-clean-login.jpg"));
      console.log("✓ Synced clean login background -> supermarket-login-bg.jpg");
    }

    // Sync celebration illustration
    const celebrationDollImg = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\66da6e68-95f4-42d0-a640-30ba83b6ef48\\payment_success_celebration_1794473637341.jpg";
    const currentBrainDir = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\6fa4a95c-77f9-4a4d-950b-d57336a67a4c";
    const paymentImages = [
      { src: path.join(currentBrainDir, "payment_pending_1794467892344.jpg"), destName: "payment-pending.jpg" },
      { src: celebrationDollImg, destName: "payment-approved.jpg" },
      { src: celebrationDollImg, destName: "payment-celebration.jpg" },
    ];

    paymentImages.forEach(img => {
      if (fs.existsSync(img.src)) {
        fs.copyFileSync(img.src, path.join(mobileAssetsDir, img.destName));
        fs.copyFileSync(img.src, path.join(assetsDir, img.destName));
        fs.copyFileSync(img.src, path.join(publicDir, img.destName));
      }
    });

    // Cleanup temporary debug files
    const debugFiles = [
      "crop_worker.ps1",
      "git_crop_result.txt",
      "banner_scan.txt",
      "crop_worker_out.txt",
      "conv_images.json",
      "found_images.json",
      "matching_brain_images.json",
      "py_check.txt",
      "ps_crop_result.txt",
      "git_sync_result.json",
      "server_ran.txt",
      "git_push_result.json",
      "git_status_output.txt",
      "user_files.json",
      "available_images.json",
      "pub_info.json",
      "user_files_detailed.json",
      "img_check.json",
      "latest_inspect.json",
      "startup_status.json"
    ];
    debugFiles.forEach(f => {
      const p = path.join(__dirname, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (_) {}
      }
    });
  } catch (e) {
    console.warn("Asset sync notice:", e.message);
  }
}
syncInitialAssets();

const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const authRoutes = require("./routes/authRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
const chatRoutes = require("./routes/chatRoutes");
const supermarketRoutes = require("./routes/supermarketRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const customerRoutes = require("./routes/customerRoutes");
const { authMiddleware } = require("./middleware/authMiddleware");
const { tenantMiddleware } = require("./middleware/tenantMiddleware");
const { seedSaaSPlatformData, ensureSuperAdminUser } = require("./utils/saasSeeder");
const { checkCloudinaryConnection } = require("./config/cloudinary");
const { verifySmtpConnection } = require("./utils/mailer");
const Product = require("./models/Product");
const Supermarket = require("./models/Supermarket");
const User = require("./models/User");
const Order = require("./models/Order");
const PlatformNotification = require("./models/PlatformNotification");

// Seed initial products if DB is empty so real-time CRUD and stock updates persist permanently
async function seedInitialProductsIfEmpty() {
  try {
    const count = await Product.countDocuments({ isActive: { $ne: false } });
    if (count === 0) {
      console.log("Database empty. Seeding real supermarket products...");
      const initialProducts = [
        {
          name: "Chocolate",
          brand: "Zero Sugar",
          category: "Beverages",
          barcode: "87654367",
          price: 352.0,
          costPrice: 280.0,
          stock: 5,
          lowStockThreshold: 10,
          imageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=120&auto=format&fit=crop&q=80",
          description: "Premium dark chocolate with zero added sugar.",
        },
        {
          name: "Lays",
          brand: "NO 1",
          category: "Beverages",
          barcode: "12356",
          price: 10.0,
          costPrice: 8.0,
          stock: 27,
          lowStockThreshold: 5,
          imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=120&auto=format&fit=crop&q=80",
          description: "Crispy salted potato chips.",
        },
        {
          name: "Shmapoo 180 ml",
          brand: "Dove",
          category: "Household",
          barcode: "1234561",
          price: 250.0,
          costPrice: 200.0,
          stock: 8,
          lowStockThreshold: 5,
          imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=120&auto=format&fit=crop&q=80",
          description: "Nourishing daily shampoo for smooth hair.",
        },
        {
          name: "Rice",
          brand: "Rice no 1",
          category: "Groceries",
          barcode: "1234566",
          price: 2500.0,
          costPrice: 2100.0,
          stock: 20,
          lowStockThreshold: 5,
          imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=80",
          description: "Superior long grain aromatic basmati rice.",
        },
        {
          name: "Rice",
          brand: "Rice no 1",
          category: "Groceries",
          barcode: "1234567",
          price: 2500.0,
          costPrice: 2100.0,
          stock: 20,
          lowStockThreshold: 5,
          imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=80",
          description: "Everyday fine grain polished rice 5kg pack.",
        },
      ];
      await Product.insertMany(initialProducts);
      console.log("✓ 5 real supermarket products successfully seeded into MongoDB Atlas.");
    } else {
      console.log(`Database already has ${count} real products.`);
    }
  } catch (err) {
    console.error("Seed error:", err.message);
  }
}

// Fix for Windows DNS SRV lookup failure (querySrv ECONNREFUSED)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/assets", express.static(path.join(__dirname, "../mobile-app/assets/images")));
app.use("/brain", express.static("C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\6fa4a95c-77f9-4a4d-950b-d57336a67a4c"));

// Connect to MongoDB Atlas (Production & Development with strict database target)
const DEFAULT_MONGO_URI = "mongodb+srv://forgeindiaconnectfic_db_user:c3cJ8MN3ihvmDEhZ@cluster0.nbawuro.mongodb.net/smart_supermarket?retryWrites=true&w=majority";
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;

if (MONGO_URI) {
  // If MONGO_URI contains an explicit database name in its path, preserve it; otherwise default to smart_supermarket
  let targetDbName = process.env.MONGO_DB_NAME;
  if (!targetDbName) {
    try {
      const match = MONGO_URI.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
      if (match && match[1] && match[1].trim()) {
        targetDbName = match[1].trim();
      }
    } catch (_) {}
  }
  const connectOptions = targetDbName ? { dbName: targetDbName } : { dbName: "smart_supermarket" };

  mongoose
    .connect(MONGO_URI, connectOptions)
    .then(async () => {
      console.log(`✓ MongoDB connected successfully to database: ${mongoose.connection.name || targetDbName || "smart_supermarket"}`);
      // Strictly guarantee the authorized Super Admin account exists
      await ensureSuperAdminUser();

      if (process.env.SEED_INITIAL_DATA === "true") {
        await seedSaaSPlatformData(); // Multi-Tenant SaaS platform seeder (Super Admin, 4 Supermarkets, Products & Orders)
      } else {
        console.log("ℹ️  Clean database mode active (SEED_INITIAL_DATA=false).");
        try {
          const DeletedRecord = require("./models/DeletedRecord");
          const alreadyInitialized = await DeletedRecord.findOne({ identifier: "FRESH_DATABASE_INITIALIZED_CLEAN_V2" });
          
          if (!alreadyInitialized) {
            console.log("ℹ️  Running one-time initial database cleanup for fresh environment...");
            const demoCodes = ["STR-001", "STR-002", "SM-7087", "STR-003"];
            const demoStores = await Supermarket.find({ code: { $in: demoCodes } });
            const demoIds = demoStores.map((s) => s._id);

            if (demoStores.length > 0 || demoIds.length > 0) {
              await Supermarket.deleteMany({
                $or: [{ _id: { $in: demoIds } }, { code: { $in: demoCodes } }],
              });
            }

            await Product.deleteMany({
              $or: [{ supermarket: { $in: demoIds } }, { supermarketCode: { $in: demoCodes } }],
            });
            await Order.deleteMany({
              $or: [
                { supermarket: { $in: demoIds } },
                { supermarketCode: { $in: demoCodes } },
                { orderId: { $in: ["ORD-7087-001", "ORD-001-002", "ORD-002-003", "ORD-003-004"] } },
              ],
            });
            await User.deleteMany({
              $or: [{ supermarket: { $in: demoIds } }, { username: { $in: ["agila_demo"] } }],
            });

            try {
              const CartActivity = require("./models/CartActivity");
              const ChatMessage = require("./models/ChatMessage");
              await CartActivity.deleteMany({
                $or: [{ supermarket: { $in: demoIds } }, { supermarketCode: { $in: demoCodes } }],
              });
              await ChatMessage.deleteMany({
                $or: [{ supermarket: { $in: demoIds } }, { supermarketCode: { $in: demoCodes } }],
              });
            } catch (_) {}

            // Set one-time marker so user-created supermarkets and notifications are never deleted on restart
            await DeletedRecord.create({
              identifier: "FRESH_DATABASE_INITIALIZED_CLEAN_V2",
              details: { initializedAt: new Date() },
            });
            console.log("✓ One-time database initialization complete. Future restarts will preserve all user-created records.");
          } else {
            console.log("✓ Real database records and notifications preserved across server restart.");
          }
        } catch (purgeErr) {
          console.warn("Notice during clean DB check:", purgeErr.message);
        }
      }
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err.message);
    });
} else {
  console.warn("⚠️  [MongoDB] MONGO_URI missing from .env");
}

// Global Auth & Multi-Tenant Middleware
app.use(authMiddleware);
app.use(tenantMiddleware);

app.get("/", (req, res) => {
  res.json({ success: true, message: "Smart Supermarket Multi-Tenant SaaS Backend is running!" });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend API is working",
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? "Configured" : "Not configured",
  });
});

app.get("/api/banner", (req, res) => {
  const bannerPath = path.join(__dirname, "../frontend/src/assets/hero-banner-art.jpg");
  const fallbackPath = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\854d9c17-1fe6-4371-834d-7baab097676a\\supermarket_saas_banner_1793941573073.jpg";
  if (fs.existsSync(bannerPath)) {
    return res.sendFile(bannerPath);
  }
  if (fs.existsSync(fallbackPath)) {
    return res.sendFile(fallbackPath);
  }
  res.status(404).send("Banner not found");
});

app.get("/api/header-banner", (req, res) => {
  const exactBanner = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\c9a15307-ca50-4a98-86d7-d740eabbe413\\.user_uploaded\\media_1794649669675_470a80fc.png";
  if (fs.existsSync(exactBanner)) return res.sendFile(exactBanner);
  const p = path.join(__dirname, "../frontend/public/super-admin-exact-header.png");
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send("Header banner not found");
});

app.get(["/api/landing-ref-img", "/landing-ref-img"], (req, res) => {
  const landingRef = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\c9a15307-ca50-4a98-86d7-d740eabbe413\\.user_uploaded\\media_1794910523383_df6dc5b8.jpg";
  if (fs.existsSync(landingRef)) return res.sendFile(landingRef);
  const p = path.join(__dirname, "../frontend/public/landing-reference-master.jpg");
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send("Landing reference image not found");
});

app.get("/api/login-bg", (req, res) => {
  const cleanSource = "C:\\Users\\Forgeindiaconnect\\.gemini\\antigravity\\brain\\f36b6542-12a0-4c50-a383-186a05bdb99d\\supermarket_portal_bg_v3_1794561743408.jpg";
  if (fs.existsSync(cleanSource)) return res.sendFile(cleanSource);
  const p = path.join(__dirname, "../frontend/public/supermarket-login-bg.jpg");
  if (fs.existsSync(p)) return res.sendFile(p);
  res.status(404).send("Login background image not found");
});

// Standard REST API Routes (with /api prefix)
app.use("/api/auth", authRoutes);
app.use("/api/supermarkets", supermarketRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/upload", uploadRoutes);

// Fallback Route Aliases (Supports requests without /api prefix for production resilience)
app.use("/supermarkets", supermarketRoutes);
app.use("/super-admin", superAdminRoutes);
app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/customers", customerRoutes);
app.use("/delivery", deliveryRoutes);
app.use("/upload", uploadRoutes);

const PORT = process.env.PORT || 5001;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

io.on("connection", (socket) => {
  const query = socket.handshake.query || {};
  const auth = socket.handshake.auth || {};
  const supermarketId = auth.supermarketId || query.supermarketId;
  const supermarketCode = auth.supermarketCode || query.supermarketCode;
  const role = auth.role || query.role;

  const joinRooms = (sId, sCode, r) => {
    if (r === "SUPER_ADMIN" || sCode === "ALL") {
      socket.join("super_admin");
      console.log(`[Socket] Client ${socket.id} joined super_admin central room`);
    }
    if (sId && sId !== "undefined" && sId !== "null") {
      socket.join(`tenant:${sId}`);
      console.log(`[Socket] Client ${socket.id} joined tenant:${sId}`);
    }
    if (sCode && sCode !== "DEFAULT" && sCode !== "ALL" && sCode !== "undefined" && sCode !== "null") {
      socket.join(`tenant:${String(sCode).toUpperCase()}`);
      console.log(`[Socket] Client ${socket.id} joined tenant:${String(sCode).toUpperCase()}`);
    }
  };

  joinRooms(supermarketId, supermarketCode, role);

  socket.on("join-tenant", (data) => {
    if (!data) return;
    joinRooms(data.supermarketId, data.supermarketCode, data.role);
  });

  socket.on("leave-tenant", (data) => {
    if (!data) return;
    if (data.supermarketId) socket.leave(`tenant:${data.supermarketId}`);
    if (data.supermarketCode) socket.leave(`tenant:${String(data.supermarketCode).toUpperCase()}`);
    if (data.allTenants) {
      const currentRooms = Array.from(socket.rooms);
      for (const rm of currentRooms) {
        if (rm.startsWith("tenant:")) socket.leave(rm);
      }
    }
  });

  socket.on("join-order", (data) => {
    if (!data) return;
    const orderId = typeof data === "string" ? data : (data.orderId || data.orderNumber);
    if (orderId) {
      socket.join(`order:${orderId}`);
    }
  });

  socket.on("leave-order", (data) => {
    if (!data) return;
    const orderId = typeof data === "string" ? data : (data.orderId || data.orderNumber);
    if (orderId) {
      socket.leave(`order:${orderId}`);
    }
  });

  socket.on("disconnect", () => {
    // Socket disconnected
  });
});

httpServer.listen(PORT, "0.0.0.0", async () => {
  console.log(`✓ Server running on http://0.0.0.0:${PORT}`);
  try {
    const cloudRes = await checkCloudinaryConnection();
    if (cloudRes && cloudRes.connected) {
      console.log(`✓ Cloudinary connected successfully (cloud_name: ${cloudRes.cloudName})`);
    }
  } catch (err) {
    console.warn("⚠️  [Cloudinary] Connection notice:", err.message);
  }

  try {
    const smtpRes = await verifySmtpConnection();
    if (smtpRes && smtpRes.connected) {
      console.log(`✓ Brevo SMTP connected successfully (host: ${smtpRes.host}:${smtpRes.port}, login: ${smtpRes.user})`);
    }
  } catch (err) {
    console.warn("⚠️  [Brevo SMTP] Connection notice:", err.message);
  }
});
