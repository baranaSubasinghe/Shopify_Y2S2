// backend/controllers/shop/order-controller.js
const mongoose = require("mongoose");
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const PDFDocument = require("pdfkit");
const {
  isSandbox,
  generateCheckoutHash,
  verifyIPNSignature,
} = require("../../helpers/payhere");

// ---- ENV (loaded by server.js: require('dotenv').config())
const merchantId     = process.env.PAYHERE_MERCHANT_ID;
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
const appBaseUrl     = process.env.APP_BASE_URL || "http://localhost:5173";
const apiBaseUrl     = process.env.API_BASE_URL || "http://localhost:5001";

// small helper (kept if you need it elsewhere)
function toObjectId(v) {
  if (!v) return v;
  if (v instanceof mongoose.Types.ObjectId) return v;
  if (mongoose.isValidObjectId(v)) return new mongoose.Types.ObjectId(v);
  return v;
}

/* -------------------------------------------------------
 * helpers: enum-safe normalization against model schemas
 * ------------------------------------------------------- */
function normalizeToEnum(raw, allowed) {
  const s = String(raw ?? "").trim();
  if (!Array.isArray(allowed) || allowed.length === 0) return s;
  const hit = allowed.find((v) => String(v).toLowerCase() === s.toLowerCase());
  return hit ?? allowed[0];
}
function moneyToNumber(v) {
  const cleaned = String(v ?? "").replace(/[^0-9.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/* -------------------------------------------------------
 * Create Order + return PayHere payload
 * ------------------------------------------------------- */
const createOrder = async (req, res) => {
  try {
    console.log("[createOrder] IN:", JSON.stringify(req.body, null, 2));
    console.log("[createOrder] PH cfg:", !!merchantId, !!merchantSecret);
    if (!merchantId || !merchantSecret) {
      return res.status(500).json({ success: false, message: "PayHere not configured" });
    }

    const {
      userId,
      cartItems = [],
      addressInfo = {},
      totalAmount,
      cartId,
      orderStatus,
      paymentMethod,
      paymentStatus,
      orderDate,
      orderUpdateDate,
    } = req.body || {};

    // ---- userId (validate BEFORE using)
    const u = userId ?? req.user?.id ?? req.user?._id;
    if (!u || !mongoose.isValidObjectId(u)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId (not a Mongo ObjectId)",
        debug: { userId: u },
      });
    }
    const userIdObj = new mongoose.Types.ObjectId(u);

    // ---- Address sanity (your UI often lacks firstName)
    if (!addressInfo?.address || !addressInfo?.city) {
      return res.status(400).json({
        success: false,
        message: "Address information incomplete",
        where: "validation.address",
        debug: { got: addressInfo },
      });
    }
    if (!addressInfo.firstName) {
      addressInfo.firstName = req.user?.name || req.user?.firstName || "Customer";
    }

    // ---- Amount: trust client if > 0, else fallback to recompute
    let amountNum = Number(totalAmount);
    if (!(amountNum > 0)) {
      const recomputed = (cartItems || []).reduce((sum, r) => {
        const p = moneyToNumber(r?.price ?? r?.salePrice ?? r?.finalPrice ?? r?.unitPrice ?? r?.amount);
        const q = Number(r?.quantity ?? r?.qty ?? 0);
        if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return sum;
        return sum + p * q;
      }, 0);
      amountNum = Math.round(recomputed * 100) / 100;
      if (!(amountNum > 0)) {
        return res.status(400).json({
          success: false,
          message: `Invalid total amount (server computed ${amountNum})`,
          where: "validation.amount",
        });
      }
    }

    // ---- Read enums from schemas and normalize desired values
    const orderStatusEnum          = Order.schema.path("orderStatus")?.options?.enum || [];
    const orderPaymentStatusEnum   = Order.schema.path("paymentStatus")?.options?.enum || [];
    const paymentStatusEnumPayment = Payment.schema.path("paymentStatus")?.options?.enum || [];

    // Logical defaults (what we "mean")
    const desiredOrderStatus   = orderStatus   ?? "PENDING";
    const desiredPaymentStatus = paymentStatus ?? "PENDING";

    // Map to the exact enum values the models accept (handles case)
    const normOrderStatus  = normalizeToEnum(desiredOrderStatus,   orderStatusEnum);
    const normOrderPay     = normalizeToEnum(desiredPaymentStatus, orderPaymentStatusEnum);
    const normPaymentModel = normalizeToEnum(desiredPaymentStatus, paymentStatusEnumPayment);

    console.log("[createOrder] enums", {
      orderStatusEnum,
      orderPaymentStatusEnum,
      paymentStatusEnumPayment,
      chosen: { orderStatus: normOrderStatus, orderPaymentStatus: normOrderPay, paymentModelStatus: normPaymentModel },
    });

    // ---- Create Order
    const order = await Order.create({
      userId: userIdObj,
      cartId: cartId || "",
      cartItems,
      addressInfo,
      orderStatus: normOrderStatus,                // enum-safe for Order
      paymentMethod: (paymentMethod || "payhere").toLowerCase(),
      paymentStatus: normOrderPay,                 // enum-safe for Order
      totalAmount: amountNum,
      orderDate: orderDate || new Date(),
      orderUpdateDate: orderUpdateDate || new Date(),
      paymentId: "",
      payerId: "",
    });

    // ---- Create Payment row (initial)
    await Payment.create({
      orderId: order._id,
      userId: userIdObj,
      provider: "payhere",
      paymentMethod: "payhere",
      paymentStatus: normPaymentModel,             // enum-safe for Payment
      amount: amountNum,
      currency: "LKR",
    });

    // ---- Build PayHere payload
    const orderIdStr = String(order._id);
    const amountStr  = amountNum.toFixed(2);

    const payment = {
      sandbox: isSandbox(),
      merchant_id: merchantId,

      return_url: `${appBaseUrl}/payhere-return?orderId=${orderIdStr}`,
      cancel_url: `${appBaseUrl}/payhere-cancel?orderId=${orderIdStr}`,
      notify_url: `${apiBaseUrl}/api/shop/payment/payhere/ipn`,

      order_id: orderIdStr,
      items: "Cart Purchase",
      amount: amountStr,
      currency: "LKR",

      first_name: addressInfo?.firstName || "Customer",
      last_name:  addressInfo?.lastName  || "",
      email:      addressInfo?.email     || "",
      phone:      addressInfo?.phone     || "",
      address:    addressInfo?.address   || "",
      city:       addressInfo?.city      || "",
      country:    addressInfo?.country   || "Sri Lanka",
    };

    // ---- SIGN hash AFTER payment object is built
    payment.hash = generateCheckoutHash({
      merchantId,
      orderId: orderIdStr,
      amount: amountStr,
      currency: "LKR",
      merchantSecret,
    });
    payment.hash_value = payment.hash; // some SDKs read this key

    console.log("[createOrder] OK →", { orderId: orderIdStr, amount: payment.amount });

    return res.status(200).json({
      success: true,
      message: "Order created successfully",
      payment,
      orderId: orderIdStr,
    });
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({
      success: false,
      message: `Server error in createOrder: ${e?.message || "unknown"}`,
    });
  }
};

/* -------------------------------------------------------
 * PayHere IPN — update Order + Payment (enum-safe)
 * ------------------------------------------------------- */
const handlePayHereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,          // "2" success, "0" pending, otherwise failed
      md5sig,
      method,               // e.g. VISA
      status_message,
      customer_token,
      card_holder_name,
    } = req.body;

    const skipVerify = String(process.env.PAYHERE_ALLOW_UNVERIFIED || "").toLowerCase() === "true";
    if (!skipVerify) {
      const okSig = verifyIPNSignature({
        merchantId: merchant_id,
        orderId: order_id,
        payhereAmount: payhere_amount,
        payhereCurrency: payhere_currency,
        statusCode: status_code,
        receivedMd5sig: md5sig,
        merchantSecret,
      });
      if (!okSig) return res.status(400).send("Invalid signature");
    }

    const order = await Order.findById(order_id);
    if (!order) return res.status(404).send("Order not found");

    // Logical mapping from PayHere → "PENDING/PAID/FAILED"
    let logicalPayment = "PENDING";
    if (String(status_code) === "2")      logicalPayment = "PAID";
    else if (String(status_code) === "0") logicalPayment = "PENDING";
    else                                   logicalPayment = "FAILED";

    // Enum sets from models
    const orderStatusEnum          = Order.schema.path("orderStatus")?.options?.enum || [];
    const orderPaymentStatusEnum   = Order.schema.path("paymentStatus")?.options?.enum || [];
    const paymentStatusEnumPayment = Payment.schema.path("paymentStatus")?.options?.enum || [];

    // Normalize for Order.paymentStatus and Payment.paymentStatus
    const normalizedOrderPaymentStatus = normalizeToEnum(logicalPayment, orderPaymentStatusEnum);
    const normalizedPaymentModelStatus = normalizeToEnum(logicalPayment, paymentStatusEnumPayment);

    // For orderStatus: PAID → CONFIRMED, FAILED → CANCELLED, else keep
    const logicalOrderStatusTarget = logicalPayment === "PAID" ? "CONFIRMED"
                                     : logicalPayment === "FAILED" ? "CANCELLED"
                                     : order.orderStatus;
    const normalizedOrderStatus = normalizeToEnum(logicalOrderStatusTarget, orderStatusEnum);

    // Apply updates to Order
    order.paymentStatus  = normalizedOrderPaymentStatus;
    order.orderStatus    = normalizedOrderStatus;
    order.paymentId      = payment_id || "";
    order.payerId        = customer_token || "";
    order.orderUpdateDate = new Date();
    await order.save();

    // Upsert Payment row
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "payhere",
          paymentMethod: "payhere",
          paymentStatus: normalizedPaymentModelStatus,
          amount: Number(payhere_amount || order.totalAmount || 0),
          currency: payhere_currency || "LKR",
          providerPaymentId: payment_id || "",
          payerId: customer_token || "",
          cardBrand: card_holder_name || method || undefined,
          message: status_message || "",
          ipnAt: new Date(),
          raw: req.body,
        },
      },
      { upsert: true, new: true }
    );

    return res.send("OK");
  } catch (e) {
    console.error("IPN error:", e);
    return res.status(500).send("ERROR");
  }
};

/* -------------------------------------------------------
 * Read helpers
 * ------------------------------------------------------- */
const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    return res.status(200).json({ success: true, data: order });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Error" });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ orderDate: -1 });
    return res.status(200).json({ success: true, data: orders });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Error" });
  }
};

/* -------------------------------------------------------
 * Invoice PDF (minimal)
 * ------------------------------------------------------- */
const downloadInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    doc.pipe(res);

    doc.fontSize(20).text("Invoice / Payment Receipt", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Order ID: ${orderId}`);
    doc.text(`Payment ID: ${order.paymentId || "-"}`);
    doc.text(`Status: ${order.paymentStatus || "-"}`);
    doc.text(`Method: ${order.paymentMethod || "-"}`);
    doc.text(`Date: ${new Date(order.orderDate || Date.now()).toLocaleString()}`);
    doc.moveDown(1);
    doc.fontSize(12).text(`Grand Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`, { align: "right" });
    doc.end();
  } catch (e) {
    return res.status(500).json({ success: false, message: "Failed to generate invoice" });
  }
};

/* Not used by PayHere (kept for compatibility) */
const capturePayment = async (_req, res) =>
  res.status(400).json({ success: false, message: "Not applicable for PayHere" });

module.exports = {
  createOrder,
  capturePayment,
  getAllOrdersByUser,
  getOrderDetails,
  handlePayHereNotify,
  downloadInvoicePDF,
};