const Supermarket = require("../models/Supermarket");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const CartActivity = require("../models/CartActivity");
const ChatMessage = require("../models/ChatMessage");
const PlatformNotification = require("../models/PlatformNotification");
const DeletedRecord = require("../models/DeletedRecord");

async function seedSaaSPlatformData() {
  try {
    // =========================================================================
    // 1. ENSURE PLATFORM SUPER ADMIN (admin / Admin@123)
    // =========================================================================
    let superAdmin = await User.findOne({ username: "admin" });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: "Super Admin",
        username: "admin",
        email: "superadmin@grocerease.store",
        password: "Admin@123",
        role: "SUPER_ADMIN",
        status: "Active",
      });
      console.log("✓ Created Platform Super Admin: admin / Admin@123");
    } else {
      superAdmin.name = "Super Admin";
      superAdmin.role = "SUPER_ADMIN";
      superAdmin.email = "superadmin@grocerease.com";
      superAdmin.password = "Admin@123";
      await superAdmin.save();
    }

    // =========================================================================
    // PERMANENT DELETION PROTECTION GUARD:
    // If the database has already been initialized, DO NOT recreate any
    // supermarkets, products, or orders that the user has deleted!
    // =========================================================================
    let seedMarker = await DeletedRecord.findOne({ identifier: "SYSTEM_INITIAL_SEED_COMPLETED" });
    if (!seedMarker) {
      const existingStoresCount = await Supermarket.countDocuments();
      if (existingStoresCount > 0) {
        await DeletedRecord.create({
          entityType: "SYSTEM",
          identifier: "SYSTEM_INITIAL_SEED_COMPLETED",
          name: "Existing Database Detected - Seed Marked Complete",
        });
        seedMarker = true;
      }
    }

    if (seedMarker) {
      console.log("✓ System initial seed is already complete. Preserving permanent deletions.");
      return;
    }

    // =========================================================================
    // 2. STORE 1: GrocerEase Supermarket (STR-001) - Enterprise (Pooja Admin)
    // =========================================================================
    let storeA = await Supermarket.findOne({ code: "STR-001" });
    if (!storeA) {
      storeA = await Supermarket.create({
        name: "GrocerEase Supermarket",
        code: "STR-001",
        slug: "grocerease-supermarket",
        tagline: "Autonomous Smart Retail & High-Speed Clearance",
        address: "100ft Road, HAL 2nd Stage, Indiranagar",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560038",
        phone: "+91 98450 12345",
        email: "poojasree@gmail.com",
        adminUsername: "pooja",
        adminPassword: "pooja@123",
        adminName: "Pooja V",
        status: "Active",
        plan: "Enterprise",
        themeColor: "#1455d9",
        subscriptionAmount: 34999,
        billingCycle: "Monthly",
        startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80",
      });
      console.log("✓ Created Store 1: GrocerEase Supermarket (STR-001)");
    } else {
      storeA.name = "GrocerEase Supermarket";
      storeA.adminUsername = "pooja";
      storeA.adminPassword = "pooja@123";
      storeA.adminName = "Pooja V";
      storeA.email = "poojasree@gmail.com";
      storeA.status = "Active";
      storeA.plan = "Enterprise";
      storeA.subscriptionAmount = 34999;
      storeA.billingCycle = "Monthly";
      if (!storeA.logoUrl) storeA.logoUrl = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80";
      await storeA.save();
    }

    let adminA = await User.findOne({ username: "pooja" });
    if (!adminA) {
      adminA = await User.create({
        name: "Pooja V",
        username: "pooja",
        email: "poojasree@gmail.com",
        password: "pooja@123",
        role: "STORE_ADMIN",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        supermarketName: storeA.name,
        status: "Active",
      });
      console.log("✓ Created Store Admin 1: pooja / pooja@123");
    } else {
      adminA.name = "Pooja V";
      adminA.password = "pooja@123";
      adminA.role = "STORE_ADMIN";
      adminA.supermarket = storeA._id;
      adminA.supermarketCode = storeA.code;
      adminA.supermarketName = storeA.name;
      adminA.status = "Active";
      await adminA.save();
    }

    // =========================================================================
    // 3. STORE 2: FreshMart Supermarket (STR-002) - Professional (Rohan Gupta)
    // =========================================================================
    let storeB = await Supermarket.findOne({ code: "STR-002" });
    if (!storeB) {
      storeB = await Supermarket.create({
        name: "FreshMart Supermarket",
        code: "STR-002",
        slug: "freshmart-supermarket",
        tagline: "Farm Fresh Groceries & Express Clearance",
        address: "80ft Road, 4th Block, Koramangala",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560034",
        phone: "+91 98451 98765",
        email: "storeb@freshmart.store",
        adminUsername: "storeb",
        adminPassword: "StoreB@123",
        adminName: "Rohan Gupta",
        status: "Active",
        plan: "Professional",
        themeColor: "#059669",
        subscriptionAmount: 9999,
        billingCycle: "Monthly",
        startDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        logoUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80",
      });
      console.log("✓ Created Store 2: FreshMart Supermarket (STR-002)");
    } else {
      storeB.name = "FreshMart Supermarket";
      storeB.adminUsername = "storeb";
      storeB.adminPassword = "StoreB@123";
      storeB.adminName = "Rohan Gupta";
      storeB.email = "storeb@freshmart.store";
      storeB.status = "Active";
      storeB.plan = "Professional";
      storeB.subscriptionAmount = 9999;
      storeB.billingCycle = "Monthly";
      if (!storeB.logoUrl) storeB.logoUrl = "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80";
      await storeB.save();
    }

    let adminB = await User.findOne({ username: "storeb" });
    if (!adminB) {
      adminB = await User.create({
        name: "Rohan Gupta",
        username: "storeb",
        email: "storeb@freshmart.store",
        password: "StoreB@123",
        role: "STORE_ADMIN",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        supermarketName: storeB.name,
        status: "Active",
      });
      console.log("✓ Created Store Admin 2: storeb / StoreB@123");
    } else {
      adminB.name = "Rohan Gupta";
      adminB.password = "StoreB@123";
      adminB.role = "STORE_ADMIN";
      adminB.supermarket = storeB._id;
      adminB.supermarketCode = storeB.code;
      adminB.supermarketName = storeB.name;
      adminB.status = "Active";
      await adminB.save();
    }

    // =========================================================================
    // 4. STORE 3: Akshaya (SM-7087) - Basic (Akshaya Admin)
    // =========================================================================
    let storeAkshaya = await Supermarket.findOne({
      $or: [{ code: "SM-7087" }, { slug: "akshaya" }, { adminUsername: "akshaya" }],
    });
    if (!storeAkshaya) {
      storeAkshaya = await Supermarket.create({
        name: "Akshaya",
        code: "SM-7087",
        slug: "akshaya",
        tagline: "Smart Supermarket & Instant Gate Clearance",
        address: "Begur",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560001",
        phone: "+91 6789098765",
        email: "akshaya@gmail.com",
        ownerName: "Akshaya",
        contactPerson: "Akshaya Admin",
        adminUsername: "akshaya",
        adminPassword: "Akshaya@123",
        adminName: "Akshaya Admin",
        status: "Active",
        plan: "Basic",
        themeColor: "#16a34a",
        logoUrl: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=200&auto=format&fit=crop&q=80",
        subscriptionAmount: 4999,
        billingCycle: "Monthly",
        startDate: new Date("2026-11-14T00:00:00.000Z"),
        expiryDate: new Date("2026-12-14T00:00:00.000Z"),
      });
      console.log("✓ Created Store 3: Akshaya (SM-7087)");
    } else {
      storeAkshaya.name = "Akshaya";
      storeAkshaya.code = "SM-7087";
      storeAkshaya.adminUsername = "akshaya";
      storeAkshaya.adminPassword = "Akshaya@123";
      storeAkshaya.adminName = "Akshaya Admin";
      storeAkshaya.email = "akshaya@gmail.com";
      storeAkshaya.status = "Active";
      storeAkshaya.plan = "Basic";
      storeAkshaya.subscriptionAmount = 4999;
      await storeAkshaya.save();
    }

    let adminAkshaya = await User.findOne({ username: "akshaya" });
    if (!adminAkshaya) {
      adminAkshaya = await User.create({
        name: "Akshaya Admin",
        username: "akshaya",
        email: "akshaya@gmail.com",
        password: "Akshaya@123",
        role: "STORE_ADMIN",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        supermarketName: storeAkshaya.name,
        phone: "+91 6789098765",
        status: "Active",
      });
      console.log("✓ Created Store Admin 3: akshaya / Akshaya@123");
    } else {
      adminAkshaya.name = "Akshaya Admin";
      adminAkshaya.supermarket = storeAkshaya._id;
      adminAkshaya.supermarketCode = storeAkshaya.code;
      adminAkshaya.supermarketName = storeAkshaya.name;
      adminAkshaya.status = "Active";
      await adminAkshaya.save();
    }

    // =========================================================================
    // 5. STORE 4: 24/7 Freshmart (STR-003) - Demo Store ONLY (Strict Code Match)
    // =========================================================================
    let storeFreshmart = await Supermarket.findOne({ code: "STR-003" });
    if (!storeFreshmart) {
      storeFreshmart = await Supermarket.create({
        name: "24/7 Freshmart",
        code: "STR-003",
        slug: "247-freshmart",
        tagline: "24/7 Express Mart & Instant Checkout",
        address: "Brigade Road, Ashok Nagar",
        city: "Bangalore",
        state: "Karnataka",
        pincode: "560025",
        phone: "+91 98452 33445",
        email: "agila.demo@grocerease.store",
        ownerName: "Agila",
        contactPerson: "Agila Admin",
        adminUsername: "agila_demo",
        adminPassword: "Agila@123",
        adminName: "Agila Demo",
        status: "Active",
        plan: "Basic",
        themeColor: "#16a34a",
        logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80",
        subscriptionAmount: 4999,
        billingCycle: "Monthly",
        startDate: new Date("2026-11-14T00:00:00.000Z"),
        expiryDate: new Date("2026-12-14T00:00:00.000Z"),
      });
      console.log("✓ Created Demo Store: 24/7 Freshmart (STR-003)");
    }

    let adminFreshmart = await User.findOne({ username: "agila_demo" });
    if (!adminFreshmart) {
      adminFreshmart = await User.create({
        name: "Agila Demo",
        username: "agila_demo",
        email: "agila.demo@grocerease.store",
        password: "Agila@123",
        role: "STORE_ADMIN",
        supermarket: storeFreshmart._id,
        supermarketCode: storeFreshmart.code,
        supermarketName: storeFreshmart.name,
        phone: "+91 98452 33445",
        status: "Active",
      });
      console.log("✓ Created Demo Store Admin: agila_demo / Agila@123");
    }

    // =========================================================================
    // 6. ENSURE 5 DISTINCT CATALOG PRODUCTS PER SUPERMARKET (TOTAL = 20 SKUs)
    // =========================================================================
    const storeACatalog = [
      {
        name: "Fresh Red Apples (Washington)",
        brand: "Fresh Orchard",
        category: "Fruits & Vegetables",
        barcode: "2001849201948",
        price: 180.0,
        costPrice: 130.0,
        stock: 65,
        lowStockThreshold: 15,
        imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop&q=80",
        description: "Crisp and juicy sweet Washington red apples.",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        isActive: true,
      },
      {
        name: "Cadbury Dairy Milk Chocolate",
        brand: "Cadbury",
        category: "Beverages",
        barcode: "87654367",
        price: 352.0,
        costPrice: 280.0,
        stock: 25,
        lowStockThreshold: 10,
        imageUrl: "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=120&auto=format&fit=crop&q=80",
        description: "Premium rich milk chocolate.",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        isActive: true,
      },
      {
        name: "Lays Potato Chips Classic Salted",
        brand: "Lays",
        category: "Snacks",
        barcode: "12356",
        price: 20.0,
        costPrice: 14.0,
        stock: 50,
        lowStockThreshold: 10,
        imageUrl: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=120&auto=format&fit=crop&q=80",
        description: "Crispy salted potato chips.",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        isActive: true,
      },
      {
        name: "Dove Daily Moisture Shampoo 180ml",
        brand: "Dove",
        category: "Household",
        barcode: "1234561",
        price: 250.0,
        costPrice: 195.0,
        stock: 30,
        lowStockThreshold: 8,
        imageUrl: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=120&auto=format&fit=crop&q=80",
        description: "Nourishing daily moisture hair shampoo.",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        isActive: true,
      },
      {
        name: "Daawat Rozana Basmati Rice 5kg",
        brand: "Daawat",
        category: "Groceries",
        barcode: "1234566",
        price: 2500.0,
        costPrice: 2100.0,
        stock: 20,
        lowStockThreshold: 5,
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=80",
        description: "Superior long grain aromatic basmati rice.",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        isActive: true,
      },
    ];

    const storeBCatalog = [
      {
        name: "Organic Himalayan Green Tea 250g",
        brand: "EcoHerbs",
        category: "Beverages",
        barcode: "8901020304051",
        price: 320.0,
        costPrice: 240.0,
        stock: 30,
        lowStockThreshold: 8,
        imageUrl: "https://images.unsplash.com/photo-1508253578933-20b529302151?w=120&auto=format&fit=crop&q=80",
        description: "Fresh handpicked whole leaf organic green tea.",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        isActive: true,
      },
      {
        name: "Pure Alphonso Mango Juice 1L",
        brand: "TropicFresh",
        category: "Beverages",
        barcode: "8901020304068",
        price: 160.0,
        costPrice: 120.0,
        stock: 25,
        lowStockThreshold: 6,
        imageUrl: "https://images.unsplash.com/photo-1534353473418-4cfa6c56fd38?w=120&auto=format&fit=crop&q=80",
        description: "100% natural Alphonso mango fruit juice.",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        isActive: true,
      },
      {
        name: "California Roasted Almonds 500g",
        brand: "NutriDelight",
        category: "Snacks",
        barcode: "8901020304075",
        price: 480.0,
        costPrice: 380.0,
        stock: 18,
        lowStockThreshold: 5,
        imageUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=120&auto=format&fit=crop&q=80",
        description: "Lightly salted crunchy California roasted almonds.",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        isActive: true,
      },
      {
        name: "Fresh Red Apples (Washington)",
        brand: "Fresh Orchard",
        category: "Fruits & Vegetables",
        barcode: "2001739104829",
        price: 180.0,
        costPrice: 130.0,
        stock: 40,
        lowStockThreshold: 10,
        imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop&q=80",
        description: "Crisp and juicy sweet Washington red apples.",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        isActive: true,
      },
      {
        name: "Royal Basmati Rice 5kg",
        brand: "Royal Heritage",
        category: "Groceries",
        barcode: "2005938102948",
        price: 650.0,
        costPrice: 520.0,
        stock: 35,
        lowStockThreshold: 8,
        imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop&q=80",
        description: "Premium aged long-grain aromatic basmati rice.",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        isActive: true,
      },
    ];

    const storeAkshayaCatalog = [
      {
        name: "Mens Wear",
        category: "Mens Wear / Cinemaflex",
        brand: "Cinemaflex",
        barcode: "2002124937529",
        price: 9999.0,
        costPrice: 7500.0,
        stock: 5,
        lowStockThreshold: 10,
        imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80",
        description: "Premium casual and formal men's apparel collection.",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        isActive: true,
      },
      {
        name: "Power Provisions Soup Cp Chck Veg Bw Brth - CS of 6/ 1.25 OZ",
        category: "Power Food, Beverages & Tobacco > Food Items > Soups & Broths",
        brand: "Power Provisions",
        barcode: "010032289056",
        price: 506.0,
        costPrice: 420.0,
        stock: 10,
        lowStockThreshold: 5,
        imageUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=300&auto=format&fit=crop&q=80",
        description: "Chicken vegetable bone broth keto friendly instant soup cups.",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        isActive: true,
      },
      {
        name: "Cinemaflex Classic Men's T-Shirt",
        category: "Mens Wear / Cinemaflex",
        brand: "Cinemaflex",
        barcode: "2002124937530",
        price: 1499.0,
        costPrice: 950.0,
        stock: 15,
        lowStockThreshold: 5,
        imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80",
        description: "100% combed cotton breathable classic t-shirt.",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        isActive: true,
      },
      {
        name: "Farm Fresh Whole Milk 1L",
        brand: "Amul",
        category: "Dairy",
        barcode: "2006849201948",
        price: 68.0,
        costPrice: 58.0,
        stock: 45,
        lowStockThreshold: 12,
        imageUrl: "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop&q=80",
        description: "Pasteurized homogenized full-cream cow milk.",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        isActive: true,
      },
      {
        name: "NutriDelight Mixed Dry Fruits 500g",
        brand: "NutriDelight",
        category: "Snacks",
        barcode: "8901020304099",
        price: 550.0,
        costPrice: 420.0,
        stock: 20,
        lowStockThreshold: 5,
        imageUrl: "https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=120&auto=format&fit=crop&q=80",
        description: "Nutritious blend of premium almonds, cashews, and walnuts.",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        isActive: true,
      },
    ];

    const allStoreCatalogs = [
      ...storeACatalog,
      ...storeBCatalog,
      ...storeAkshayaCatalog,
    ];

    for (const prodItem of allStoreCatalogs) {
      const existing = await Product.findOne({
        barcode: prodItem.barcode,
        supermarket: prodItem.supermarket,
      });

      if (!existing) {
        await Product.create(prodItem);
      } else {
        existing.name = prodItem.name;
        existing.price = prodItem.price;
        existing.stock = prodItem.stock;
        existing.supermarket = prodItem.supermarket;
        existing.supermarketCode = prodItem.supermarketCode;
        existing.isActive = true;
        await existing.save();
      }
    }
    console.log("✓ Guaranteed Catalog SKUs for system demonstration supermarkets.");

    // Guarantee that user-created supermarkets (e.g. SM-3662 or any newly onboarded store)
    // strictly have ZERO SKUs ("if I add the new supermarket it's no need to show anything")
    try {
      const deletedUserProds = await Product.deleteMany({
        $or: [
          { supermarketCode: "SM-3662" },
          { supermarketCode: { $nin: ["STR-001", "STR-002", "SM-7087"] } },
        ],
      });
      if (deletedUserProds?.deletedCount > 0) {
        console.log(`✓ Cleaned ${deletedUserProds.deletedCount} default products from newly added user supermarkets.`);
      }
    } catch (cleanErr) {
      console.warn("Product cleanup notice:", cleanErr.message);
    }

    // =========================================================================
    // 7. ENSURE REALISTIC COMPLETED ORDERS & SALES LEDGER (₹76,066 Network Volume)
    // =========================================================================
    const existingOrdersCount = await Order.countDocuments();
    if (existingOrdersCount === 0) {
      // 1. Akshaya Orders: Nov 14 Peak (2x Mens Wear + 2x Soup = ₹21,010)
      const nov14 = new Date("2026-11-14T14:30:00.000Z");
      const order1 = {
        orderId: "ORD-7087-001",
        orderNumber: "ORD-7087-001",
        supermarket: storeAkshaya._id,
        supermarketCode: storeAkshaya.code,
        supermarketName: storeAkshaya.name,
        customerName: "Venkatesh Rao",
        customerPhone: "+91 98450 77112",
        totalAmount: 21010,
        paymentMethod: "UPI",
        paymentStatus: "Completed",
        gateStatus: "Turnstile Verified & Exited",
        items: [
          {
            name: "Mens Wear",
            category: "Mens Wear / Cinemaflex",
            barcode: "2002124937529",
            price: 9999,
            quantity: 2,
            subtotal: 19998,
          },
          {
            name: "Power Provisions Soup Cp Chck Veg Bw Brth - CS of 6/ 1.25 OZ",
            category: "Power Food, Beverages & Tobacco > Food Items > Soups & Broths",
            barcode: "010032289056",
            price: 506,
            quantity: 2,
            subtotal: 1012,
          },
        ],
        createdAt: nov14,
        updatedAt: nov14,
      };

      // 2. GrocerEase Supermarket Order (Fresh Apples + Chocolate = ₹15,336)
      const nov12 = new Date("2026-11-12T11:20:00.000Z");
      const order2 = {
        orderId: "ORD-001-002",
        orderNumber: "ORD-001-002",
        supermarket: storeA._id,
        supermarketCode: storeA.code,
        supermarketName: storeA.name,
        customerName: "Pooja V",
        customerPhone: "+91 98450 12345",
        totalAmount: 15336,
        paymentMethod: "Card",
        paymentStatus: "Completed",
        gateStatus: "Turnstile Verified & Exited",
        items: [
          {
            name: "Fresh Red Apples (Washington)",
            category: "Fruits & Vegetables",
            barcode: "2001849201948",
            price: 180,
            quantity: 50,
            subtotal: 9000,
          },
          {
            name: "Cadbury Dairy Milk Chocolate",
            category: "Beverages",
            barcode: "87654367",
            price: 352,
            quantity: 18,
            subtotal: 6336,
          },
        ],
        createdAt: nov12,
        updatedAt: nov12,
      };

      // 3. FreshMart Supermarket Order (Almonds + Apples = ₹9,120)
      const nov13 = new Date("2026-11-13T16:45:00.000Z");
      const order3 = {
        orderId: "ORD-002-003",
        orderNumber: "ORD-002-003",
        supermarket: storeB._id,
        supermarketCode: storeB.code,
        supermarketName: storeB.name,
        customerName: "Rohan Gupta",
        customerPhone: "+91 98451 98765",
        totalAmount: 9120,
        paymentMethod: "UPI",
        paymentStatus: "Completed",
        gateStatus: "Turnstile Verified & Exited",
        items: [
          {
            name: "Fresh Red Apples (Washington)",
            category: "Fruits & Vegetables",
            barcode: "2001739104829",
            price: 180,
            quantity: 24,
            subtotal: 4320,
          },
          {
            name: "California Roasted Almonds 500g",
            category: "Snacks",
            barcode: "8901020304075",
            price: 480,
            quantity: 10,
            subtotal: 4800,
          },
        ],
        createdAt: nov13,
        updatedAt: nov13,
      };

      // 4. 24/7 Freshmart Order (Butter + Orange Juice = ₹9,125)
      const nov15 = new Date("2026-11-15T09:10:00.000Z");
      const order4 = {
        orderId: "ORD-003-004",
        orderNumber: "ORD-003-004",
        supermarket: storeFreshmart._id,
        supermarketCode: storeFreshmart.code,
        supermarketName: storeFreshmart.name,
        customerName: "Agila",
        customerPhone: "+91 98452 33445",
        totalAmount: 9125,
        paymentMethod: "UPI",
        paymentStatus: "Completed",
        gateStatus: "Turnstile Verified & Exited",
        items: [
          {
            name: "Amul Salted Butter 500g",
            category: "Dairy",
            barcode: "2006738192049",
            price: 275,
            quantity: 20,
            subtotal: 5500,
          },
          {
            name: "Tropicana 100% Real Orange Juice 1L",
            category: "Beverages",
            barcode: "8901020304082",
            price: 145,
            quantity: 25,
            subtotal: 3625,
          },
        ],
        createdAt: nov15,
        updatedAt: nov15,
      };

      await Order.insertMany([order1, order2, order3, order4]);
      console.log("✓ Seeded realistic historical orders across all 4 supermarkets.");
    }

    // =========================================================================
    // 8. SEED PRIVATE SUPPORT CHAT MESSAGES (Strictly Tenant-Isolated)
    // =========================================================================
    const chatCount = await ChatMessage.countDocuments();
    if (chatCount === 0) {
      const stores = await Supermarket.find();
      const initialChats = [];

      for (const sm of stores) {
        initialChats.push({
          supermarket: sm._id,
          supermarketName: sm.name,
          supermarketCode: sm.code,
          sender: superAdmin._id,
          senderName: "GrocerEase Super Admin",
          senderRole: "SUPER_ADMIN",
          message: `Welcome to GrocerEase SaaS, ${sm.name}! Your dedicated private support channel with Super Admin is active. Feel free to reach out here anytime.`,
          isRead: true,
          createdAt: new Date(Date.now() - 3600000 * 4),
        });

        initialChats.push({
          supermarket: sm._id,
          supermarketName: sm.name,
          supermarketCode: sm.code,
          sender: superAdmin._id,
          senderName: `${sm.name} Admin`,
          senderRole: "STORE_ADMIN",
          message: `Thank you Super Admin! Our store dashboard and turnstiles are running smoothly.`,
          isRead: false,
          createdAt: new Date(Date.now() - 3600000 * 1),
        });
      }

      if (initialChats.length > 0) {
        await ChatMessage.insertMany(initialChats);
        console.log(`✓ Initialized ${initialChats.length} private supermarket chat messages.`);
      }
    }

    // =========================================================================
    // 9. ENSURE 8 REALISTIC PLATFORM NOTIFICATIONS (Matching Localhost Badge 8)
    // =========================================================================
    const notifCount = await PlatformNotification.countDocuments();
    if (notifCount < 8) {
      const stores = await Supermarket.find();
      const s1 = stores.find((s) => s.code === "STR-001") || stores[0];
      const s2 = stores.find((s) => s.code === "STR-002") || stores[1] || stores[0];
      const s3 = stores.find((s) => s.code === "SM-7087") || stores[2] || stores[0];
      const s4 = stores.find((s) => s.code === "STR-003") || stores[3] || stores[0];

      const platformNotifs = [
        {
          title: "New Supermarket Onboarded",
          type: "NEW_REGISTRATION",
          supermarket: s4?._id,
          supermarketName: s4?.name || "24/7 Freshmart",
          supermarketCode: s4?.code || "STR-003",
          message: 'Supermarket "24/7 Freshmart" (STR-003) registered with Basic Plan.',
          color: "green",
          isRead: false,
          actionUrl: "/super-admin/supermarkets",
          createdAt: new Date(Date.now() - 3600000 * 2),
        },
        {
          title: "Subscription Renewal Notice Sent",
          type: "EMAIL_SENT",
          supermarket: s1?._id,
          supermarketName: s1?.name || "GrocerEase Supermarket",
          supermarketCode: s1?.code || "STR-001",
          message: "Automated renewal notice dispatched to poojasree@gmail.com via Brevo SMTP.",
          color: "blue",
          isRead: false,
          actionUrl: "/super-admin/plans",
          createdAt: new Date(Date.now() - 3600000 * 5),
        },
        {
          title: "Subscription Active",
          type: "SUBSCRIPTION_RENEWED",
          supermarket: s2?._id,
          supermarketName: s2?.name || "FreshMart Supermarket",
          supermarketCode: s2?.code || "STR-002",
          message: "Professional plan renewed successfully for FreshMart Supermarket.",
          color: "green",
          isRead: false,
          actionUrl: "/super-admin/plans",
          createdAt: new Date(Date.now() - 3600000 * 8),
        },
        {
          title: "New Supermarket Onboarded",
          type: "NEW_REGISTRATION",
          supermarket: s3?._id,
          supermarketName: s3?.name || "Akshaya Supermarket",
          supermarketCode: s3?.code || "SM-7087",
          message: 'Supermarket "Akshaya" (SM-7087) registered with Basic Plan.',
          color: "green",
          isRead: false,
          actionUrl: "/super-admin/supermarkets",
          createdAt: new Date(Date.now() - 3600000 * 12),
        },
        {
          title: "Trial Period Active",
          type: "TRIAL_EXPIRING",
          supermarket: s3?._id,
          supermarketName: s3?.name || "Akshaya Supermarket",
          supermarketCode: s3?.code || "SM-7087",
          message: "Akshaya Supermarket has 18 days remaining on Basic subscription.",
          color: "orange",
          isRead: false,
          actionUrl: "/super-admin/plans",
          createdAt: new Date(Date.now() - 3600000 * 16),
        },
        {
          title: "IoT Turnstile Gateway Online",
          type: "SYSTEM",
          supermarket: s1?._id,
          supermarketName: s1?.name || "GrocerEase Supermarket",
          supermarketCode: s1?.code || "STR-001",
          message: "4 Smart QR exit turnstile gates verified and online.",
          color: "green",
          isRead: false,
          actionUrl: "/super-admin/supermarkets",
          createdAt: new Date(Date.now() - 3600000 * 20),
        },
        {
          title: "Subscription Renewal Notice Sent",
          type: "EMAIL_SENT",
          supermarket: s2?._id,
          supermarketName: s2?.name || "FreshMart Supermarket",
          supermarketCode: s2?.code || "STR-002",
          message: "Subscription statement generated and sent to storeb@gmail.com.",
          color: "blue",
          isRead: false,
          actionUrl: "/super-admin/plans",
          createdAt: new Date(Date.now() - 3600000 * 24),
        },
        {
          title: "Platform Security Audit Passed",
          type: "SYSTEM",
          supermarket: s1?._id,
          supermarketName: s1?.name || "GrocerEase Supermarket",
          supermarketCode: s1?.code || "STR-001",
          message: "Cryptographic tenant boundary checks passed with 100% isolation.",
          color: "green",
          isRead: false,
          actionUrl: "/super-admin/dashboard",
          createdAt: new Date(Date.now() - 3600000 * 28),
        },
      ];

      await PlatformNotification.deleteMany({});
      await PlatformNotification.insertMany(platformNotifs);
      console.log("✓ Seeded 8 platform notifications (matching localhost badge 8).");
    }

    // Mark initial seed as complete so it is never re-run
    await DeletedRecord.create({
      entityType: "SYSTEM",
      identifier: "SYSTEM_INITIAL_SEED_COMPLETED",
      name: "Initial System Seed Complete",
    });

    console.log("✓ Multi-Tenant SaaS platform seeding complete:");
    console.log("  - Super Admin: admin / Admin@123");
    console.log("  - Supermarket 1 (STR-001): pooja / pooja@123 (Pooja V - Enterprise)");
    console.log("  - Supermarket 2 (STR-002): storeb / StoreB@123 (Rohan Gupta - Professional)");
    console.log("  - Supermarket 3 (SM-7087): akshaya / Akshaya@123 (Akshaya Admin - Basic)");
    console.log("  - Supermarket 4 (STR-003): agila / Agila@123 (Agila - Basic)");
  } catch (err) {
    console.error("Multi-tenant seeding error:", err);
  }
}

module.exports = { seedSaaSPlatformData };
