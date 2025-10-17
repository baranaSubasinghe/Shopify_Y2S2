const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true, index: true },

    provider:      { type: String, default: "payhere" },
    paymentMethod: { type: String, default: "payhere" },
    paymentStatus: { type: String, enum: ["PENDING","PAID","FAILED","REFUNDED"], default: "PENDING", index: true },

    amount:   { type: Number, required: true },
    currency: { type: String, default: "LKR" },

    providerPaymentId: { type: String, index: true }, // PayHere payment_id
    payerId:           { type: String },              // payhere customer token if any
    cardBrand:         { type: String },
    message:           { type: String },
    ipnAt:             { type: Date },

    raw: { type: Object }, // store IPN payload for audit
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
