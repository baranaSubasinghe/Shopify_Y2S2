const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authMiddleware } = require("../../controllers/auth/auth-controller");
const requireRole = require("../../middleware/require-role");
const Order = require("../../models/Order");
const ctrl = require("../../controllers/delivery/order-controller");
const Payment = require("../../models/Payment");

function requireDelivery(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role !== "delivery" && role !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
}
const deliveryOrAdmin = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();
  if (role === "delivery" || role === "admin") return next();
  return res.status(403).json({ success: false, message: "Forbidden" });
};
// GET /api/delivery/orders/my
router.get(
  "/my",
  authMiddleware,
  requireRole("delivery"),
  async (req, res) => {
    try {
      // accept both id and _id from the auth middleware
      const raw = req.user?._id ?? req.user?.id;
      if (!raw) {
        return res.status(401).json({ success: false, message: "Not authenticated" });
      }

      // Build a tolerant list: ObjectId (when valid) + raw string variants
      const matchValues = [];
      const rawStr = String(raw);
      if (mongoose.isValidObjectId(rawStr)) {
        matchValues.push(new mongoose.Types.ObjectId(rawStr));
      }
      matchValues.push(rawStr);            // legacy string
      matchValues.push(String(req.user?.id || ""));   // in case auth uses `id`
      matchValues.push(String(req.user?._id || ""));  // in case auth uses `_id`

      // Remove empties/duplicates
      const uniq = Array.from(new Set(matchValues.filter(Boolean)));

      const orders = await Order.find({
        assignedTo: { $in: uniq },
      })
        .sort({ orderDate: -1, createdAt: -1 })
        .lean();

      return res.json({ success: true, data: orders });
    } catch (e) {
      console.error("[delivery][my] error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.patch(
  "/:id/status",
  authMiddleware,
  requireRole("delivery"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ success: false, message: "Invalid order id" });
      }

      // accept either field
      const raw = (req.body?.orderStatus ?? req.body?.status ?? "").toString().trim();
      if (!raw) {
        return res.status(400).json({ success: false, message: "Missing status" });
      }

      // normalize -> your enum
      const map = {
        shipped: "SHIPPED",
        out_for_delivery: "OUT_FOR_DELIVERY",
        delivered: "DELIVERED",
        pending: "PENDING",
        confirmed: "CONFIRMED",
        processing: "PROCESSING",
        cancelled: "CANCELLED",
        assigned: "ASSIGNED",
      };
      const normalized = map[raw.toLowerCase()] || raw.toUpperCase();

      const allowed = new Set([
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "ASSIGNED",
      ]);
      if (!allowed.has(normalized)) {
        return res.status(400).json({ success: false, message: `Invalid status: ${raw}` });
      }

      // fetch first, then verify assignment by string compare
      const order = await Order.findById(id).select("_id assignedTo orderStatus").lean();
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const me = String(req.user?._id ?? req.user?.id ?? "");
      if (!me || String(order.assignedTo || "") !== me) {
        return res.status(403).json({ success: false, message: "Not your order" });
      }

      // update
      const updated = await Order.findByIdAndUpdate(
        id,
        {
          $set: { orderStatus: normalized, orderUpdateDate: new Date() },
          $push: { statusHistory: { status: normalized, at: new Date(), by: req.user._id } },
        },
        { new: true, runValidators: true }
      ).lean();

      return res.json({ success: true, data: updated });
    } catch (e) {
      console.error("[delivery][update] error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

function normalizeToEnum(raw, allowed = []) {
  const s = String(raw ?? "").trim();
  if (!Array.isArray(allowed) || allowed.length === 0) return s;
  const hit = allowed.find(v => String(v).toLowerCase() === s.toLowerCase());
  return hit ?? allowed[0]; // fallback to first enum value
}
// PATCH /api/delivery/orders/:id/cod-collected
// Marks COD as PAID and upserts Payment row.
// Auth: delivery OR admin
router.patch("/:id/cod-collected", authMiddleware, deliveryOrAdmin, async (req, res) => {
  const log = (...a) => console.log("[cod-collected]", ...a);
  try {
    const { id } = req.params;
    log("IN", { id, user: { id: req.user?._id, role: req.user?.role } });

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) {
      log("Order not found");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // must be COD
    const method = String(order.paymentMethod || "").toLowerCase();
    if (method !== "cod") {
      log("Not COD", { method: order.paymentMethod });
      return res.status(400).json({ success: false, message: "Not a COD order" });
    }

    // normalize enums against schema to avoid validation errors
    const orderStatusEnum  = Order.schema.path("orderStatus")?.options?.enum || [];
    const payStatusEnumOrd = Order.schema.path("paymentStatus")?.options?.enum || [];
    const payStatusEnumPay = Payment.schema.path("paymentStatus")?.options?.enum || [];

    const nextPayOrd  = normalizeToEnum("PAID",  payStatusEnumOrd);
    const nextPayPay  = normalizeToEnum("PAID",  payStatusEnumPay);

    // for orderStatus: keep DELIVERED if already delivered; otherwise CONFIRMED
    const targetOrderStatus = (String(order.orderStatus || "").toUpperCase() === "DELIVERED")
      ? "DELIVERED"
      : "CONFIRMED";
    const nextOrderStatus = normalizeToEnum(targetOrderStatus, orderStatusEnum);

    order.paymentStatus   = nextPayOrd;
    order.orderStatus     = nextOrderStatus;
    order.codCollectedAt  = new Date();             // ok even if not in schema
    order.codCollectedBy  = req.user?._id;          // ok even if not in schema
    order.orderUpdateDate = new Date();

    log("Saving order", {
      orderId: order._id.toString(),
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
    });
    await order.save();

    const amount = Number(order.totalAmount || 0);

    const payDoc = await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: nextPayPay,
          amount,
          currency: "LKR",
          providerPaymentId: order.paymentId || `COD-${order._id}`,
          payerId: String(req.user?._id || ""),
          message: "COD collected by delivery",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    log("OK", { order: order._id.toString(), payment: payDoc?._id?.toString() });
    return res.json({
      success: true,
      data: { _id: order._id, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus },
    });
  } catch (err) {
    console.error("cod-collected error:", err);
    // expose minimal hint to help you now; remove in prod if you want
    return res.status(500).json({ success: false, message: "Failed to mark COD collected", error: err?.message });
  }
});

module.exports = router;