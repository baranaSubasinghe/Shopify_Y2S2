// backend/controllers/shop/order-controller.js
const Order = require("../../models/Order");
const Payment = require("../../models/Payment");
const {
  isSandbox,
  generateCheckoutHash,
  verifyIPNSignature,
} = require("../../helpers/payhere");
const PDFDocument = require("pdfkit");
const mongoose = require("mongoose");

const merchantId     = process.env.PAYHERE_MERCHANT_ID;
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
const appBaseUrl     = process.env.APP_BASE_URL;
const apiBaseUrl     = process.env.API_BASE_URL;

/* -------------------------------------------------------
 * Create Order + create PENDING Payment + build PayHere payload
 * ------------------------------------------------------- */
const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      totalAmount,
      cartId,
      orderStatus,
      paymentMethod,
      paymentStatus,
      orderDate,
      orderUpdateDate,
    } = req.body;

    if (!merchantId || !merchantSecret) {
      return res.status(500).json({ success: false, message: "PayHere not configured" });
    }

    const amountNum = Number(totalAmount);
    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount" });
    }

    // 1) Create the order
    const order = await Order.create({
      userId: mongoose.isValidObjectId(userId)
        ? new mongoose.Types.ObjectId(userId)
        : userId,
      cartId: cartId || "",
      cartItems,
      addressInfo,
      orderStatus: orderStatus || "PENDING",
      paymentMethod: paymentMethod || "payhere",
      paymentStatus: paymentStatus || "PENDING",
      totalAmount: amountNum,
      orderDate: orderDate || new Date(),
      orderUpdateDate: orderUpdateDate || new Date(),
      paymentId: "",
      payerId: "",
    });

    // 2) Create a PENDING payment row
    await Payment.create({
      orderId: order._id,
      userId: order.userId,
      provider: "payhere",
      paymentMethod: "payhere",
      paymentStatus: "PENDING",
      amount: amountNum,
      currency: "LKR",
    });

    // 3) Build PayHere payload
    const orderId = String(order._id);
    const amountStr = amountNum.toFixed(2);

    const payment = {
      sandbox: isSandbox(),
      merchant_id: merchantId,
      return_url: `${appBaseUrl}/payhere-return?orderId=${orderId}`,
      cancel_url: `${appBaseUrl}/payhere-cancel?orderId=${orderId}`,
      // IMPORTANT: this must be PUBLICLY reachable by PayHere (use ngrok in dev)
      notify_url: `${apiBaseUrl}/api/shop/payment/payhere/ipn`,
      order_id: orderId,
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

    // Sign the request
    payment.hash = generateCheckoutHash({
      merchantId,
      orderId,
      amount: amountStr,
      currency: "LKR",
      merchantSecret,
    });
    payment.hash_value = payment.hash; // some SDKs expect `hash_value`

    return res.status(200).json({ success: true, payment, orderId });
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({ success: false, message: "Some error occured!" });
  }
};

/* -------------------------------------------------------
 * PayHere IPN — update Order + Payment
 * ------------------------------------------------------- */
const handlePayHereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code, // "2" success
      md5sig,
      method, // e.g. VISA
      status_message,
      customer_token,
      card_holder_name,
    } = req.body;

    // Allow bypass in dev for local/IPN testing:
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

    let paymentStatus = "PENDING";
    if (String(status_code) === "2") paymentStatus = "PAID";
    else if (String(status_code) === "0") paymentStatus = "PENDING";
    else paymentStatus = "FAILED";

    // Update order
    order.paymentStatus = paymentStatus;
    order.orderStatus   = paymentStatus === "PAID" ? "CONFIRMED"
                       : paymentStatus === "FAILED" ? "CANCELLED"
                       : order.orderStatus;
    order.paymentId       = payment_id || "";
    order.payerId         = customer_token || "";
    order.orderUpdateDate = new Date();
    await order.save();

    // Upsert payment
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "payhere",
          paymentMethod: "payhere",
          paymentStatus,
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
  } catch {
    return res.status(500).json({ success: false, message: "Error" });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ orderDate: -1 });
    return res.status(200).json({ success: true, data: orders });
  } catch {
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
