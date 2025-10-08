const express = require("express");

const {
  createOrder,
  getAllOrdersByUser,
  getOrderDetails,
  capturePayment,
  handlePayHereNotify,
  downloadInvoicePDF, // ✅ NEW: invoice generator
} = require("../../controllers/shop/order-controller");

const router = express.Router();

router.post("/create", createOrder);
router.post("/capture", capturePayment);

// PayHere IPN posts x-www-form-urlencoded
router.post("/notify", express.urlencoded({ extended: false }), handlePayHereNotify);

router.get("/list/:userId", getAllOrdersByUser);
router.get("/details/:id", getOrderDetails);

// ✅ NEW: Download invoice PDF for a given order
router.get("/invoice/:id", downloadInvoicePDF);

module.exports = router;
