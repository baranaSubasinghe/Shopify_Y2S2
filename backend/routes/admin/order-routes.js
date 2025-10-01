const express = require("express");
const {
  getAllOrdersOfAllUsers,
  getOrderDetailsForAdmin,
  updateOrderStatus,
} = require("../../controllers/admin/order-controller");

const router = express.Router();

// GET all
router.get("/get", getAllOrdersOfAllUsers);

// GET one
router.get("/details/:id", getOrderDetailsForAdmin);

// PUT update status
router.put("/update/:id", updateOrderStatus);

module.exports = router;
