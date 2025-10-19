// backend/routes/admin/notifications-routes.js
const router = require("express").Router();
const ctrl = require("../../controllers/admin/notifications-controller");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");

router.get("/", authMiddleware, adminOnly, ctrl.list);
router.post("/mark-all-read", authMiddleware, adminOnly, ctrl.markAllRead);
router.patch("/:id/mark-read", authMiddleware, adminOnly, ctrl.markRead);
router.delete("/:id", authMiddleware, adminOnly, ctrl.remove);

module.exports = router;