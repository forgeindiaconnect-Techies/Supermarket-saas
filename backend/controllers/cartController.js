const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const CartActivity = require("../models/CartActivity");

// Helper to resolve customer registered supermarket ID safely
function resolveCustomerStoreId(req) {
  if (req.user?.supermarket?._id) return req.user.supermarket._id.toString();
  if (req.user?.supermarketId) return req.user.supermarketId.toString();
  if (req.customer?.supermarket?._id) return req.customer.supermarket._id.toString();
  if (req.customer?.supermarket) return req.customer.supermarket.toString();
  if (req.supermarketId) return req.supermarketId.toString();
  return null;
}

// GET /api/cart - Get authenticated customer's cart
exports.getCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required.",
      });
    }

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "Customer registered supermarket not found.",
      });
    }

    let cart = await Cart.findOne({ customer: customerId, supermarket: storeId });

    if (!cart) {
      cart = await Cart.create({
        customer: customerId,
        supermarket: storeId,
        items: [],
        totalItems: 0,
        grossAmount: 0,
        totalSavings: 0,
        totalAmount: 0,
      });
    } else {
      // Validate active products and sync live prices/stock from catalog
      let hasChanges = false;
      const validItems = [];

      for (const item of cart.items) {
        const prod = await Product.findById(item.product);
        if (prod && prod.isActive !== false && String(prod.supermarket) === String(storeId)) {
          // Adjust quantity if stock dropped below cart quantity
          if (prod.stock < item.quantity) {
            item.quantity = Math.max(0, prod.stock);
            hasChanges = true;
          }

          if (item.quantity > 0) {
            const rawPrice = Number(prod.price || 0);
            const rawCost = Number(prod.costPrice || 0);
            let mrp = rawPrice;
            let effective = rawPrice;
            if (rawCost > 0 && rawCost !== rawPrice) {
              mrp = Math.max(rawPrice, rawCost);
              effective = Math.min(rawPrice, rawCost);
            }
            item.price = mrp;
            item.effectivePrice = effective;
            item.discount = Math.max(0, mrp - effective);
            item.stock = prod.stock;
            item.subtotal = effective * item.quantity;
            validItems.push(item);
          } else {
            hasChanges = true;
          }
        } else {
          // Product removed or belongs to different store
          hasChanges = true;
        }
      }

      if (hasChanges) {
        cart.items = validItems;
        cart.recalculate();
        await cart.save();
      }
    }

    return res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cart.",
      error: error.message,
    });
  }
};

// POST /api/cart/add - Add product to customer's cart
exports.addToCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId || !storeId) {
      return res.status(401).json({
        success: false,
        message: "Authenticated customer session and registered supermarket required.",
      });
    }

    const { productId, quantity = 1 } = req.body;
    const cleanQty = Math.max(1, parseInt(quantity, 10) || 1);

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required.",
      });
    }

    // Verify product in database
    const product = await Product.findById(productId);
    if (!product || product.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable.",
      });
    }

    // Strict Multi-Tenant Supermarket Isolation:
    // Customer can ONLY add products belonging to their registered supermarket!
    if (String(product.supermarket) !== String(storeId)) {
      return res.status(403).json({
        success: false,
        message: "This product belongs to another supermarket. You can only shop from your registered supermarket.",
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: `"${product.name}" is currently out of stock.`,
      });
    }

    let cart = await Cart.findOne({ customer: customerId, supermarket: storeId });
    if (!cart) {
      cart = new Cart({
        customer: customerId,
        supermarket: storeId,
        items: [],
      });
    }

    const rawPrice = Number(product.price || 0);
    const rawCost = Number(product.costPrice || 0);
    let mrp = rawPrice;
    let effective = rawPrice;
    if (rawCost > 0 && rawCost !== rawPrice) {
      mrp = Math.max(rawPrice, rawCost);
      effective = Math.min(rawPrice, rawCost);
    }
    const discount = Math.max(0, mrp - effective);

    const existingIndex = cart.items.findIndex(
      (item) => String(item.product) === String(product._id)
    );

    if (existingIndex >= 0) {
      const existing = cart.items[existingIndex];
      const newQty = existing.quantity + cleanQty;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Only ${product.stock} units available in stock.`,
        });
      }
      existing.quantity = newQty;
      existing.price = mrp;
      existing.effectivePrice = effective;
      existing.discount = discount;
      existing.stock = product.stock;
      existing.subtotal = effective * newQty;
    } else {
      if (cleanQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${cleanQty} units. Only ${product.stock} units available in stock.`,
        });
      }
      cart.items.push({
        product: product._id,
        name: product.name,
        brand: product.brand || "",
        category: product.category || "General",
        barcode: product.barcode || "",
        imageUrl: product.imageUrl || "",
        price: mrp,
        discount,
        effectivePrice: effective,
        quantity: cleanQty,
        stock: product.stock,
        subtotal: effective * cleanQty,
      });
    }

    cart.recalculate();
    await cart.save();

    // Record CartActivity for store admin live analytics
    try {
      await CartActivity.create({
        sessionId: req.user?.phone || `cust-${customerId}`,
        productName: product.name,
        productId: product._id,
        quantity: cleanQty,
        price: effective,
        action: "added",
        totalCartItems: cart.totalItems,
        totalCartAmount: cart.totalAmount,
        customerName: req.user?.name || "Customer",
        customerPhone: req.user?.phone || "",
        supermarket: storeId,
        supermarketCode: req.user?.supermarketCode || "",
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: `Added "${product.name}" to cart.`,
      cart,
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart.",
      error: error.message,
    });
  }
};

// PUT /api/cart/update-quantity - Increase / decrease / set quantity
exports.updateQuantity = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId || !storeId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required.",
      });
    }

    const { productId, quantity, delta } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required.",
      });
    }

    const cart = await Cart.findOne({ customer: customerId, supermarket: storeId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    const cleanProdId = String(productId);
    const itemIndex = cart.items.findIndex(
      (it) => String(it.product) === cleanProdId || String(it._id) === cleanProdId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Product not found in your cart.",
      });
    }

    const item = cart.items[itemIndex];
    let newQty = item.quantity;

    if (typeof delta === "number") {
      newQty = item.quantity + delta;
    } else if (typeof quantity === "number") {
      newQty = quantity;
    }

    if (newQty <= 0) {
      // Remove item if quantity falls to 0 or below
      const removedName = item.name;
      cart.items.splice(itemIndex, 1);
      cart.recalculate();
      await cart.save();

      try {
        await CartActivity.create({
          sessionId: req.user?.phone || `cust-${customerId}`,
          productName: removedName,
          productId: item.product,
          quantity: 0,
          price: item.effectivePrice,
          action: "removed",
          totalCartItems: cart.totalItems,
          totalCartAmount: cart.totalAmount,
          customerName: req.user?.name || "Customer",
          customerPhone: req.user?.phone || "",
          supermarket: storeId,
          supermarketCode: req.user?.supermarketCode || "",
        });
      } catch (_) {}

      return res.status(200).json({
        success: true,
        message: `Removed "${removedName}" from cart.`,
        cart,
      });
    }

    // Verify stock from Product collection
    const prod = await Product.findById(item.product);
    if (prod && newQty > prod.stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot increase quantity. Only ${prod.stock} units available in stock.`,
      });
    }

    item.quantity = newQty;
    item.subtotal = item.effectivePrice * newQty;
    if (prod) item.stock = prod.stock;

    cart.recalculate();
    await cart.save();

    try {
      await CartActivity.create({
        sessionId: req.user?.phone || `cust-${customerId}`,
        productName: item.name,
        productId: item.product,
        quantity: newQty,
        price: item.effectivePrice,
        action: "updated",
        totalCartItems: cart.totalItems,
        totalCartAmount: cart.totalAmount,
        customerName: req.user?.name || "Customer",
        customerPhone: req.user?.phone || "",
        supermarket: storeId,
        supermarketCode: req.user?.supermarketCode || "",
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "Cart quantity updated.",
      cart,
    });
  } catch (error) {
    console.error("Update quantity error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update quantity.",
      error: error.message,
    });
  }
};

// DELETE /api/cart/items/:productId - Remove individual item
exports.removeFromCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId || !storeId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required.",
      });
    }

    const { productId } = req.params;
    const cleanProdId = String(productId || req.body?.productId || "").trim();

    const cart = await Cart.findOne({ customer: customerId, supermarket: storeId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found.",
      });
    }

    const initialLen = cart.items.length;
    cart.items = cart.items.filter(
      (it) => String(it.product) !== cleanProdId && String(it._id) !== cleanProdId
    );

    if (cart.items.length === initialLen) {
      return res.status(404).json({
        success: false,
        message: "Item was not found in your cart.",
      });
    }

    cart.recalculate();
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Product removed from cart.",
      cart,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove item from cart.",
      error: error.message,
    });
  }
};

// DELETE /api/cart/clear - Clear all items from cart
exports.clearCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId || !storeId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required.",
      });
    }

    let cart = await Cart.findOne({ customer: customerId, supermarket: storeId });
    if (cart) {
      cart.items = [];
      cart.totalItems = 0;
      cart.grossAmount = 0;
      cart.totalSavings = 0;
      cart.totalAmount = 0;
      await cart.save();
    } else {
      cart = await Cart.create({
        customer: customerId,
        supermarket: storeId,
        items: [],
        totalItems: 0,
        grossAmount: 0,
        totalSavings: 0,
        totalAmount: 0,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
      cart,
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart.",
      error: error.message,
    });
  }
};

// POST /api/cart/sync - Synchronize client items with backend MongoDB cart
exports.syncCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id;
    const storeId = resolveCustomerStoreId(req);

    if (!customerId || !storeId) {
      return res.status(401).json({
        success: false,
        message: "Customer authentication required.",
      });
    }

    const { items = [] } = req.body;
    let cart = await Cart.findOne({ customer: customerId, supermarket: storeId });
    if (!cart) {
      cart = new Cart({
        customer: customerId,
        supermarket: storeId,
        items: [],
      });
    }

    // Merge valid items belonging to customer's registered supermarket
    for (const rawItem of items) {
      const prodId = rawItem.productId || rawItem._id || rawItem.product;
      if (!prodId) continue;

      const product = await Product.findById(prodId);
      if (!product || product.isActive === false || String(product.supermarket) !== String(storeId)) {
        continue;
      }

      const cleanQty = Math.max(1, parseInt(rawItem.quantity, 10) || 1);
      const effectiveQty = Math.min(cleanQty, product.stock);
      if (effectiveQty <= 0) continue;

      const rawPrice = Number(product.price || 0);
      const rawCost = Number(product.costPrice || 0);
      let mrp = rawPrice;
      let effective = rawPrice;
      if (rawCost > 0 && rawCost !== rawPrice) {
        mrp = Math.max(rawPrice, rawCost);
        effective = Math.min(rawPrice, rawCost);
      }
      const discount = Math.max(0, mrp - effective);

      const existingIndex = cart.items.findIndex(
        (it) => String(it.product) === String(product._id)
      );

      if (existingIndex >= 0) {
        cart.items[existingIndex].quantity = effectiveQty;
        cart.items[existingIndex].subtotal = effective * effectiveQty;
        cart.items[existingIndex].price = mrp;
        cart.items[existingIndex].effectivePrice = effective;
        cart.items[existingIndex].discount = discount;
        cart.items[existingIndex].stock = product.stock;
      } else {
        cart.items.push({
          product: product._id,
          name: product.name,
          brand: product.brand || "",
          category: product.category || "General",
          barcode: product.barcode || "",
          imageUrl: product.imageUrl || "",
          price: mrp,
          discount,
          effectivePrice: effective,
          quantity: effectiveQty,
          stock: product.stock,
          subtotal: effective * effectiveQty,
        });
      }
    }

    cart.recalculate();
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Cart synchronized successfully.",
      cart,
    });
  } catch (error) {
    console.error("Sync cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to synchronize cart.",
      error: error.message,
    });
  }
};

