const { imageUploadUtil } = require("../../helpers/cloudinary");
const Product = require("../../models/Product");

// ---------- helpers ----------
const toNumber = (v, d = 0) => {
  if (v === "" || v === null || typeof v === "undefined") return d;
  const n = Number(v);
  return Number.isNaN(n) ? d : n;
};


const clampNonNegative = (n) => (n < 0 ? 0 : n);

const validateNonNegative = (obj) => {
  const issues = [];
  if (obj.price < 0) issues.push("price must be ≥ 0");
  if (obj.salePrice < 0) issues.push("salePrice must be ≥ 0");
  if (obj.totalStock < 0) issues.push("totalStock must be ≥ 0");
  if (obj.salePrice > obj.price)
    issues.push("salePrice cannot be greater than price");
  return issues;
};

// ---------- image upload ----------
const handleImageUpload = async (req, res) => {
  try {
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const url = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await imageUploadUtil(url);

    res.json({ success: true, result });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// ---------- add a new product ----------
const addProduct = async (req, res) => {
  try {
    const {
      image,
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
      averageReview,
    } = req.body;

    // coerce & sanitize numbers
    const _price = clampNonNegative(toNumber(price, 0));
    const _salePrice = clampNonNegative(toNumber(salePrice, 0));
    const _totalStock = clampNonNegative(Math.trunc(toNumber(totalStock, 0)));
    const _avgReview = toNumber(averageReview, 0);

    // business validation
    const issues = validateNonNegative({
      price: _price,
      salePrice: _salePrice,
      totalStock: _totalStock,
    });
    if (!title || !category || !brand) issues.push("title, category and brand are required");
    if (issues.length) {
      return res.status(400).json({ success: false, message: issues.join(", ") });
    }

    const newlyCreatedProduct = new Product({
      image,
      title,
      description,
      category,
      brand,
      price: _price,
      salePrice: _salePrice,
      totalStock: _totalStock,
      averageReview: _avgReview,
    });

    await newlyCreatedProduct.save();
    res.status(201).json({ success: true, data: newlyCreatedProduct });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// ---------- fetch all products ----------
const fetchAllProducts = async (req, res) => {
  try {
    const listOfProducts = await Product.find({});
    res.status(200).json({ success: true, data: listOfProducts });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// ---------- edit a product ----------
const editProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      image,
      title,
      description,
      category,
      brand,
      price,
      salePrice,
      totalStock,
      averageReview,
    } = req.body;

    let findProduct = await Product.findById(id);
    if (!findProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // compute next values (only sanitize if provided)
    const next = { ...findProduct._doc };

    if (typeof title !== "undefined") next.title = title || findProduct.title;
    if (typeof description !== "undefined") next.description = description || findProduct.description;
    if (typeof category !== "undefined") next.category = category || findProduct.category;
    if (typeof brand !== "undefined") next.brand = brand || findProduct.brand;
    if (typeof image !== "undefined") next.image = image || findProduct.image;

    if (typeof price !== "undefined") next.price = clampNonNegative(toNumber(price, findProduct.price));
    if (typeof salePrice !== "undefined")
      next.salePrice = clampNonNegative(toNumber(salePrice, findProduct.salePrice));
    if (typeof totalStock !== "undefined")
      next.totalStock = clampNonNegative(Math.trunc(toNumber(totalStock, findProduct.totalStock)));
    if (typeof averageReview !== "undefined")
      next.averageReview = toNumber(averageReview, findProduct.averageReview);

    // business validation
    const issues = validateNonNegative({
      price: next.price,
      salePrice: next.salePrice,
      totalStock: next.totalStock,
    });
    if (issues.length) {
      return res.status(400).json({ success: false, message: issues.join(", ") });
    }

    // assign and save
    findProduct.title = next.title;
    findProduct.description = next.description;
    findProduct.category = next.category;
    findProduct.brand = next.brand;
    findProduct.price = next.price;
    findProduct.salePrice = next.salePrice;
    findProduct.totalStock = next.totalStock;
    findProduct.image = next.image;
    findProduct.averageReview = next.averageReview;

    await findProduct.save();
    res.status(200).json({ success: true, data: findProduct });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

// ---------- delete a product ----------
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Error occurred" });
  }
};

module.exports = {
  handleImageUpload,
  addProduct,
  fetchAllProducts,
  editProduct,
  deleteProduct,
};
