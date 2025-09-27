import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, deleteUser, setSearch } from "@/store/admin/users-slice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminUsersPage() {
  const dispatch = useDispatch();
  const { items, status, total, search } = useSelector((s) => s.adminUsers);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    dispatch(fetchUsers({ search }));
  }, [dispatch, search]);

  const onDelete = async (id) => {
    const ok = confirm("Delete this user?");
    if (!ok) return;
    const res = await dispatch(deleteUser(id));
    if (res.payload?.success) toast.success("User deleted");
    else toast.error(res.payload?.message || "Delete failed");
  };

  const onSearch = () => dispatch(setSearch(localSearch.trim()));

  // -------- PDF download (client-side) ----------
  const columns = useMemo(
    () => [
      { header: "Name", dataKey: "userName" },
      { header: "Email", dataKey: "email" },
      { header: "Created", dataKey: "createdAt" },
    ],
    []
  );

const downloadPDF = async () => {
  // ---- Branding config (edit these 3 lines to taste) ----
  const BRAND_NAME = "Shopify Clothing";
  const BRAND_URL  = "www.shopify.com";
  const LOGO_PATH  = "/logo.png"; // put your logo file in frontend/public/logo.png (PNG or JPG)

  // Prepare document
  const doc = new jsPDF({ unit: "pt", format: "a4" }); // 595x842pt
  doc.setProperties({ title: "Users Report", creator: BRAND_NAME });

  // Preload logo if available
  const logo = await toDataURL(LOGO_PATH);

  // page metrics
  const pageWidth  = doc.internal.pageSize.getWidth();
  const left       = 40;
  const right      = pageWidth - 40;

  // Header & Footer using autoTable hooks
  const header = () => {
    // logo (left)
    if (logo) {
      try {
        doc.addImage(logo, "PNG", left, 24, 40, 40); // x,y,w,h
      } catch {}
    }

    // Brand name + URL
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(BRAND_NAME, left + (logo ? 52 : 0), 42); // next to logo if present
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(BRAND_URL, left + (logo ? 52 : 0), 58);

    // Report title (right)
    doc.setFont("times", "bold");
    doc.setFontSize(24);
    doc.setTextColor(33);
    doc.text("Users Report", right, 44, { align: "right" });

    // Generated time (right, small)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, right, 58, { align: "right" });

    // Divider
    doc.setDrawColor(220);
    doc.setLineWidth(1);
    doc.line(left, 70, right, 70);
    // reset color for body
    doc.setTextColor(33);
  };

  const footer = () => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const y = doc.internal.pageSize.getHeight() - 28;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`${BRAND_NAME} • ${BRAND_URL}`, left, y);
      doc.text(`Page ${i} of ${pageCount}`, right, y, { align: "right" });
    }
  };

  // Build rows from your Redux items
  const rows = (items || []).map((u, idx) => ([
    String(idx + 1),
    u.userName || "-",
    u.email || "-",
    formatDateTime(u.createdAt),
  ]));

  // Draw header on first page
  header();

  // Table
  autoTable(doc, {
    startY: 88, // leave space for header
    head: [["#", "Name", "Email", "Created"]],
    body: rows,
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: 8,
      valign: "middle",
      textColor: 30,
    },
    headStyles: {
      fillColor: [0, 128, 96], // Shopify green
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [247, 247, 247],
    },
    columnStyles: {
      0: { cellWidth: 28, halign: "center" },           // #
      1: { cellWidth: 150 },                             // Name
      2: { cellWidth: 240 },                             // Email
      3: { cellWidth: "auto", halign: "right" },        // Created
    },
    margin: { left, right: 40 },
    didDrawPage: (data) => {
      // draw header on every page
      if (data.pageNumber > 1) header();
    },
  });

  // Footer with page numbers
  footer();

  // file name with date
  const yyyy = new Date().toISOString().slice(0,10);
  doc.save(`users_${yyyy}.pdf`);
};


  // tiny helper to load a public image and return a dataURL (works with Vite /public/*)
async function toDataURL(src) {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // fail silently; header will render without logo
  }
}

// consistent date formatting (Safari-safe)
const formatDateTime = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};
  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold">Users ({total})</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search by name or email"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <Button onClick={onSearch}>Search</Button>
          <Button variant="outline" onClick={downloadPDF}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto border rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Created</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
        </table>
        <div className="max-h-[65vh] overflow-y-auto">
          <table className="min-w-full text-sm">
            <tbody>
              {status === "loading" && (
                <tr>
                  <td className="p-3" colSpan={4}>Loading…</td>
                </tr>
              )}
              {status !== "loading" && items.length === 0 && (
                <tr>
                  <td className="p-3" colSpan={4}>No users</td>
                </tr>
              )}
              {items.map((u) => (
                <tr key={u._id} className="border-t">
                  <td className="p-3">{u.userName}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    {u.createdAt ? new Date(u.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="destructive"
                      onClick={() => onDelete(u._id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
