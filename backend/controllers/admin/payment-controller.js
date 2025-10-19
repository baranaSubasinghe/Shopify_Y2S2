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
};

/**
 * GET /api/admin/payments/export/pdf
 */
/**
 * GET /api/admin/payments/export/pdf
 * Clean, columnar PDF with fixed widths, row height, and page breaks
 */
exports.exportPaymentsPDF = async (req, res, next) => {
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
    const pageHeight = doc.page.height;
    const margin = 36;

    // Widen date column and balance others
    const cols = [
      { key: "orderId",      label: "Order ID",     x: 36,  w: 130, align: "left"  },
      { key: "amount",       label: "Amount",       x: 170, w: 70,  align: "right" },
      { key: "method",       label: "Method",       x: 250, w: 70,  align: "left"  },
      { key: "payStatus",    label: "Pay Status",   x: 320, w: 90,  align: "left"  },
      { key: "orderStatus",  label: "Order Status", x: 410, w: 90,  align: "left"  },
      { key: "date",         label: "Date",         x: 500, w: 180, align: "left"  }, // ✅ wider
    ];

    let y = margin;
    const rowH = 18;

    // helpers
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
      const pad = (n) => String(n).padStart(2, "0");
      return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    const cut = (s, max = 32) => {
      const t = String(s ?? "");
      return t.length > max ? t.slice(0, max - 1) + "…" : t;
    };

    const needRoom = (h = rowH) => {
      if (y + h > pageHeight - margin) {
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
      cols.forEach((c) => {
        doc.text(c.label, c.x, y, { width: c.w, align: c.align, lineBreak: false });
      });
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
      cols.forEach((c) => {
        doc.text(cells[c.key], c.x, y, {
          width: c.w,
          align: c.align,
          lineBreak: false,   // ✅ no wrapping at all
          ellipsis: true,     // ✅ ensures truncation instead of wrapping
        });
      });

      y += rowH;
    };

    // ------- content -------
    drawHeader();

    if (!items.length) {
      needRoom(20);
      doc.font("Helvetica-Oblique").fontSize(11).fillColor("#666").text("No payments found.", 36, y, { lineBreak: false });
      doc.end();
      return;
    }

    let zebra = false;
    let total = 0;

    items.forEach((o) => {
      total += Number(o.totalAmount || 0);
      drawRow(o, zebra);
      zebra = !zebra;
    });

    // summary
    needRoom(28);
    doc.moveTo(36, y).lineTo(pageWidth - margin, y).strokeColor("#ccc").stroke();
    y += 8;
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000")
      .text(`Total Amount: Rs. ${fmtAmt(total)}`, 36, y, { lineBreak: false });

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
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId, status } = req.body; // expects 'FAILED' or 'PENDING'

    if (!paymentId || !status) {
      return res.status(400).json({ success: false, message: "Missing paymentId or status" });
    }

    const validStatuses = ["PENDING", "PAID", "FAILED"];
    const upperStatus = status.toUpperCase();

    if (!validStatuses.includes(upperStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Update payment
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    payment.paymentStatus = upperStatus;
    await payment.save();

    // Sync order
    await Order.findOneAndUpdate(
      { _id: payment.orderId },
      { paymentStatus: upperStatus, orderUpdateDate: new Date() }
    );

    return res.status(200).json({ success: true, message: `Payment marked as ${upperStatus}` });
  } catch (err) {
    console.error("updatePaymentStatus error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * PATCH /api/admin/payments/orders/:id/mark-pending
 */
exports.markOrderPending = async (req, res, next) => {
  try {
    const { id } = req.params; // Order _id
    const order = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: "PENDING",
          // keep orderStatus unchanged; or set PROCESSING if you prefer:
          // orderStatus: "PROCESSING",
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
};

/**
 * PATCH /api/admin/payments/orders/:id/mark-failed
 */
exports.markOrderFailed = async (req, res, next) => {
  try {
    const { id } = req.params; // Order _id
    const order = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          paymentStatus: "FAILED",
          // optionally cancel the order when payment failed:
          // orderStatus: "CANCELLED",
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
          paymentStatus: "FAILED",
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
    // group by UPPER paymentStatus so "paid" and "PAID" are one bucket
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

    // group by LOWER method so "PayHere" / "payhere" collapse
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
};

// PATCH /api/admin/payments/orders/:id/cod-collected
/**
 * PATCH /api/admin/payments/orders/:id/cod-collected
 * Body (optional): { paymentId?, payerId? }
 * Marks a COD order as PAID + CONFIRMED and upserts Payment row.
 */
 
// PATCH /api/admin/payments/orders/:id/cod-collected
exports.markCODCollected = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = String(req.user?.role || "").toLowerCase();
    if (!["admin", "delivery"].includes(role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const order = await Order.findById(id);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    if (String(order.paymentMethod || "").toLowerCase() !== "cod")
      return res.status(400).json({ success: false, message: "Not a COD order" });

    if (String(order.paymentStatus || "").toUpperCase() === "PAID") {
      return res.json({
        success: true,
        item: { _id: order._id, paymentStatus: order.paymentStatus },
      });
    }

    order.paymentStatus = "PAID";
    order.orderUpdateDate = new Date();
    await order.save();

    await Payment.findOneAndUpdate(
      { orderId: order._id },
      {
        $set: {
          userId: order.userId,
          provider: "cod",
          paymentMethod: "cod",
          paymentStatus: "PAID",
          amount: Number(order.totalAmount || 0),
          currency: "LKR",
          ipnAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      item: { _id: order._id, paymentStatus: "PAID" },
    });
  } catch (err) {
    console.error("markCODCollected error:", err);
    next(err);
  }
};