const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    image: String,
    title: String,
    description: String,
    category: String,
    brand: String,
    price: { type: Number, required: true, min: 0 },
   salePrice: { type: Number, default: 0, min: 0 },
    totalStock: Number,
    averageReview: Number,
  },
  { timestamps: true }
);
ProductSchema.index({
  title: "text",
  name: "text",
  description: "text",
  category: "text",
});

module.exports = mongoose.model("Product", ProductSchema);
