const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const {
  isSandbox,
  toAmountTwoDecimals,
  generateCheckoutHash,
  verifyIPNSignature,
} = require("../../helpers/payhere");
const PDFDocument = require("pdfkit");

const merchantId = process.env.PAYHERE_MERCHANT_ID;
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
const appBaseUrl = process.env.APP_BASE_URL;
const apiBaseUrl = process.env.API_BASE_URL;

const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      cartId,
    } = req.body;

    if (!merchantId || !merchantSecret) {
      console.error("PayHere env missing");
      return res
        .status(500)
        .json({ success: false, message: "PayHere not configured" });
    }

    if (!totalAmount || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid total amount" });
    }

    const amountStr = Number(totalAmount).toFixed(2); // "10.00"
    const newlyCreatedOrder = await Order.create({
      userId,
      cartId: cartId || "",
      cartItems,
      addressInfo,
      orderStatus: orderStatus || "PENDING",
      paymentMethod: "payhere",
      paymentStatus: paymentStatus || "PENDING",
      totalAmount: Number(totalAmount),
      orderDate: orderDate || new Date(),
      orderUpdateDate: orderUpdateDate || new Date(),
      paymentId: "", // filled by IPN
      payerId: "",
    });

    const orderId = String(newlyCreatedOrder._id);
    const currency = "LKR";

    const payment = {
      sandbox: isSandbox(),
      merchant_id: merchantId,
      return_url: `${appBaseUrl}/payhere-return?orderId=${orderId}`,
      cancel_url: `${appBaseUrl}/payhere-cancel?orderId=${orderId}`,
      notify_url: `${apiBaseUrl}/api/shop/order/notify`,
      order_id: orderId,
      items: "Cart Purchase",

      amount: amountStr,
      currency,
      first_name: addressInfo?.firstName || "Customer",
      last_name: addressInfo?.lastName || "",
      email: addressInfo?.email || "",
      phone: addressInfo?.phone || "",
      address: addressInfo?.address || "",
      city: addressInfo?.city || "",
      country: addressInfo?.country || "Sri Lanka",
    };

    try {
      payment.hash = generateCheckoutHash({
        merchantId,
        orderId,
        amount: amountStr,
        currency,
        merchantSecret,
      });
      // Some SDK variants expect this key:
      payment.hash_value = payment.hash;

      console.log("PayHere init →", {
        mode: process.env.PAYHERE_MODE,
        merchant_id: payment.merchant_id,
        order_id: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        return_url: payment.return_url,
        cancel_url: payment.cancel_url,
        notify_url: payment.notify_url,
        origin_hint: appBaseUrl, // must match a validated domain host
      });
    } catch (err) {
      console.error("Error generating PayHere hash:", err);
      return res
        .status(500)
        .json({ success: false, message: "Payment signature error" });
    }

    return res.status(200).json({ success: true, payment, orderId });
  } catch (e) {
    console.error("createOrder error:", e);
    return res
      .status(500)
      .json({ success: false, message: "Some error occured!" });
  }
};

// IPN / Notify handler (PayHere -> Your server)
const handlePayHereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code, // 2 = success
      md5sig,
      method, // e.g., "VISA"
      status_message,
    } = req.body;

    const okSig = verifyIPNSignature({
      merchantId: merchant_id,
      orderId: order_id,
      payhereAmount: payhere_amount,
      payhereCurrency: payhere_currency,
      statusCode: status_code,
      receivedMd5sig: md5sig,
      merchantSecret,
    });

    if (!okSig) {
      console.warn("PayHere IPN signature invalid for order:", order_id);
      return res.status(400).send("Invalid signature");
    }

    const order = await Order.findById(order_id);
    if (!order) {
      return res.status(404).send("Order not found");
    }

    // ✅ UPPERCASE statuses for admin UI consistency
    if (String(status_code) === "2") {
      order.paymentStatus = "PAID";
      order.orderStatus = "CONFIRMED";
      order.paymentId = payment_id || ""; // store PayHere ref
    } else if (String(status_code) === "0") {
      order.paymentStatus = "PENDING";
    } else {
      order.paymentStatus = "FAILED";
      order.orderStatus = "CANCELLED";
    }

    await order.save();
    return res.status(200).send("OK");
  } catch (e) {
    console.error(e);
    return res.status(500).send("Server error");
  }
};

// Optional: return URL just for UX; status will be set by IPN
const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ success: false, message: "Error" });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).sort({ orderDate: -1 });
    return res.status(200).json({ success: true, data: orders });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ success: false, message: "Error" });
  }
};

// NEW: Invoice PDF generator
const downloadInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Invoice / Payment Receipt", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#666")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" })
      .fillColor("#000");
    doc.moveDown(1);

    // Meta
    doc.fontSize(12).text(`Order ID: ${orderId}`);
    doc.text(`Payment ID: ${order.paymentId || "-"}`);
    doc.text(`Status: ${order.paymentStatus || "-"}`);
    doc.text(`Method: ${order.paymentMethod || "payhere"}`);
    doc.text(
      `Date: ${new Date(order.orderDate || order.createdAt || Date.now()).toLocaleString()}`
    );
    doc.moveDown(1);

    // Customer
    const ai = order.addressInfo || {};
    doc.fontSize(12).text("Bill To:");
    doc.fontSize(11).text(`${(ai.firstName || "") + " " + (ai.lastName || "")}`.trim() || "Customer");
    if (ai.email) doc.text(`Email: ${ai.email}`);
    if (ai.phone) doc.text(`Phone: ${ai.phone}`);
    if (ai.address) doc.text(ai.address);
    if (ai.city || ai.country) doc.text([ai.city, ai.country].filter(Boolean).join(", "));
    doc.moveDown(1);

    // Items table
    doc.fontSize(12).text("Items:");
    doc.moveDown(0.5);
    const items = Array.isArray(order.cartItems) ? order.cartItems : [];
    if (!items.length) {
      doc.fontSize(11).text("No items recorded.");
    } else {
      const colWidths = [220, 60, 80, 80];
      const startX = doc.x;
      let y = doc.y;

      // header
      ["Title", "Qty", "Unit (LKR)", "Total (LKR)"].forEach((h, i) => {
        const offset = colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fontSize(11).text(h, startX + offset, y, { width: colWidths[i] });
      });
      doc.moveDown(0.6);
      y = doc.y;
      doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
      doc.moveDown(0.2);

      // rows
      items.forEach((it) => {
        const qty = Number(it.quantity || 0);
        const unit = Number(
          (it.price != null ? it.price :
            (it.salePrice > 0 ? it.salePrice : it.price)
          ) || 0
        );
        const row = [
          it.title || it.productId?.title || "-",
          qty,
          unit.toFixed(2),
          (qty * unit).toFixed(2),
        ];
        row.forEach((cell, i) => {
          const offset = colWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.fontSize(10).text(String(cell), startX + offset, doc.y, { width: colWidths[i] });
        });
        doc.moveDown(0.4);
      });
    }

    doc.moveDown(1);
    doc.fontSize(12).text(
      `Grand Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`,
      { align: "right" }
    );

    doc.moveDown(1.5);
    doc.fontSize(10).fillColor("#666")
      .text("Thank you for your purchase!", { align: "center" })
      .fillColor("#000");

    doc.end();
  } catch (e) {
    console.error("invoice pdf error:", e);
    return res.status(500).json({ success: false, message: "Failed to generate invoice" });
  }
};

// Old capturePayment is not used by PayHere, but we’ll keep a stub to avoid frontend breaking if called accidentally
const capturePayment = async (_req, res) => {
  return res.status(400).json({
    success: false,
    message: "Not applicable for PayHere",
  });
};

module.exports = {
  createOrder,
  capturePayment,
  getAllOrdersByUser,
  getOrderDetails,
  handlePayHereNotify,
  downloadInvoicePDF, // ✅ export invoice
};
