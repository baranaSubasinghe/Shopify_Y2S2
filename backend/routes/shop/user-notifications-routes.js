// backend/routes/shop/user-notifications-routes.js
const router = require("express").Router();
const ctrl = require("../../controllers/shop/user-notifications-controller");
const { authMiddleware } = require("../../controllers/auth/auth-controller");

// Protect everything; we read req.user from the JWT cookie
router.use(authMiddleware);

router.get("/", ctrl.listMy);
router.patch("/:id/read", ctrl.markRead);
router.post("/mark-all-read", ctrl.markAllRead);
router.delete("/:id", ctrl.removeOne);

module.exports = router;