// backend/routes/admin/payment-routes.js
const express = require("express");
const router = express.Router();

const ctrl = require("../../controllers/admin/payment-controller");
const {
  // existing handlers (keep)
  getAllPayments,
  exportPaymentsPDF,
  findOrderByPaymentId,
  updatePaymentStatus,   
  deletePayment, 
  markCodCollected,
  markOrderPending,
  markOrderFailed,
  markOrderPaid,    
  listPaymentOrders,

  getPaymentSummary,

} = require("../../controllers/admin/payment-controller");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");

/* ---------- Existing: List + search + export ---------- */
router.get("/", getAllPayments);
router.get("/export/pdf", exportPaymentsPDF);
router.get("/find", findOrderByPaymentId); // ?paymentId=PH123...

/* ---------- Existing: Mutations ---------- */
// router.patch("/:id", updatePaymentStatus);
router.put("/update-status", updatePaymentStatus); // body: { paymentStatus, [orderStatus], [paymentId] }
router.delete("/:id", deletePayment);

/* ---------- Added: Orders-focused payment views ---------- */
// GET /api/admin/payments/orders?status=PENDING&method=payhere&q=abc&page=1&limit=20&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/orders", listPaymentOrders);

// PATCH /api/admin/payments/orders/:id/mark-paid
// router.patch("/orders/:id/mark-paid", markOrderPaid);

// GET /api/admin/payments/summary
router.get("/summary", getPaymentSummary);

router.patch(
  "/orders/:id/cod-collected",
  authMiddleware,
  adminOnly,
  ctrl.markCODCollected
);

router.patch("/orders/:id/mark-paid",    authMiddleware, adminOnly, markOrderPaid);
router.patch("/orders/:id/mark-pending", authMiddleware, adminOnly, markOrderPending);
router.patch("/orders/:id/mark-failed",  authMiddleware, adminOnly, markOrderFailed);
module.exports = router;
