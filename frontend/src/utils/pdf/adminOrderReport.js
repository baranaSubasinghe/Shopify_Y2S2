// frontend/src/utils/pdf/adminOrderReports.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LKR = (n) => `Rs. ${Number(n ?? 0).toLocaleString("en-LK")}`;
const BRAND = {
  headerBg: [15, 15, 15],
  headerText: [255, 255, 255],
  muted: [120, 120, 120],
};
const rr = (doc, x, y, w, h, r = 8, style = "S") =>
  doc.roundedRect(x, y, w, h, r, r, style);

/** Export the orders list (whatever array you pass) to a clean PDF table. */
export function exportOrdersListPDF(orders = [], { title = "Orders Report", brandName = "Shopify" } = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(...BRAND.headerBg);
  rr(doc, 0, 0, pageW, 90, 0, "F");
  doc.setTextColor(...BRAND.headerText);
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(`${brandName} — ${title}`, M, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleString("en-LK")}`, M, 70);

  // Table rows
  const body = (orders || []).map((o) => {
    const id = String(o?._id || "-");
    const date = o?.orderDate
      ? new Date(o.orderDate).toISOString().split("T")[0]
      : "-";
    const status = String(o?.orderStatus || "-").toUpperCase();
    const total = LKR(o?.totalAmount ?? 0);
    const customer = o?.addressInfo?.name || "-";
    const phone = o?.addressInfo?.phone || "-";
    return [id, date, status, total, customer, phone];
  });

  autoTable(doc, {
    startY: 110,
    head: [["Order ID", "Date", "Status", "Total", "Customer", "Phone"]],
    body: body.length ? body : [["-", "-", "-", LKR(0), "-", "-"]],
    theme: "striped",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: BRAND.headerBg, textColor: BRAND.headerText },
    columnStyles: {
      0: { cellWidth: 165 },               // ID
      1: { halign: "center", cellWidth: 70 },
      2: { halign: "center", cellWidth: 80 },
      3: { halign: "right",  cellWidth: 80 },
      4: { cellWidth: 110 },
      5: { cellWidth: 95 },
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(9); doc.setTextColor(...BRAND.muted);
      doc.text(`Page ${page}`, pageW - M, pageH - 20, { align: "right" });
    },
  });

  doc.save(`orders_report_${new Date().toISOString().slice(0,10)}.pdf`);
}
