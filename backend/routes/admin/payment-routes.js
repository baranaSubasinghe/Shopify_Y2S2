// backend/routes/admin/payment-routes.js
const router = require("express").Router();
const ctrl = require("../../controllers/admin/payment-controller");
const { authMiddleware } = require("../../controllers/auth/auth-controller");

// --- tiny admin gate (adjust roles if needed)
function requireAdmin(req, res, next) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role !== "admin") {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  next();
}

// protect everything under /api/admin/payments
router.use(authMiddleware, requireAdmin);

// helper: attach route only if controller fn exists
function attach(method, path, fnName) {
  const fn = ctrl && ctrl[fnName];
  if (typeof fn === "function") {
    router[method](path, fn);
  } else {
    console.error(`[admin/payments] Missing controller fn: ${fnName} -> ${method.toUpperCase()} ${path}`);
    router[method](path, (_req, res) =>
      res.status(501).json({ success: false, message: `Not implemented: ${fnName}` })
    );
  }
}

/* ------------------- Routes ------------------- */

// List payments (orders with payment fields)
attach("get", "/", "getAllPayments");

// PDF export
attach("get", "/export/pdf", "exportPaymentsPDF");

// Find order by gateway payment id (?paymentId=PH123)
attach("get", "/find", "findOrderByPaymentId");

// Summary (by status/method)
attach("get", "/summary", "getPaymentSummary");

// Admin list orders with filters/pagination
attach("get", "/orders", "listPaymentOrders");

// Update a payment/order status (generic) expects body { paymentId, status }
attach("patch", "/:id", "updatePaymentStatus");

// Mark specific order statuses
attach("patch", "/orders/:id/mark-paid", "markOrderPaid");
attach("patch", "/orders/:id/mark-pending", "markOrderPending");
attach("patch", "/orders/:id/mark-failed", "markOrderFailed");

// COD collected by admin/delivery
attach("patch", "/orders/:id/cod-collected", "markCODCollected");

// Delete an order & its Payment row
attach("delete", "/:id", "deletePayment");

module.exports = router;