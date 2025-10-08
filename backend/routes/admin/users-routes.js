// backend/routes/admin/users-routes.js
const router = require("express").Router();

const ctrl = require("../../controllers/admin/users-controller");
const {
  authMiddleware,
  adminOnly,
} = require("../../controllers/auth/auth-controller");

router.get("/", authMiddleware, adminOnly, ctrl.getAllUsers);
router.delete("/:id", authMiddleware, adminOnly, ctrl.deleteUserById);
router.patch("/:id/role", authMiddleware, adminOnly, ctrl.updateUserRole);

module.exports = router;
