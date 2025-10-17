// backend/routes/admin/payment-routes.js
const express = require("express");
const router = express.Router();

const {
  // existing handlers (keep)
  getAllPayments,
  exportPaymentsPDF,
  findOrderByPaymentId,
  updatePaymentStatus,   // ✅ NEW (existing in your file)
  deletePayment,         // ✅ NEW (existing in your file)

  // additional handlers (add)
  listPaymentOrders,
  markOrderPaid,
  getPaymentSummary,
} = require("../../controllers/admin/payment-controller");

/* ---------- Existing: List + search + export ---------- */
router.get("/", getAllPayments);
router.get("/export/pdf", exportPaymentsPDF);
router.get("/find", findOrderByPaymentId); // ?paymentId=PH123...

/* ---------- Existing: Mutations ---------- */
router.patch("/:id", updatePaymentStatus); // body: { paymentStatus, [orderStatus], [paymentId] }
router.delete("/:id", deletePayment);

/* ---------- Added: Orders-focused payment views ---------- */
// GET /api/admin/payments/orders?status=PENDING&method=payhere&q=abc&page=1&limit=20&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/orders", listPaymentOrders);

// PATCH /api/admin/payments/orders/:id/mark-paid
router.patch("/orders/:id/mark-paid", markOrderPaid);

// GET /api/admin/payments/summary
router.get("/summary", getPaymentSummary);

module.exports = router;
