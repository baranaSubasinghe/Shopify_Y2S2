// backend/routes/user/account-routes.js
const router = require("express").Router();
const { authMiddleware } = require("../../controllers/auth/auth-controller");
const ctrl = require("../../controllers/user/account-controller");

router.get("/me", authMiddleware, ctrl.getMe);
router.get("/password/ping", authMiddleware, ctrl.passwordPing);
router.patch("/password", authMiddleware, ctrl.changePassword);
router.delete("/me", authMiddleware, ctrl.deleteMe);

module.exports = router;
