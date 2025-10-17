const express = require("express");
const router = express.Router();
const { handlePayHereNotify } = require("../../controllers/shop/order-controller");

// PayHere posts x-www-form-urlencoded data
router.post("/payhere/ipn", handlePayHereNotify);

module.exports = router;
