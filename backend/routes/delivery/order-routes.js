const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { authMiddleware } = require("../../controllers/auth/auth-controller");
const requireRole = require("../../middleware/require-role");
const Order = require("../../models/Order");

// GET /api/delivery/orders/my
// backend/routes/delivery/orders-routes.js

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

module.exports = router;