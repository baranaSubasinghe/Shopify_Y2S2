import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function generateReviewsPDF(reviews = []) {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" }); // portrait
    const BRAND = "Shopify Clothing";
    const now = new Date().toLocaleString();

    doc.setProperties({ title: "Reviews Report", creator: BRAND });

    // Title + date
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Product Reviews Report", 40, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on: ${now}`, 40, 66);

    const rows = reviews.map(r => ([
      r.productTitle || "(deleted product)",
      r.userName || "-",
      (r.reviewValue ?? "-").toString(),
      (r.reviewMessage || "").slice(0, 80),
      new Date(r.createdAt).toLocaleString(),
    ]));

    autoTable(doc, {
      head: [["Product", "User", "Rating", "Message", "Created"]],
      body: rows,
      startY: 80,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [33, 33, 33], textColor: 255 },
      didDrawPage: (data) => {
        // footer
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ?? pageSize.getHeight();
        doc.setFontSize(9);
        doc.text(
          `${BRAND} · Page ${doc.internal.getNumberOfPages()}`,
          40,
          pageHeight - 20
        );
      },
      margin: { top: 80, left: 40, right: 40, bottom: 40 },
    });

    doc.save(`reviews_${new Date().toISOString().slice(0,10)}.pdf`);
  } catch (e) {
    console.error(e);
  }
}
