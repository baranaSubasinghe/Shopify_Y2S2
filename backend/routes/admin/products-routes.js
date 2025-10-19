const express = require("express");

const {
  handleImageUpload,
  addProduct,
  editProduct,
  fetchAllProducts,
  deleteProduct,
} = require("../../controllers/admin/products-controller.js");
const ctrl = require("../../controllers/admin/products-controller");
const { upload } = require("../../helpers/cloudinary");
const { authMiddleware, adminOnly } = require("../../controllers/auth/auth-controller.js");

const router = express.Router();

router.post("/upload-image", upload.single("my_file"), handleImageUpload);
router.post("/add", addProduct);
router.put("/edit/:id", editProduct);
router.delete("/delete/:id", deleteProduct);
router.get("/get", fetchAllProducts);
// backend/routes/admin/products-routes.js
router.get("/top-selling", authMiddleware, adminOnly, ctrl.getTopSellingProducts);

module.exports = router;
