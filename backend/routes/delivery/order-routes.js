const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const { authMiddleware } = require("../../controllers/auth/auth-controller");
const requireRole = require("../../middleware/require-role");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const { notifyUser } = require("../../helpers/notify");

/* ------------ guards ------------ */
function requireDeliveryOrAdmin(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (!["delivery", "admin"].includes(role)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
}

/* ------------ helpers ------------ */
function mapStatus(raw) {
  if (!raw) return "";
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, "_");
  const map = {
    shipped: "SHIPPED",
    ship: "SHIPPED",
    out_for_delivery: "OUT_FOR_DELIVERY",
    "out-for-delivery": "OUT_FOR_DELIVERY",
    outfordelivery: "OUT_FOR_DELIVERY",
    ofd: "OUT_FOR_DELIVERY",
    delivered: "DELIVERED",
    complete: "DELIVERED",
    completed: "DELIVERED",
    pending: "PENDING",
    confirmed: "CONFIRMED",
    processing: "PROCESSING",
    cancelled: "CANCELLED",
    assigned: "ASSIGNED",
  };
  return map[s] || s.toUpperCase();
}

/** Case-insensitive match to the schema enum; returns the **actual** enum value */
function coerceToEnum(value, enumList = []) {
  const want = String(value ?? "").toLowerCase();
  for (const v of enumList) {
    if (String(v).toLowerCase() === want) return v; // return exact casing from schema
  }
  return enumList[0] ?? value; // fallback to first allowed
}

/* =========================================================
   GET /api/delivery/orders/my
   ========================================================= */
router.get("/my", authMiddleware, requireRole("delivery"), async (req, res) => {
  try {
    const raw = req.user?._id ?? req.user?.id;
    if (!raw) return res.status(401).json({ success: false, message: "Not authenticated" });

    const matchValues = [];
    const rawStr = String(raw);
    if (mongoose.isValidObjectId(rawStr)) matchValues.push(new mongoose.Types.ObjectId(rawStr));
    matchValues.push(rawStr);
    matchValues.push(String(req.user?.id || ""));
    matchValues.push(String(req.user?._id || ""));
    const uniq = Array.from(new Set(matchValues.filter(Boolean)));

    const orders = await Order.find({ assignedTo: { $in: uniq } })
      .sort({ orderDate: -1, createdAt: -1 })
      .lean();

    return res.json({ success: true, data: orders });
  } catch (e) {
    console.error("[delivery][my] error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   PATCH /api/delivery/orders/:id/status
   Updates orderStatus (PayHere or COD) + notifies user.
   Also **coerces paymentStatus** to the schema enum to
   avoid the “PAID not in enum” crash.
   ========================================================= */
router.patch("/:id/status", authMiddleware, requireDeliveryOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }

    const raw = (req.body?.orderStatus ?? req.body?.status ?? "").toString().trim();
    if (!raw) return res.status(400).json({ success: false, message: "Missing status" });

    const candidate = mapStatus(raw);

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // permission: admin can always; delivery only if assigned
    const role = String(req.user?.role || "").toLowerCase();
    const me = String(req.user?._id ?? req.user?.id ?? "");
    const isAssignedToMe = me && String(order.assignedTo || "") === me;
    if (!(role === "admin" || isAssignedToMe)) {
      return res.status(403).json({ success: false, message: "Not your order" });
    }

    // enum-safe set for orderStatus
    const orderStatusEnum = Order.schema.path("orderStatus")?.options?.enum || [];
    order.orderStatus = coerceToEnum(candidate, orderStatusEnum);

    // 🔑 the fix: coerce existing paymentStatus to the schema’s enum
    const paymentEnum = Order.schema.path("paymentStatus")?.options?.enum || [];
    if (paymentEnum.length) {
      order.paymentStatus = coerceToEnum(order.paymentStatus, paymentEnum);
    }

    order.orderUpdateDate = new Date();
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: order.orderStatus, at: new Date(), by: req.user?._id || req.user?.id });

    await order.save();

    // notify customer
    const ref = order.orderNumber || String(order._id).slice(-6).toUpperCase();
    await notifyUser(
      order.userId,
      "ORDER",
      `Order ${ref} ${String(order.orderStatus).replace(/_/g, " ").toLowerCase()}`,
      `Your order status is now ${order.orderStatus}.`,
      { orderId: order._id, by: role, orderStatus: order.orderStatus }
    );

    return res.json({ success: true, data: { _id: order._id, orderStatus: order.orderStatus } });
  } catch (e) {
    console.error("[delivery][status] error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* =========================================================
   PATCH /api/delivery/orders/:id/cod-collected
   COD → mark PAID, set valid orderStatus, upsert Payment, notify
   (also coerces enums to actual schema-cased values)
   ========================================================= */
router.patch("/:id/cod-collected", authMiddleware, requireDeliveryOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid order id" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (String(order.paymentMethod || "").toLowerCase() !== "cod") {
      return res.status(400).json({ success: false, message: "Not a COD order" });
    }

    const ordPayEnum  = Order.schema.path("paymentStatus")?.options?.enum || [];
    const payPayEnum  = Payment.schema.path("paymentStatus")?.options?.enum || [];
    const ordStatEnum = Order.schema.path("orderStatus")?.options?.enum || [];

    // prefer DELIVERED -> CONFIRMED -> first
    const prefer = ["DELIVERED", "CONFIRMED"];
    let target = prefer.find(p => ordStatEnum.map(x => String(x).toUpperCase()).includes(p)) || ordStatEnum?.[0] || "CONFIRMED";

    order.paymentStatus   = coerceToEnum("PAID", ordPayEnum);
    order.orderStatus     = coerceToEnum(target, ordStatEnum);
    order.codCollectedAt  = new Date();
    order.codCollectedBy  = req.user?._id || req.user?.id;
    order.orderUpdateDate = new Date();

    await order.save();

    const payDoc = await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: coerceToEnum("PAID", payPayEnum),
          amount: Number(order.totalAmount || 0),
          currency: "LKR",
          providerPaymentId: order.paymentId || `COD-${order._id}`,
          payerId: String(req.user?._id || req.user?.id || ""),
          message: "COD collected by delivery",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const ref = order.orderNumber || String(order._id).slice(-6).toUpperCase();
    await notifyUser(
      order.userId,
      "ORDER",
      `Order ${ref} ${order.orderStatus === "DELIVERED" ? "delivered" : "updated"}`,
      `Payment received (COD). Total ${order.totalAmount} LKR.`,
      { orderId: order._id, method: "COD", via: "delivery", orderStatus: order.orderStatus, paymentId: payDoc?._id }
    );

    return res.json({
      success: true,
      message: "COD collected. Payment marked PAID.",
      data: {
        _id: order._id,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      },
    });
  } catch (err) {
    console.error("cod-collected error:", err);
    return res.status(500).json({ success: false, message: "Failed to mark COD collected" });
  }
});

module.exports = router;