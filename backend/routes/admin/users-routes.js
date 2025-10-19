// backend/routes/admin/users-routes.js
const router = require("express").Router();
const ctrl = require("../../controllers/admin/users-controller");

const {
  authMiddleware,
  adminOnly,
} = require("../../controllers/auth/auth-controller");

// All admin-user endpoints require authenticated admin
router.get("/",         authMiddleware, adminOnly, ctrl.getAllUsers);
router.get("/stats", authMiddleware, adminOnly, ctrl.getUserStats); 
router.delete("/:id",   authMiddleware, adminOnly, ctrl.deleteUserById);
router.get("/summary", authMiddleware, adminOnly, ctrl.getUsersSummary);
router.patch("/:id/role", authMiddleware, adminOnly, ctrl.updateUserRole);
router.get("/delivery/active", authMiddleware, adminOnly, ctrl.getActiveDeliveryStaff);

module.exports = router;