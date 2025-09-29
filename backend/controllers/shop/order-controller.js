
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
const appBaseUrl = process.env.APP_BASE_URL; // frontend
const apiBaseUrl = process.env.API_BASE_URL; // backend public

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
      paymentId,
      payerId,
      cartId,
    } = req.body;

  


    // Persist order first
    const newlyCreatedOrder = await Order.create({
      userId,
      cartId: req.body.cartId || "",
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod: "payhere",
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId: "",     // to be filled after IPN/notify
      payerId: "",       // unused for PayHere
    });

    const orderId = String(newlyCreatedOrder._id);
    const currency = "LKR";
    const amountStr = toAmountTwoDecimals(totalAmount);

    // Prepare PayHere payment object for frontend SDK
    const payment = {
      sandbox: isSandbox(), // PayHere SDK flag
      merchant_id: merchantId,
      return_url: `${appBaseUrl}/payhere/return?orderId=${orderId}`,
      cancel_url: `${appBaseUrl}/payhere/cancel?orderId=${orderId}`,
      notify_url: `${apiBaseUrl}/api/shop/order/notify`,
      order_id: orderId,
      items: "Clothing Order", // or join titles if you like
      amount: amountStr,
      currency,
      // customer fields (PayHere requires)
      first_name: addressInfo?.firstName || "Customer",
      last_name: addressInfo?.lastName || "",
      email: addressInfo?.email || "",
      phone: addressInfo?.phone || "",
      address: addressInfo?.address || "",
      city: addressInfo?.city || "",
      country: addressInfo?.country || "Sri Lanka",
    };

    // Compute secure hash (checkout signature)
    payment.hash = generateCheckoutHash({
      merchantId,
      orderId,
      amount: amountStr,
      currency,
      merchantSecret,
    });

    return res.status(200).json({
      success: true,
      payment,     // <-- frontend will call payhere.startPayment(payment)
      orderId,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
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