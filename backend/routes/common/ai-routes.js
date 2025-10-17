const express = require("express");
const router = express.Router();
const { aiRecommend } = require("../../controllers/common/ai-controller");

router.post("/recommend", aiRecommend);


module.exports = router;