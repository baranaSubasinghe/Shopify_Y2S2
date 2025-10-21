// backend/routes/shop/order-routes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../../controllers/shop/order-controller");
const {
  createOrder,
  capturePayment,       // not used by PayHere
  getAllOrdersByUser,
  getOrderDetails,
  handlePayHereNotify,
  downloadInvoicePDF,
  createOrderCOD,

  getMyOrders
} = require("../../controllers/shop/order-controller");

const { authMiddleware } = require("../../controllers/auth/auth-controller");


router.get(["/my", "/my-orders"], authMiddleware, getMyOrders);// Create
router.post("/create", authMiddleware, createOrder);

// (compat) capture-payment endpoint (not used by PayHere)
router.post("/capture", authMiddleware, capturePayment);

// Invoices — single canonical path
router.get("/:id/invoice", authMiddleware, downloadInvoicePDF);

// Lists / details
router.get("/user/:userId", authMiddleware, getAllOrdersByUser);
router.get("/:id", authMiddleware, getOrderDetails);

// PayHere IPN (public). Only keep this if your notify_url points here.
// If you're using /api/shop/payment/payhere/ipn instead, REMOVE this route.
router.post("/notify", handlePayHereNotify);

/* ---------- Optional: backward-compat redirects ---------- */
// If you already shipped these weird paths and want them to keep working,
// uncomment these tiny redirects. Otherwise, leave them out to avoid confusion.

// router.get("/invoice/:id.pdf", authMiddleware, (req, res) =>
//   res.redirect(301, `/api/shop/order/${req.params.id}/invoice`)
// );
// router.get("/order/:id/invoice", authMiddleware, (req, res) =>
//   res.redirect(301, `/api/shop/order/${req.params.id}/invoice`)
// );
// router.get("/orders/:id/invoice", authMiddleware, (req, res) =>
//   res.redirect(301, `/api/shop/order/${req.params.id}/invoice`)
// );
router.post("/create-cod", authMiddleware, createOrderCOD);

module.exports = router;