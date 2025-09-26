const express = require("express");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller");
const ctrl = require("../../controllers/common/feature-controller");




const {
  addFeatureImage,
  getFeatureImages,
  
  
} = require("../../controllers/common/feature-controller");

const router = express.Router();



router.post("/add", addFeatureImage);
router.get("/get", getFeatureImages);
router.delete("/:id", authMiddleware, adminOnly, ctrl.deleteFeature);

module.exports = router;
