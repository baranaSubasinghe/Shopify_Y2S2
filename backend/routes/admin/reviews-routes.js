// backend/routes/admin/reviews-routes.js
const router = require("express").Router();
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");
const { getAllReviews, deleteReview } =
  require("../../controllers/admin/review-controller");


router.get("/", authMiddleware, adminOnly, getAllReviews);
router.delete("/:id", authMiddleware, adminOnly, deleteReview);

module.exports = router;
