// backend/controllers/admin/payment-controller.js
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const Order   = require("../../models/Order");
const Payment = require("../../models/Payment");
const { notifyUser } = require("../../helpers/notify");

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

const refOf = (order) => order.orderNumber || String(order._id).slice(-6).toUpperCase();

// pick a valid enum value for orderStatus (so we don't crash if "DELIVERED" doesn't exist)
function pickValidOrderStatus(OrderModel, preferredList = ["DELIVERED", "CONFIRMED", "PROCESSING"]) {
  const enumVals = (OrderModel.schema.path("orderStatus")?.options?.enum || [])
    .map(v => String(v).toUpperCase());
  for (const want of preferredList.map(s => String(s).toUpperCase())) {
    if (enumVals.includes(want)) return want;
  }
  return enumVals[0] || null; // fallback to first enum or no change
}

/* =========================================================
   HANDLERS
   ========================================================= */

async function getAllPayments(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = makeFilterFromQuery(req.query);
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("_id orderNumber totalAmount paymentMethod paymentStatus orderStatus orderDate addressInfo userId")
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    next(err);
  }
}

async function exportPaymentsPDF(req, res, next) {
  try {
    const filter = makeFilterFromQuery(req.query);
    const items = await Order.find(filter).sort({ orderDate: -1 }).lean();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=payments.pdf");

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    doc.on("error", (err) => {
      console.error("Payments PDF error:", err);
      if (!res.headersSent) res.status(500).end("Error generating PDF");
    });
    doc.pipe(res);

    const pageWidth = doc.page.width;
    const margin = 36;

    const cols = [
      { key: "orderId",      label: "Order ID",     x: 36,  w: 130, align: "left"  },
      { key: "amount",       label: "Amount",       x: 170, w: 70,  align: "right" },
      { key: "method",       label: "Method",       x: 250, w: 70,  align: "left"  },
      { key: "payStatus",    label: "Pay Status",   x: 320, w: 90,  align: "left"  },
      { key: "orderStatus",  label: "Order Status", x: 410, w: 90,  align: "left"  },
      { key: "date",         label: "Date",         x: 500, w: 180, align: "left"  },
    ];

    let y = margin;
    const rowH = 18;

    const fmtAmt = (v) => {
      const n = Number(v);
      return Number.isFinite(n)
        ? n.toLocaleString("en-LK", { minimumFractionDigits: 2 })
        : "0.00";
    };
    const fmtDate = (d) => {
      if (!d) return "-";
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return "-";
      const pad = (n) => String(n).toString().padStart(2, "0");
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };
    const cut = (s, max = 32) => {
      const t = String(s ?? "");
      return t.length > max ? t.slice(0, max - 1) + "…" : t;
    };
    const needRoom = (h = rowH) => {
      if (y + h > doc.page.height - margin) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
    };
    const drawHeader = () => {
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#111").text("Payments Report", 36, y);
      doc.font("Helvetica").fontSize(10).fillColor("#555").text(`Generated: ${fmtDate(Date.now())}`, 36, y + 20);
      y += 42;
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#000");
      cols.forEach((c) => doc.text(c.label, c.x, y, { width: c.w, align: c.align, lineBreak: false }));
      y += 14;
      doc.moveTo(36, y).lineTo(pageWidth - margin, y).strokeColor("#ccc").stroke();
      y += 6;
    };
    const drawRow = (o, zebra) => {
      needRoom(rowH + 4);
      if (zebra) {
        doc.save();
        doc.rect(36, y - 2, pageWidth - margin * 2, rowH + 4).fillOpacity(0.04).fill("#000").restore();
      }
      const cells = {
        orderId:     cut(o._id, 24),
        amount:      fmtAmt(o.totalAmount || 0),
        method:      String(o.paymentMethod || "-"),
        payStatus:   String(o.paymentStatus || "-"),
        orderStatus: String(o.orderStatus || "-"),
        date:        fmtDate(o.orderDate),
      };
      doc.font("Helvetica").fontSize(10).fillColor("#000");
      cols.forEach((c) =>
        doc.text(cells[c.key], c.x, y, { width: c.w, align: c.align, lineBreak: false, ellipsis: true })
      );
      y += rowH;
    };

    const drawHeaderAndRows = () => {
      drawHeader();
      if (!items.length) {
        doc.font("Helvetica-Oblique").fontSize(11).fillColor("#666").text("No payments found.", 36, y, { lineBreak: false });
        doc.end();
        return;
      }
      let zebra = false;
      let total = 0;
      items.forEach((o) => { total += Number(o.totalAmount || 0); drawRow(o, zebra); zebra = !zebra; });
      doc.moveTo(36, y).lineTo(pageWidth - margin, y).strokeColor("#ccc").stroke();
      y += 8;
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#000")
        .text(`Total Amount: Rs. ${fmtAmt(total)}`, 36, y, { lineBreak: false });
      doc.end();
    };

    drawHeaderAndRows();
  } catch (err) {
    next(err);
  }
}

async function findOrderByPaymentId(req, res, next) {
  try {
    const { paymentId } = req.query;
    if (!paymentId) return res.status(400).json({ success: false, message: "paymentId is required" });
    const order = await Order.findOne({ paymentId }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, item: order });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentStatus(req, res) {
  try {
    const { paymentId, status } = req.body; // expects 'PENDING' | 'PAID' | 'FAILED'
    if (!paymentId || !status) {
      return res.status(400).json({ success: false, message: "Missing paymentId or status" });
    }

    const validStatuses = ["PENDING", "PAID", "FAILED"];
    const upperStatus = String(status).toUpperCase();
    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

    payment.paymentStatus = upperStatus;
    await payment.save();

    await Order.findOneAndUpdate(
      { _id: payment.orderId },
      { paymentStatus: upperStatus, orderUpdateDate: new Date() }
    );

    return res.status(200).json({ success: true, message: `Payment marked as ${upperStatus}` });
  } catch (err) {
    console.error("updatePaymentStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

async function markOrderPending(req, res, next) {
  try {
    const { id } = req.params; // Order _id
    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { paymentStatus: "PENDING", orderUpdateDate: new Date() } },
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
          paymentStatus: "PENDING",
          amount: order.totalAmount || 0,
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, item: order.toObject() });
  } catch (err) {
    next(err);
  }
}

async function markOrderFailed(req, res, next) {
  try {
    const { id } = req.params; // Order _id
    const order = await Order.findByIdAndUpdate(
      id,
      { $set: { paymentStatus: "FAILED", orderUpdateDate: new Date() } },
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
          paymentStatus: "FAILED",
          amount: order.totalAmount || 0,
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    // notify customer
    await notifyUser(
      order.userId,
      "ORDER",
      `Payment failed for Order ${refOf(order)}`,
      `Please retry your payment.`,
      { orderId: order._id, admin: true, failed: true }
    );

    res.json({ success: true, item: order.toObject() });
  } catch (err) {
    next(err);
  }
}

async function deletePayment(req, res, next) {
  try {
    const { id } = req.params;

    // hard delete order (or soft-cancel if you prefer)
    const del = await Order.findByIdAndDelete(id).lean();
    await Payment.deleteOne({ orderId: new mongoose.Types.ObjectId(id) });

    if (!del) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, message: "Deleted", item: del });
  } catch (err) {
    next(err);
  }
}

async function listPaymentOrders(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const filter = makeFilterFromQuery(req.query);
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Order.find(filter)
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select("_id orderNumber totalAmount paymentMethod paymentStatus orderStatus orderDate addressInfo userId")
        .lean(),
      Order.countDocuments(filter),
    ]);

    res.json({ success: true, page: Number(page), limit: Number(limit), total, items });
  } catch (err) {
    next(err);
  }
}

async function markOrderPaid(req, res, next) {
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

    await notifyUser(
      order.userId,
      "ORDER",
      `Payment marked PAID for Order ${refOf(order)}`,
      `We have confirmed your payment.`,
      { orderId: order._id, admin: true }
    );

    res.json({ success: true, item: order.toObject() });
  } catch (err) {
    next(err);
  }
}

async function getPaymentSummary(_req, res, next) {
  try {
    // this powers your dashboard graphs
    const byStatus = await Order.aggregate([
      {
        $group: {
          _id: { $toUpper: "$paymentStatus" },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const byMethod = await Order.aggregate([
      {
        $group: {
          _id: { $toLower: "$paymentMethod" },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, byStatus, byMethod });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin/Delivery marks COD collected as PAID (+ sets a valid orderStatus)
 */
async function markCODCollected(req, res, next) {
  try {
    const { id } = req.params;
    const role = String(req.user?.role || "").toLowerCase();
    if (!["admin", "delivery"].includes(role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (String(order.paymentMethod || "").toLowerCase() !== "cod")
      return res.status(400).json({ success: false, message: "Not a COD order" });

    if (String(order.paymentStatus || "").toUpperCase() === "PAID") {
      return res.json({
        success: true,
        item: { _id: order._id, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus },
      });
    }

    // choose a valid next status based on your enum
    const nextOrderStatus = pickValidOrderStatus(Order, ["DELIVERED", "CONFIRMED"]);

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: "PAID",
          ...(nextOrderStatus ? { orderStatus: nextOrderStatus } : {}),
          orderUpdateDate: new Date(),
        },
      },
      { new: true, runValidators: true }
    );

    await Payment.findOneAndUpdate(
      { orderId: updated._id },
      {
        $set: {
          userId: updated.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: "PAID",
          amount: Number(updated.totalAmount || 0),
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    const ref = refOf(updated);
    await notifyUser(
      updated.userId,
      "ORDER",
      `Order ${ref} ${nextOrderStatus === "DELIVERED" ? "delivered" : "updated"}`,
      `Payment received (COD). Total ${updated.totalAmount} LKR.`,
      { orderId: updated._id, method: "COD", via: role, orderStatus: updated.orderStatus }
    );

    return res.json({
      success: true,
      item: { _id: updated._id, paymentStatus: updated.paymentStatus, orderStatus: updated.orderStatus },
    });
  } catch (err) {
    console.error("markCODCollected error:", err);
    next(err);
  }
}

/* =========================================================
   EXPORTS (single object, no missing functions)
   ========================================================= */
module.exports = {
  getAllPayments,
  exportPaymentsPDF,
  findOrderByPaymentId,
  updatePaymentStatus,
  markOrderPending,
  markOrderFailed,
  deletePayment,
  listPaymentOrders,
  markOrderPaid,
  getPaymentSummary,   // <-- powers your graphs / payment methods counts
  markCODCollected,    // <-- delivery/admin endpoint that sets both statuses
};