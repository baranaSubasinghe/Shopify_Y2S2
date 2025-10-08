const express = require("express");
const {
  getAllPayments,
  exportPaymentsPDF,
  findOrderByPaymentId,
  updatePaymentStatus,   // ✅ NEW
  deletePayment,         // ✅ NEW
} = require("../../controllers/admin/payment-controller");

const router = express.Router();

// List + search + export
router.get("/", getAllPayments);
router.get("/export/pdf", exportPaymentsPDF);
router.get("/find", findOrderByPaymentId); // ?paymentId=PH123...

// Mutations
router.patch("/:id", updatePaymentStatus); // body: { paymentStatus, [orderStatus], [paymentId] }
router.delete("/:id", deletePayment);

module.exports = router;
