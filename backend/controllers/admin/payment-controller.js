// backend/controllers/admin/payment-controller.js
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit"); // used by exportPaymentsPDF
const Order   = require("../../models/Order");
const Payment = require("../../models/Payment"); // ✅ sync with this collection

/* ------------------------ helpers ------------------------ */
function toDate(d, endOfDay = false) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  if (endOfDay) dt.setHours(23, 59, 59, 999);
  return dt;
}

function makeFilterFromQuery(qs = {}) {
  const { status, method, q, from, to } = qs;
  const filter = {};
  if (status) filter.paymentStatus = status;
  if (method) filter.paymentMethod = method;

  const fromDate = toDate(from, false);
  const toDateV  = toDate(to, true);
  if (fromDate || toDateV) {
    filter.orderDate = {};
    if (fromDate) filter.orderDate.$gte = fromDate;
    if (toDateV)  filter.orderDate.$lte = toDateV;
  }

  if (q && q.trim()) {
    const like = new RegExp(q.trim(), "i");
    const or = [
      { "addressInfo.fullName": like },
      { "addressInfo.phone": like },
      { "addressInfo.city": like },
    ];
    if (mongoose.Types.ObjectId.isValid(q)) {
      const oid = new mongoose.Types.ObjectId(q);
      or.push({ _id: oid }, { userId: oid });
    }
    filter.$or = or;
  }
  return filter;
}

/* =========================================================
   EXISTING HANDLERS (kept)
   ========================================================= */

/**
 * GET /api/admin/payments
 * Query: q, status, method, page, limit, from, to
 */
exports.getAllPayments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = makeFilterFromQuery(req.query);
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Order.find(filter).sort({ orderDate: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/payments/export/pdf
 */
exports.exportPaymentsPDF = async (req, res, next) => {
  try {
    const filter = makeFilterFromQuery(req.query);
    const items = await Order.find(filter).sort({ orderDate: -1 }).lean();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=payments.pdf");

    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);

    doc.fontSize(16).text("Payments Report", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.font("Helvetica-Bold");
    doc.text("Order ID", { continued: true, width: 160 });
    doc.text("Amount", { continued: true, width: 80, align: "right" });
    doc.text("Method", { continued: true, width: 80 });
    doc.text("Pay Status", { continued: true, width: 90 });
    doc.text("Order Status", { continued: true, width: 90 });
    doc.text("Date", { width: 130 });
    doc.moveDown(0.3);
    doc.font("Helvetica");

    items.forEach((o) => {
      doc.text(String(o._id), { continued: true, width: 160 });
      doc.text(Number(o.totalAmount || 0).toFixed(2), { continued: true, width: 80, align: "right" });
      doc.text(o.paymentMethod || "-", { continued: true, width: 80 });
      doc.text(o.paymentStatus || "-", { continued: true, width: 90 });
      doc.text(o.orderStatus || "-", { continued: true, width: 90 });
      doc.text(o.orderDate ? new Date(o.orderDate).toLocaleString() : "-", { width: 130 });
    });

    doc.end();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/payments/find?paymentId=PH123
 */
exports.findOrderByPaymentId = async (req, res, next) => {
  try {
    const { paymentId } = req.query;
    if (!paymentId) return res.status(400).json({ success: false, message: "paymentId is required" });
    const order = await Order.findOne({ paymentId }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, item: order });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/payments/:id
 * body: { paymentStatus, orderStatus?, paymentId? }
 * ✅ Updates Order AND upserts matching Payment doc
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params; // Order _id
    const { paymentStatus, orderStatus, paymentId } = req.body || {};
    if (!paymentStatus && !orderStatus && !paymentId) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // normalize & update order
    if (paymentStatus) order.paymentStatus = paymentStatus.toUpperCase();
    if (orderStatus)   order.orderStatus   = orderStatus.toUpperCase();
    if (paymentId)     order.paymentId     = paymentId;
    order.orderUpdateDate = new Date();
    await order.save();

    // upsert payment row to stay in sync
    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: order.paymentMethod || "payhere",
          paymentMethod: order.paymentMethod || "payhere",
          paymentStatus: order.paymentStatus,
          amount: order.totalAmount || 0,
          currency: "LKR",
          providerPaymentId: order.paymentId || "",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, item: { _id: order._id } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/payments/:id
 * ✅ Removes order (or you can soft-cancel) AND deletes Payment row
 */
exports.deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params;

    // hard delete (keep your previous behavior)
    const del = await Order.findByIdAndDelete(id).lean();

    // if you prefer soft delete instead, replace the line above with:
    // const del = await Order.findByIdAndUpdate(id, { $set: { orderStatus: "CANCELLED", paymentStatus: "FAILED", orderUpdateDate: new Date() } }, { new: true }).lean();

    await Payment.deleteOne({ orderId: new mongoose.Types.ObjectId(id) });

    if (!del) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, message: "Deleted", item: del });
  } catch (err) {
    next(err);
  }
};

/* =========================================================
   NEW HANDLERS (added)
   ========================================================= */

/**
 * GET /api/admin/payments/orders
 */
exports.listPaymentOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = makeFilterFromQuery(req.query);
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Order.find(filter).sort({ orderDate: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/payments/orders/:id/mark-paid
 * Body: { paymentId?, payerId? }
 * ✅ Also upserts Payment row to PAID
 */
exports.markOrderPaid = async (req, res, next) => {
  try {
    const { id } = req.params; // Order _id
    const { paymentId, payerId } = req.body || {};

    const order = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: "PAID",
          orderStatus: "CONFIRMED",
          ...(paymentId ? { paymentId } : {}),
          ...(payerId ? { payerId } : {}),
          orderUpdateDate: new Date(),
        },
      },
      { new: true }
    );

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: order.paymentMethod || "payhere",
          paymentMethod: order.paymentMethod || "payhere",
          paymentStatus: "PAID",
          amount: order.totalAmount || 0,
          currency: "LKR",
          providerPaymentId: paymentId || order.paymentId || "",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, item: order.toObject() });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/payments/summary
 */
exports.getPaymentSummary = async (_req, res, next) => {
  try {
    const byStatus = await Order.aggregate([
      { $group: { _id: "$paymentStatus", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
      { $sort: { count: -1 } },
    ]);

    const byMethod = await Order.aggregate([
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, byStatus, byMethod });
  } catch (err) {
    next(err);
  }
};
