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

/** Export the visible/filtered orders to a PDF table (no Customer column). */
export function exportOrdersListPDF(
  orders = [],
  { title = "Orders Report", brandName = "Shopify" } = {}
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header band
  doc.setFillColor(...BRAND.headerBg);
  rr(doc, 0, 0, pageW, 90, 0, "F");
  doc.setTextColor(...BRAND.headerText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${brandName} — ${title}`, M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated on ${new Date().toLocaleString("en-LK")}`, M, 70);

  // Build rows (ID, Date, Status, Total)
  const body = (orders || []).map((o) => {
    const id = String(o?._id || "-");
    const date = o?.orderDate
      ? new Date(o.orderDate).toISOString().split("T")[0]
      : "-";
    const status = String(o?.orderStatus || "-").toUpperCase();
    const total = LKR(o?.totalAmount ?? 0);
    return [id, date, status, total];
  });

  // Dynamic widths that always fit the printable area
  const printable = pageW - 2 * M; // left+right margins
  const wId = Math.floor(printable * 0.46);
  const wDate = Math.floor(printable * 0.18);
  const wStatus = Math.floor(printable * 0.16);
  const wTotal = printable - (wId + wDate + wStatus); // fill the rest

  autoTable(doc, {
    startY: 110,
    head: [["Order ID", "Date", "Status", "Total"]],
    body: body.length ? body : [["-", "-", "-", LKR(0)]],
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "middle",
      textColor: [20, 20, 20],
      lineColor: [235, 235, 235],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: BRAND.headerBg,
      textColor: BRAND.headerText,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: wId },               // Order ID
      1: { cellWidth: wDate, halign: "center" }, // Date
      2: { cellWidth: wStatus, halign: "center" }, // Status
      3: { cellWidth: wTotal, halign: "right" },  // Total (visible now)
    },
    margin: { left: M, right: M },
    didDrawPage: () => {
      const page = doc.internal.getNumberOfPages();
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.muted);
      doc.text(`Page ${page}`, pageW - M, pageH - 20, { align: "right" });
    },
  });

  doc.save(`orders_report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
