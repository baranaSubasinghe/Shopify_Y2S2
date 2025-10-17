const Order   = require("../../models/Order");
const Payment = require("../../models/Payment");
const { verifyIPNSignature } = require("../../helpers/payhere"); // you already have this

// POST /api/shop/payhere/ipn
exports.payhereIPN = async (req, res) => {
  try {
    const body = req.body; // ensure app.use(express.urlencoded({extended:true})) for PayHere

    // 1) verify signature
    const ok = verifyIPNSignature(body);
    if (!ok) return res.status(400).send("INVALID_SIGNATURE");

    const orderId = body.order_id;            // you posted your own order id to PayHere
    const paymentId = body.payment_id || "";  // from PayHere
    const statusCode = Number(body.status_code);

    // 2) map PayHere status → our status
    let paymentStatus = "PENDING";
    if (statusCode === 2) paymentStatus = "PAID";
    else if (statusCode === -1 || statusCode === -2) paymentStatus = "FAILED";

    // 3) update order
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        $set: {
          paymentStatus,
          orderStatus: paymentStatus === "PAID" ? "CONFIRMED" : "PENDING",
          paymentId: paymentId,
          payerId: body.customer_token || "",
          orderUpdateDate: new Date(),
        },
      },
      { new: true }
    );

    if (!order) return res.status(404).send("ORDER_NOT_FOUND");

    // 4) upsert payment entry for this order
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "payhere",
          paymentMethod: "payhere",
          paymentStatus,
          amount: order.totalAmount,
          currency: "LKR",
          providerPaymentId: paymentId,
          payerId: body.customer_token || "",
          cardBrand: body.card_holder_name || undefined,
          message: body.status_message || "",
          ipnAt: new Date(),
          raw: body
        },
      },
      { upsert: true, new: true }
    );

    // 5) ACK to PayHere (must be 200 OK)
    return res.send("OK");
  } catch (err) {
    console.error("PayHere IPN error:", err);
    return res.status(500).send("ERROR");
  }
};
