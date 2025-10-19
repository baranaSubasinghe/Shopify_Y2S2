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
async function markCODCollected(req, res, next) {
  try {
    const role = toL(req.user?.role);
    if (role !== "delivery" && role !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // (optional) ensure this order is assigned to the delivery user
    // uncomment if you track assignment on order.assignedTo
    // if (role === "delivery" && String(order.assignedTo) !== String(req.user._id)) {
    //   return res.status(403).json({ success: false, message: "Not your order" });
    // }

    if (toL(order.paymentMethod) !== "cod") {
      return res.status(400).json({ success: false, message: "Not a COD order" });
    }

    if (toU(order.paymentStatus) === "PAID") {
      // already marked; return ok
      return res.json({ success: true, item: { _id: order._id, paymentStatus: "PAID" } });
    }

    // mark paid
    order.paymentStatus = "PAID";
    order.orderUpdateDate = new Date();
    await order.save();

    // keep Payment collection in sync
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: "PAID",
          amount: Number(order.totalAmount || 0),
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ success: true, item: { _id: order._id, paymentStatus: "PAID" } });
  } catch (err) {
    console.error("markCODCollected (delivery) error:", err);
    next(err);
  }
}

// ---- export (append to whatever you already export)
module.exports = {
  // ...other exports
  markCODCollected,
};