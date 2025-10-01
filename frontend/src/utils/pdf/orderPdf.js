// src/utils/pdf/orderPdf.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable"; // ✅ explicit import is safest

const LKR = (n) => `Rs. ${Number(n || 0).toLocaleString("en-LK")}`;

export function exportOrderInvoicePDF(order, { brandName = "Shopify" } = {}) {
  try {
    if (!order || !order._id) throw new Error("No order data to export");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 40;

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`${brandName} — Invoice`, M, 50);

    // Meta
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const dateStr = order?.orderDate
      ? new Date(order.orderDate).toLocaleString("en-LK", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "-";
    let y = 78;
    doc.text(`Order ID: ${order._id}`, M, y); y += 16;
    doc.text(`Order Date: ${dateStr}`, M, y); y += 16;
    doc.text(`Order Status: ${order?.orderStatus || "-"}`, M, y);

    // Shipping (right column)
    const rightX = pageW - M - 250;
    y = 78;
    doc.setFont("helvetica", "bold");
    doc.text("Shipping To", rightX, y); y += 16;
    doc.setFont("helvetica", "normal");
    const a = order?.addressInfo || {};
    [a.name, a.address, `${a.city || ""} ${a.pincode || ""}`.trim(), a.phone, a.notes]
      .filter(Boolean)
      .forEach(line => { doc.text(String(line), rightX, y); y += 14; });

    // Items table
    const rows = (order?.cartItems || []).map(it => {
      const p = Number(it.price || 0);
      const q = Number(it.quantity || 0);
      return [it.title || "-", String(q), LKR(p), LKR(p * q)];
    });

    const startY = 170;
    autoTable(doc, {
      startY,
      head: [["Item", "Qty", "Price", "Subtotal"]],
      body: rows.length ? rows : [["-", "0", LKR(0), LKR(0)]], // ✅ safe if empty
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [15, 15, 15], textColor: 255 },
      columnStyles: {
        1: { halign: "center", cellWidth: 60 },
        2: { halign: "right", cellWidth: 90 },
        3: { halign: "right", cellWidth: 110 },
      },
      margin: { left: M, right: M },
    });

    // Totals
    const endY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || startY;
    const total = Number(order?.totalAmount || 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const labelX = pageW - M - 220;
    const valueX = pageW - M;
    doc.text("Total", labelX, endY + 22, { align: "right" });
    doc.text(LKR(total), valueX, endY + 22, { align: "right" });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      `Generated on ${new Date().toLocaleString("en-LK")} • ${brandName}`,
      M,
      pageH - 28
    );

    doc.save(`invoice_${order._id}.pdf`); // ✅ triggers download
  } catch (err) {
    console.error("PDF export failed:", err);
    alert(`Couldn't download PDF: ${err.message}`); // quick visible feedback
  }
}
