const express = require("express");
const router = express.Router();
const { aiRecommend } = require("../../controllers/common/ai-controller");

// ✅ match frontend path
router.post("/ai-recommend", aiRecommend);

module.exports = router;