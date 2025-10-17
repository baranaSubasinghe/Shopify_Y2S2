const express = require("express");
const router = express.Router();
const { payhereIPN } = require("../../controllers/shop/payhere-controller");
const { listPaymentsCollection } = require("../../controllers/admin/payment-controller");

// PayHere posts x-www-form-urlencoded by default; ensure global body parser supports it.
router.post("/payhere/ipn", payhereIPN);
router.get("/payments-collection", listPaymentsCollection);

module.exports = router;


