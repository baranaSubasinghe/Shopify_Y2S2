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
const Product = require("../../models/Product");

// ---- ENV
const merchantId     = process.env.PAYHERE_MERCHANT_ID;
const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
const appBaseUrl     = process.env.APP_BASE_URL || "http://localhost:5173";
const apiBaseUrl     = process.env.API_BASE_URL || "http://localhost:5001";

/* -------------------------------------------------------
 * helpers
 * ------------------------------------------------------- */
function normalizeToEnum(raw, allowed) {
  const s = String(raw ?? "").trim();
  if (!Array.isArray(allowed) || allowed.length === 0) return s;
  const hit = allowed.find((v) => String(v).toLowerCase() === s.toLowerCase());
  return hit ?? allowed[0];
}

// read first positive/finite price-like field from a product doc
function pickDbUnitPrice(p) {
  const candidates = [
    p?.salePrice,
    p?.finalPrice,
    p?.price,
    p?.regularPrice,
    p?.listPrice,
    p?.amount,
    p?.unitPrice,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

// safe money format for PDF
function fmt2(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
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
      totalAmount,          // fallback only
      cartId,
      orderStatus,
      paymentMethod,
      paymentStatus,
      orderDate,
      orderUpdateDate,
    } = req.body || {};

    // ---- userId
    const u = userId ?? req.user?.id ?? req.user?._id;
    if (!u || !mongoose.isValidObjectId(u)) {
      return res.status(400).json({
        success: false,
        message: "Invalid userId (not a Mongo ObjectId)",
        debug: { userId: u },
      });
    }
    const userIdObj = new mongoose.Types.ObjectId(u);

    // ---- address (basic)
    if (!addressInfo?.address || !addressInfo?.city) {
      return res.status(400).json({
        success: false,
        message: "Address information incomplete",
        debug: { got: addressInfo },
      });
    }
    if (!addressInfo.firstName) {
      addressInfo.firstName = req.user?.name || req.user?.firstName || "Customer";
    }

    // ---- enums (exactly as your models expect)
    const orderStatusEnum          = Order.schema.path("orderStatus")?.options?.enum || [];
    const orderPaymentStatusEnum   = Order.schema.path("paymentStatus")?.options?.enum || [];
    const paymentStatusEnumPayment = Payment.schema.path("paymentStatus")?.options?.enum || [];

    const desiredOrderStatus   = orderStatus   ?? "PENDING";
    const desiredPaymentStatus = paymentStatus ?? "PENDING";

    const normOrderStatus  = normalizeToEnum(desiredOrderStatus,   orderStatusEnum);
    const normOrderPay     = normalizeToEnum(desiredPaymentStatus, orderPaymentStatusEnum);
    const normPaymentModel = normalizeToEnum(desiredPaymentStatus, paymentStatusEnumPayment);

    // =====================================================
    // FIX: get unit prices from DB if client sent 0
    // =====================================================
    const ids = (cartItems || [])
      .map((it) => String(it?.productId || ""))
      .filter(Boolean);

    const dbProducts = ids.length
      ? await Product.find({ _id: { $in: ids } })
          .select("_id price salePrice finalPrice regularPrice listPrice amount unitPrice")
          .lean()
      : [];

    const priceMap = new Map(
      dbProducts.map((p) => [String(p._id), pickDbUnitPrice(p)])
    );

    const sanitizedCartItems = (cartItems || []).map((it) => {
      const pid       = String(it?.productId || "");
      const clientU   = Number(it?.price || it?.unitPrice || 0);
      const dbU       = priceMap.get(pid) || 0;
      const unit      = clientU > 0 ? clientU : dbU;
      const qty       = Number(it?.quantity || 1);
      const lineTotal = Number.isFinite(unit * qty) ? Math.round(unit * qty * 100) / 100 : 0;

      return {
        ...it,
        price: unit,            // keep same key your UI reads
        unitPrice: unit,
        quantity: qty,
        lineTotal,
      };
    });

    // compute total; fallback to client total if necessary
    let amountNum = sanitizedCartItems.reduce((sum, r) => sum + (r.lineTotal || 0), 0);
    if (!(amountNum > 0)) {
      const clientTotal = Number(totalAmount);
      if (clientTotal > 0) amountNum = clientTotal;
    }
    if (!(amountNum > 0)) {
      return res.status(400).json({
        success: false,
        message: `Invalid total amount (computed ${amountNum})`,
      });
    }
    // =====================================================

    // ---- create order
    const order = await Order.create({
      userId: userIdObj,
      cartId: cartId || "",
      cartItems: sanitizedCartItems,
      orderStatus: normOrderStatus,
      paymentMethod: (paymentMethod || "payhere").toLowerCase(),
      paymentStatus: normOrderPay,
      totalAmount: amountNum,
      orderDate: orderDate || new Date(),
      orderUpdateDate: orderUpdateDate || new Date(),
      paymentId: "",
      payerId: "",
    });

    // ---- create payment
    await Payment.create({
      orderId: order._id,
      userId: userIdObj,
      provider: "payhere",
      paymentMethod: "payhere",
      paymentStatus: normPaymentModel,
      amount: amountNum,
      currency: "LKR",
    });

    // ---- PayHere payload (UNCHANGED)
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

    // signature (UNCHANGED)
    payment.hash = generateCheckoutHash({
      merchantId,
      orderId: orderIdStr,
      amount: amountStr,
      currency: "LKR",
      merchantSecret,
    });
    payment.hash_value = payment.hash;

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
 * PayHere IPN — unchanged logic, enum-safe
 * ------------------------------------------------------- */
const handlePayHereNotify = async (req, res) => {
  try {
    const {
      merchant_id,
      order_id,
      payment_id,
      payhere_amount,
      payhere_currency,
      status_code,          // "2" success, "0" pending, else failed
      md5sig,
      method,
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

    let logicalPayment = "PENDING";
    if (String(status_code) === "2")      logicalPayment = "PAID";
    else if (String(status_code) !== "0") logicalPayment = "FAILED";

    const orderStatusEnum          = Order.schema.path("orderStatus")?.options?.enum || [];
    const orderPaymentStatusEnum   = Order.schema.path("paymentStatus")?.options?.enum || [];
    const paymentStatusEnumPayment = Payment.schema.path("paymentStatus")?.options?.enum || [];

    const normalizedOrderPaymentStatus = normalizeToEnum(logicalPayment, orderPaymentStatusEnum);
    const normalizedPaymentModelStatus = normalizeToEnum(logicalPayment, paymentStatusEnumPayment);

    const logicalOrderStatusTarget =
      logicalPayment === "PAID"   ? "CONFIRMED" :
      logicalPayment === "FAILED" ? "CANCELLED" : order.orderStatus;

    const normalizedOrderStatus = normalizeToEnum(logicalOrderStatusTarget, orderStatusEnum);

    order.paymentStatus   = normalizedOrderPaymentStatus;
    order.orderStatus     = normalizedOrderStatus;
    order.paymentId       = payment_id || "";
    order.payerId         = customer_token || "";
    order.orderUpdateDate = new Date();
    await order.save();

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
 * Invoice PDF (robust number formatting)
 * ------------------------------------------------------- */
const downloadInvoicePDF = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);

    // ✅ define doc inside the function so res exists here
    const doc = new PDFDocument({ margin: 40, size: "A4" });

    // ✅ add safe error handler — now res is in scope
    doc.on("error", (err) => {
      console.error("PDF stream error:", err);
      if (!res.headersSent) {
        res.status(500).end("Error generating PDF");
      }
    });

    doc.pipe(res);

    // --- Header ---
    doc.fontSize(22).fillColor("#111").text("INVOICE", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#555").text(`Invoice ID: ${orderId}`);
    doc.text(`Date: ${new Date(order.orderDate || Date.now()).toLocaleString()}`);
    doc.text(`Status: ${order.paymentStatus || "-"}`);
    doc.text(`Payment Method: ${order.paymentMethod || "-"}`);
    doc.moveDown();

    // --- Bill To ---
    const addr = order.addressInfo || {};
    doc.fontSize(12).fillColor("#000").text("Bill To:", { underline: true });
    doc.text(`${addr.firstName || "Customer"} ${addr.lastName || ""}`);
    if (addr.phone) doc.text(addr.phone);
    if (addr.address) doc.text(addr.address);
    if (addr.city) doc.text(addr.city);
    if (addr.country) doc.text(addr.country);
    doc.moveDown();

    // --- Table ---
    doc.fontSize(12).fillColor("#000").text("Items Purchased:", { underline: true });
    doc.moveDown(0.3);

    const colX = [50, 250, 370, 470];
    let y = doc.y;

    doc.font("Helvetica-Bold");
    doc.text("Item", colX[0], y);
    doc.text("Qty", colX[1], y, { width: 40, align: "right" });
    doc.text("Unit (LKR)", colX[2], y, { width: 70, align: "right" });
    doc.text("Total (LKR)", colX[3], y, { width: 80, align: "right" });

    doc.moveDown(0.5);
    y = doc.y;
    doc.font("Helvetica");

    const items = Array.isArray(order.cartItems) ? order.cartItems : [];

    items.forEach((item) => {
      const qty = Number(item?.quantity);
      const unit = Number(item?.unitPrice ?? item?.price);
      const total = Number(item?.lineTotal ?? qty * unit);

      const qtySafe = Number.isFinite(qty) ? qty : 0;
      const unitSafe = Number.isFinite(unit) ? unit : 0;
      const totalSafe = Number.isFinite(total) ? total : 0;

      doc.text(String(item?.title || "-"), colX[0], y);
      doc.text(String(qtySafe), colX[1], y, { width: 40, align: "right" });
      doc.text(unitSafe.toFixed(2), colX[2], y, { width: 70, align: "right" });
      doc.text(totalSafe.toFixed(2), colX[3], y, { width: 80, align: "right" });

      y += 16; // fixed height
    });

    y += 10;
    doc.moveTo(colX[0], y).lineTo(550, y).strokeColor("#ddd").stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(14);
    doc.text(`Grand Total: Rs. ${Number(order.totalAmount || 0).toFixed(2)}`, 300, y, { width: 250, align: "right" });

    doc.end();
  } catch (e) {
    console.error("PDF error:", e);
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