const express = require("express");
const router = express.Router();
const Supermarket = require("../models/Supermarket");

/**
 * 1. GET /api/supermarkets
 * Search & list active supermarkets registered by Super Admin.
 * Supports location search: city, state, address, name, or code.
 * Optional query: ?mode=online or ?mode=offline to filter supported stores.
 */
router.get("/", async (req, res) => {
  try {
    const { search = "", mode, limit = 50 } = req.query;

    const filter = {
      status: { $in: ["Active", "Trial"] },
    };

    if (mode === "online") {
      filter.onlineAvailable = true;
    } else if (mode === "offline") {
      filter.offlineAvailable = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { name: regex },
        { city: regex },
        { address: regex },
        { state: regex },
        { code: regex },
        { pincode: regex },
      ];
    }

    const supermarkets = await Supermarket.find(filter)
      .select("_id name code slug tagline city state address pincode phone logoUrl themeColor onlineAvailable offlineAvailable status")
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    return res.status(200).json({
      success: true,
      count: supermarkets.length,
      supermarkets: supermarkets.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        code: s.code,
        slug: s.slug || s.code.toLowerCase(),
        tagline: s.tagline,
        city: s.city || "Bangalore",
        state: s.state || "Karnataka",
        address: s.address || "",
        pincode: s.pincode || "",
        phone: s.phone || "",
        logoUrl: s.logoUrl || "",
        onlineAvailable: s.onlineAvailable === true,
        offlineAvailable: s.offlineAvailable === true,
        status: s.status,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to search supermarkets",
      error: err.message,
    });
  }
});

/**
 * 2. GET /api/supermarkets/:id/availability
 * Live database verification of Online/Offline availability for a specific store.
 */
router.get("/:id/availability", async (req, res) => {
  try {
    const { id } = req.params;
    let store = null;

    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      store = await Supermarket.findById(id);
    }
    if (!store && id) {
      store = await Supermarket.findOne({ code: String(id).toUpperCase() });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Supermarket not found in database",
      });
    }

    return res.status(200).json({
      success: true,
      supermarket: {
        _id: store._id.toString(),
        name: store.name,
        code: store.code,
        city: store.city,
        state: store.state,
        address: store.address,
        onlineAvailable: store.onlineAvailable === true,
        offlineAvailable: store.offlineAvailable === true,
        status: store.status,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to check supermarket availability",
      error: err.message,
    });
  }
});

/**
 * 3. POST /api/supermarkets/validate-mode
 * Validates whether the requested purchase mode (online/offline) is enabled by Super Admin.
 */
router.post("/validate-mode", async (req, res) => {
  try {
    const { supermarketId, supermarketCode, mode } = req.body;

    let store = null;
    const lookupId = supermarketId || supermarketCode;

    if (lookupId && String(lookupId).match(/^[0-9a-fA-F]{24}$/)) {
      store = await Supermarket.findById(lookupId);
    }
    if (!store && lookupId) {
      store = await Supermarket.findOne({ code: String(lookupId).toUpperCase() });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        allowed: false,
        message: "Supermarket not found in database",
      });
    }

    const normalizedMode = String(mode || "").toLowerCase().trim();

    if (normalizedMode === "online") {
      if (store.onlineAvailable !== true) {
        return res.status(200).json({
          success: false,
          allowed: false,
          message: "This supermarket does not currently support Online Purchase. Please choose an available option.",
          supermarket: {
            _id: store._id.toString(),
            name: store.name,
            code: store.code,
            onlineAvailable: false,
            offlineAvailable: store.offlineAvailable === true,
          },
        });
      }
    } else if (normalizedMode === "offline") {
      if (store.offlineAvailable !== true) {
        return res.status(200).json({
          success: false,
          allowed: false,
          message: "This supermarket does not currently support Offline Purchase. Please choose an available option.",
          supermarket: {
            _id: store._id.toString(),
            name: store.name,
            code: store.code,
            onlineAvailable: store.onlineAvailable === true,
            offlineAvailable: false,
          },
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        allowed: false,
        message: "Invalid purchase mode specified (must be 'online' or 'offline')",
      });
    }

    return res.status(200).json({
      success: true,
      allowed: true,
      message: `${normalizedMode.toUpperCase()} Purchase is verified and enabled for ${store.name}`,
      supermarket: {
        _id: store._id.toString(),
        name: store.name,
        code: store.code,
        city: store.city,
        address: store.address,
        onlineAvailable: store.onlineAvailable === true,
        offlineAvailable: store.offlineAvailable === true,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      allowed: false,
      message: "Mode validation failed",
      error: err.message,
    });
  }
});

/**
 * 4. GET /api/supermarkets/:id
 * Retrieve details for a single supermarket.
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let store = null;

    if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
      store = await Supermarket.findById(id);
    }
    if (!store && id) {
      store = await Supermarket.findOne({ code: String(id).toUpperCase() });
    }

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Supermarket not found",
      });
    }

    return res.status(200).json({
      success: true,
      supermarket: {
        _id: store._id.toString(),
        name: store.name,
        code: store.code,
        tagline: store.tagline,
        city: store.city,
        state: store.state,
        address: store.address,
        pincode: store.pincode,
        phone: store.phone,
        logoUrl: store.logoUrl,
        onlineAvailable: store.onlineAvailable === true,
        offlineAvailable: store.offlineAvailable === true,
        status: store.status,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Error fetching supermarket",
      error: err.message,
    });
  }
});

module.exports = router;
