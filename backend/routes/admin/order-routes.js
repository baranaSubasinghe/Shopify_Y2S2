const express = require("express");
const mongoose = require("mongoose");
const {
  getAllOrdersOfAllUsers,
  getOrderDetailsForAdmin,
  updateOrderStatus,
} = require("../../controllers/admin/order-controller");

const requireRole = require("../../middleware/require-role");
const { authMiddleware } = require("../../controllers/auth/auth-controller");
const Order = require("../../models/Order");
const User = require("../../models/User");
const { sendMail } = require("../../utils/email"); 

const router = express.Router();

// ✅ GET all orders (unchanged)
router.get("/get", getAllOrdersOfAllUsers);

// ✅ GET one order details (unchanged)
router.get("/details/:id", getOrderDetailsForAdmin);

// ✅ PUT update status (unchanged)
router.put("/update/:id", updateOrderStatus);

// ✅ GET all delivery staff
router.get(
  "/delivery-staff",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const staff = await User.find({ role: "delivery" })
        .select("_id userName email")
        .lean();
      res.json({ success: true, data: staff });
    } catch (e) {
      console.error("[admin][delivery-staff] error:", e);
      res
        .status(500)
        .json({ success: false, message: "Server error while loading staff" });
    }
  }
);
router.post(
  "/assign",
  authMiddleware,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { orderId, userId } = req.body || {};

      if (!orderId || !userId) {
        return res.status(400).json({ success: false, message: "orderId and userId are required" });
      }
      if (!mongoose.isValidObjectId(orderId) || !mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ success: false, message: "Invalid orderId or userId" });
      }

      // ensure the target is a delivery user
      const staff = await User.findOne({ _id: userId, role: "delivery" })
        .select("_id userName email")
        .lean();
      if (!staff) {
        return res.status(404).json({ success: false, message: "Delivery staff not found" });
      }

      // 🔒 save assignedTo as ObjectId + mark ASSIGNED
      const updated = await Order.findByIdAndUpdate(
        orderId,
        {
          $set: {
            assignedTo: new mongoose.Types.ObjectId(userId),
            orderStatus: "ASSIGNED",
            orderUpdateDate: new Date(),
          },
          $push: {
            statusHistory: { status: "ASSIGNED", at: new Date(), by: req.user._id },
          },
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      // fire-and-forget email (non-blocking)
      (async () => {
        try {
          await sendMail({
            to: staff.email,
            subject: `New delivery assigned: #${String(updated._id).slice(-6)}`,
            html: `
              <p>Hi ${staff.userName || "Delivery Staff"},</p>
              <p>A new order has been assigned to you.</p>
              <p><b>Order:</b> ${updated._id}</p>
              <p><b>Status:</b> ${updated.orderStatus}</p>
              <p><a href="${process.env.APP_BASE_URL || "http://localhost:5173"}/auth/login?next=%2Fdelivery%2Fdashboard">
                Open Delivery Dashboard
              </a></p>
            `,
          });
        } catch (err) {
          console.warn("[assign] email failed:", err?.message);
        }
      })();

      return res.json({ success: true, message: "Assigned successfully", data: updated });
    } catch (e) {
      console.error("[admin][assign] error:", e);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;