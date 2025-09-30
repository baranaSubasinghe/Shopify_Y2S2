// backend/controllers/admin/review-controller.js
const ProductReview = require("../../models/Review");
const Product = require("../../models/Product");

/**
 * GET /api/admin/reviews
 * Query: search, page, limit
 * Returns { items, total, page, limit }
 */
const getAllReviews = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 50 } = req.query;
    const p = Math.max(1, parseInt(page, 10));
    const l = Math.max(1, Math.min(200, parseInt(limit, 10)));

    // fetch all reviews first
    const filter = {}; // (no direct text index on Review)
    const total = await ProductReview.countDocuments(filter);
    const reviews = await ProductReview.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    // hydrate with product title for search + display
    const productIds = [...new Set(reviews.map(r => r.productId))];
    const productMap = new Map();
    if (productIds.length) {
      const products = await Product.find({ _id: { $in: productIds } })
        .select("_id title")
        .lean();
      products.forEach(pr => productMap.set(String(pr._id), pr.title));
    }

    // attach productTitle and apply search filter (by productTitle or userName)
    let items = reviews.map(r => ({
      ...r,
      productTitle: productMap.get(String(r.productId)) || "(deleted product)",
    }));

    const s = search.trim().toLowerCase();
    if (s) {
      items = items.filter(
        r =>
          r.productTitle.toLowerCase().includes(s) ||
          (r.userName || "").toLowerCase().includes(s)
      );
    }

    res.json({
      success: true,
      data: {
        items,
        total,
        page: p,
        limit: l,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * DELETE /api/admin/reviews/:id
 */
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const removed = await ProductReview.findByIdAndDelete(id);
    if (!removed) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }
    res.json({ success: true, reviewId: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getAllReviews, deleteReview };
