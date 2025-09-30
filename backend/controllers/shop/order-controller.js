
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const {
  isSandbox,
  toAmountTwoDecimals,
  generateCheckoutHash,
  verifyIPNSignature,
} = require("../../helpers/payhere");

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

    if (!process.env.PAYHERE_MERCHANT_ID || !process.env.PAYHERE_MERCHANT_SECRET) {
      console.error("PayHere env missing");
      return res.status(500).json({ success: false, message: "PayHere not configured" });
    }

    if (!totalAmount || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total amount" });
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
      merchant_id: process.env.PAYHERE_MERCHANT_ID,
       return_url: `${process.env.APP_BASE_URL}/payhere-return?orderId=${orderId}`,
      cancel_url: `${process.env.APP_BASE_URL}/payhere-cancel?orderId=${orderId}`,
      notify_url: `${process.env.API_BASE_URL}/api/shop/order/notify`,
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
        merchantId: process.env.PAYHERE_MERCHANT_ID,
        orderId,
        amount: amountStr,
        currency,
        merchantSecret: process.env.PAYHERE_MERCHANT_SECRET,
      });
       // If your SDK variant expects this key:
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
            origin_hint: process.env.APP_BASE_URL, // must match a validated domain host
          });

    } catch (err) {
      console.error("Error generating PayHere hash:", err);
      return res.status(500).json({ success: false, message: "Payment signature error" });
    }

      return res.status(200).json({ success: true, payment, orderId });
  } catch (e) {
    console.error("createOrder error:", e);
    return res.status(500).json({ success: false, message: "Some error occured!" });
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
      status_code,       // 2 = success
      md5sig,
      method,            // e.g., "VISA"
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

    if (String(status_code) === "2") {
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = payment_id || ""; // store PayHere ref
    } else if (String(status_code) === "0") {
      // pending
      order.paymentStatus = "pending";
    } else {
      order.paymentStatus = "failed";
      order.orderStatus = "cancelled";
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
};