// --- ADD near the top if not already present
const Order   = require("../../models/Order");
const Payment = require("../../models/Payment");

// normalize helper
const toU = (s) => String(s || "").toUpperCase();
const toL = (s) => String(s || "").toLowerCase();

/**
 * PATCH /api/delivery/orders/:id/cod-collected
 * Delivery marks a COD order as collected.
 */
// inside backend/controllers/admin/payment-controller.js
function pickValidOrderStatus(OrderModel, preferredList = ["DELIVERED", "CONFIRMED", "PROCESSING"]) {
  const enumVals = (OrderModel.schema.path("orderStatus")?.options?.enum || [])
    .map(v => String(v).toUpperCase());
  for (const want of preferredList.map(s => String(s).toUpperCase())) {
    if (enumVals.includes(want)) return want;
  }
  return enumVals[0] || null; // last resort: first enum or null (no change)
}

exports.markCODCollected = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = String(req.user?.role || "").toLowerCase();
    if (!["admin", "delivery"].includes(role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const Order   = require("../../models/Order");
    const Payment = require("../../models/Payment");
    const { notifyUser } = require("../../helpers/notify");

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (String(order.paymentMethod || "").toLowerCase() !== "cod") {
      return res.status(400).json({ success: false, message: "Not a COD order" });
    }

    // if already paid: return early with current state
    if (String(order.paymentStatus || "").toUpperCase() === "PAID") {
      return res.json({
        success: true,
        item: { _id: order._id, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus },
      });
    }

    // choose an allowed next order status from your enum
    const nextOrderStatus = pickValidOrderStatus(Order, ["DELIVERED", "CONFIRMED"]);

    // persist with validation ON (so enum mismatches throw)
    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: "PAID",
          ...(nextOrderStatus ? { orderStatus: nextOrderStatus } : {}),
          orderUpdateDate: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    // keep Payment in sync
    await Payment.findOneAndUpdate(
      { orderId: updated._id },
      {
        $set: {
          userId: updated.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: "PAID",
          amount: Number(updated.totalAmount || 0),
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // notify customer
    const ref = updated.orderNumber || String(updated._id).slice(-6).toUpperCase();
    await notifyUser(
      updated.userId,
      "ORDER",
      `Order ${ref} ${nextOrderStatus === "DELIVERED" ? "delivered" : "updated"}`,
      `Payment received (COD). Total ${updated.totalAmount} LKR.`,
      { orderId: updated._id, method: "COD", via: role, orderStatus: updated.orderStatus }
    );

    return res.json({
      success: true,
      item: { _id: updated._id, paymentStatus: updated.paymentStatus, orderStatus: updated.orderStatus },
    });
  } catch (err) {
    console.error("markCODCollected error:", err);
    next(err);
  }
};

// ---- export (append to whatever you already export)
