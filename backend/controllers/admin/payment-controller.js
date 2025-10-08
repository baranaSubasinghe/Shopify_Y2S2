const Order = require("../../models/Order");
const PDFDocument = require("pdfkit");

// GET /api/admin/payments
// Returns normalized payments list for the Admin UI
const getAllPayments = async (_req, res) => {
  try {
    const list = await Order.find({ paymentMethod: "payhere" })
      .sort({ orderDate: -1 })
      .populate({ path: "userId", select: "email" }) // fallback email
      .lean();

    const data = list.map((o) => ({
      _id: String(o._id),
      paymentId: o.paymentId || "-",
      userEmail: o?.addressInfo?.email || o?.userId?.email || "-",
      totalAmount: Number(o.totalAmount || 0),
      paymentStatus: (o.paymentStatus || "PENDING").toUpperCase(),
      paymentMethod: (o.paymentMethod || "payhere").toUpperCase(),
      orderDate: o.orderDate || o.createdAt || new Date(),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error("getAllPayments error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

// GET /api/admin/payments/export/pdf
// Streams a simple Payments report PDF
const exportPaymentsPDF = async (_req, res) => {
  try {
    const list = await Order.find({ paymentMethod: "payhere" })
      .sort({ orderDate: -1 })
      .populate({ path: "userId", select: "email" })
      .lean();

    const doc = new PDFDocument({ margin: 36, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=payments.pdf");
    doc.pipe(res);

    // Header
    doc.fontSize(20).text("Payments Report", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor("#666")
      .text(`Generated: ${new Date().toLocaleString()}`, { align: "center" })
      .fillColor("#000");
    doc.moveDown(0.8);

    // Table header
    const headers = ["Payment ID", "Status", "Amount (LKR)", "Method", "User Email", "Date/Time"];
    const colWidths = [120, 70, 100, 70, 160, 140];
    const startX = doc.page.margins.left;
    let y = doc.y;

    headers.forEach((h, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.fontSize(11).text(h, x, y, { width: colWidths[i] });
    });
    doc.moveDown(0.6);
    y = doc.y;
    doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
    doc.moveDown(0.2);

    // Rows
    list.forEach((o) => {
      const row = [
        o.paymentId || "-",
        (o.paymentStatus || "PENDING").toUpperCase(),
        `Rs. ${Number(o.totalAmount || 0).toFixed(2)}`,
        (o.paymentMethod || "payhere").toUpperCase(),
        o?.addressInfo?.email || o?.userId?.email || "-",
        new Date(o.orderDate || o.createdAt || Date.now()).toLocaleString(),
      ];
      row.forEach((cell, i) => {
        const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.fontSize(10).text(String(cell), x, doc.y, { width: colWidths[i] });
      });
      doc.moveDown(0.4);
    });

    doc.end();
  } catch (err) {
    console.error("exportPaymentsPDF error:", err);
    res.status(500).json({ success: false, message: "Failed to generate PDF" });
  }
};

// GET /api/admin/payments/find?paymentId=PH123...
// Returns a single order by paymentId (used by return page search, if needed)
const findOrderByPaymentId = async (req, res) => {
  try {
    const { paymentId } = req.query;
    if (!paymentId) {
      return res.status(400).json({ success: false, message: "paymentId required" });
    }
    const order = await Order.findOne({ paymentId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Not found" });
    }
    res.json({ success: true, data: order });
  } catch (e) {
    console.error("findOrderByPaymentId error:", e);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/admin/payments/:id
// Update paymentStatus (PAID|PENDING|FAILED). Optionally orderStatus & paymentId.
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    let { paymentStatus, orderStatus, paymentId } = req.body || {};

    const ALLOWED = ["PAID", "PENDING", "FAILED"];
    if (!paymentStatus || !ALLOWED.includes(String(paymentStatus).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `paymentStatus required and must be one of: ${ALLOWED.join(", ")}`,
      });
    }

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Normalize to uppercase
    paymentStatus = String(paymentStatus).toUpperCase();
    order.paymentStatus = paymentStatus;

    // Default orderStatus mapping if not provided
    if (!orderStatus) {
      if (paymentStatus === "PAID") orderStatus = "CONFIRMED";
      else if (paymentStatus === "FAILED") orderStatus = "CANCELLED";
      else orderStatus = "PENDING";
    }
    order.orderStatus = String(orderStatus).toUpperCase();

    // Optional: allow updating/storing a gateway payment reference manually
    if (typeof paymentId === "string") {
      order.paymentId = paymentId;
    }

    await order.save();
    return res.json({ success: true, data: order });
  } catch (e) {
    console.error("updatePaymentStatus error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin/payments/:id
// Deletes an order/payment record
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const del = await Order.findByIdAndDelete(id);
    if (!del) return res.status(404).json({ success: false, message: "Order not found" });
    return res.json({ success: true });
  } catch (e) {
    console.error("deletePayment error:", e);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAllPayments,
  exportPaymentsPDF,
  findOrderByPaymentId,
  updatePaymentStatus, // ✅ NEW
  deletePayment,       // ✅ NEW
};
