// backend/models/UserNotification.js
const mongoose = require("mongoose");

const UserNotificationSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type:    { type: String, default: "INFO" },         // e.g. ORDER, PROMO, INFO
    title:   { type: String, required: true },
    message: { type: String, default: "" },
    isRead:  { type: Boolean, default: false },
    meta:    { type: Object, default: {} },             // { orderId, productId, ... }
  },
  { timestamps: true }
);

UserNotificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
module.exports = mongoose.model("UserNotification", UserNotificationSchema);
