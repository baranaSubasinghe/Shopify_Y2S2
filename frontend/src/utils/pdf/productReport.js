import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// helper to shorten long ids: abcd1234…7890
const shortId = (id = "") =>
  id && id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;

/**
 * Generates and downloads a Products PDF (portrait, fits within page)
 * products: [{ _id, title, category, brand, price, salePrice, totalStock, averageReview, createdAt }]
 */
export function generateProductsPDF(products = []) {
  try {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Title + subhead
    doc.setFontSize(16);
    doc.text("Products Report", 14, 18);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);

    if (!Array.isArray(products) || products.length === 0) {
      doc.setFontSize(12);
      doc.text("No products found.", 14, 36);
      doc.save(`products_${Date.now()}.pdf`);
      return true;
    }

    const headers = [
      "ID",
      "Title",
      "Category",
      "Brand",
      "Price (LKR)",
      "Sale (LKR)",
      "Stock",
      "Avg ★",
      "Created",
    ];

    const rows = products.map((p) => [
      shortId(p._id || ""),
      p.title || "",
      p.category || "",
      p.brand || "",
      p.price != null ? `Rs. ${Number(p.price).toLocaleString("en-LK")}` : "",
      p.salePrice != null ? `Rs. ${Number(p.salePrice).toLocaleString("en-LK")}` : "",
      p.totalStock ?? "",
      typeof p.averageReview === "number" ? p.averageReview.toFixed(1) : (p.averageReview ?? ""),
      p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
    ]);

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 34,
      margin: { left: 14, right: 14 }, // keep within page
      tableWidth: "wrap",               // do not exceed page width
      styles: {
        fontSize: 8,                    // slightly smaller to fit
        cellPadding: 2,
        overflow: "linebreak",          // wrap if needed
        valign: "middle",
      },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 26 },  // ID (short)
        1: { cellWidth: 42 },  // Title
        2: { cellWidth: 20 },  // Category
        3: { cellWidth: 22 },  // Brand
        4: { cellWidth: 22 },  // Price
        5: { cellWidth: 22 },  // Sale
        6: { cellWidth: 16 },  // Stock
        7: { cellWidth: 14 },  // Avg
        8: { cellWidth: 22 },  // Created
      },
      didDrawPage: (data) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageSize = doc.internal.pageSize;
        const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth();
        doc.setFontSize(9);
        doc.text(
          `Page ${data.pageNumber} of ${pageCount}`,
          pageWidth - 20,
          pageSize.height - 8
        );
      },
    });

    doc.save(`products_${Date.now()}.pdf`);
    return true;
  } catch (err) {
    console.error("PDF generation failed:", err);
    return false;
  }
}
