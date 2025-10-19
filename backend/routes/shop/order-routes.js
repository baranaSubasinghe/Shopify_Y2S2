const express = require("express");
const router = express.Router();
const {
  createOrder,
  capturePayment,       // not used by PayHere
  getAllOrdersByUser,
  getOrderDetails,
  handlePayHereNotify,
  downloadInvoicePDF,
} = require("../../controllers/shop/order-controller");

const { authMiddleware } = require("../../controllers/auth/auth-controller");

// create
router.post("/create", authMiddleware, createOrder);

// (compat) capture-payment endpoint (not used)
router.post("/capture", authMiddleware, capturePayment);

// lists/details
router.get("/list/:userId", authMiddleware, getAllOrdersByUser);
router.get("/details/:id", authMiddleware, getOrderDetails);

// invoice
router.get("/invoice/:id.pdf", authMiddleware, downloadInvoicePDF);

// PayHere IPN (no auth, called by PayHere servers)
router.post("/notify", handlePayHereNotify);

module.exports = router;