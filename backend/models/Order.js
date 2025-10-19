const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  cartId: String,
  cartItems: [
    {
      productId: String,
      title: String,
      image: String,
      price: Number,
      quantity: Number,
    },
  ],

  addressInfo: {
    addressId: String,
    fullName: String,          // optional but useful
    address: String,
    city: String,
    pincode: String,
    phone: String,
    notes: String,
  },

  // ✅ lower-case enum + default
  orderStatus: {
    type: String,
    enum: [
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "CANCELLED",
      "ASSIGNED", // optional
    ],
    default: "PENDING",
  },

  paymentMethod: {
  type: String,
  enum: ['payhere', 'cod' ],
  default: 'payhere'
},
  paymentStatus: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },

  totalAmount: Number,
  orderDate: { type: Date, default: Date.now },
  orderUpdateDate: { type: Date, default: Date.now },

  paymentId: String,
  payerId: String,

  // delivery assignment (from earlier)
 assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
statusHistory: [
  {
    status: { type: String },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
],
});

module.exports = mongoose.models.Order || mongoose.model("Order", OrderSchema);