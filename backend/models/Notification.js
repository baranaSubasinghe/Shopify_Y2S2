const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },              // e.g. "LOW_STOCK"
    title: { type: String, required: true },
    message: { type: String, default: "" },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    isRead: { type: Boolean, default: false },
    meta: { type: Object, default: {} },
    link: { type: String },                               // optional: deep-link in admin
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", NotificationSchema);