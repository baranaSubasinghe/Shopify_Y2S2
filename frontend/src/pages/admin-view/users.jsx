// frontend/src/pages/admin-view/users.jsx
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchUsers,
  deleteUser,
  setSearch,
  updateUserRole,
} from "@/store/admin/users-slice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const LOGO_PATH = "/brands/logo-dark.svg";
const BRAND_NAME = "Admin Panel";

function safeDate(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default function AdminUsersPage() {
  const dispatch = useDispatch();
  const { items, status, total, search } = useSelector((s) => s.adminUsers);
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    dispatch(fetchUsers({ search }));
  }, [dispatch, search]);

  const onDelete = async (id) => {
    if (!confirm("Delete this user?")) return;
    try {
      await dispatch(deleteUser(id)).unwrap();
      toast.success("User deleted.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to delete user.");
    }
  };

  const onToggleRole = async (user) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    try {
      await dispatch(updateUserRole({ userId: user._id, role: nextRole })).unwrap();
      toast.success(`Role changed to ${nextRole}.`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Failed to update role.");
    }
  };

  const tableRows = useMemo(() => items || [], [items]);

  const onSearch = () => {
    dispatch(setSearch(localSearch.trim()));
  };

  const toDataURL = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () {
        const c = document.createElement("canvas");
        c.width = this.naturalWidth;
        c.height = this.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(this, 0, 0);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const downloadPDF = async () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setProperties({ title: "Users Report", creator: BRAND_NAME });

    const logo = await toDataURL(LOGO_PATH);
    const pageWidth = doc.internal.pageSize.getWidth();
    const left = 40;
    const right = pageWidth - 40;

    const header = () => {
      if (logo) doc.addImage(logo, "PNG", left, 20, 100, 24);
      doc.setFontSize(12);
      doc.text(`${BRAND_NAME} • Users Report`, right, 36, { align: "right" });
      doc.line(left, 50, right, 50);
    };

    const footer = (data) => {
      const page = `${data.pageNumber}`;
      doc.setFontSize(10);
      doc.text(`Page ${page}`, right, doc.internal.pageSize.getHeight() - 24, {
        align: "right",
      });
    };

    autoTable(doc, {
      head: [["Name", "Email", "Role", "Created"]],
      body: tableRows.map((u) => [
        u.userName,
        u.email,
        u.role,
        safeDate(u.createdAt),
      ]),
      startY: 70,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [0, 0, 0] },
      didDrawPage: (d) => {
        header();
        footer(d);
      },
      margin: { left, right: left },
    });

    doc.save("users-report.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Users ({total})</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name or email"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-[320px]"
          />
          <Button onClick={onSearch}>Search</Button>
          <Button variant="secondary" onClick={downloadPDF}>
            Download PDF
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background">
        <div className="overflow-x-auto">
          {/* table-fixed + defined width on Actions keeps buttons aligned */}
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[28%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" /> {/* Actions */}
            </colgroup>
            <thead>
              <tr className="border-b">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Created</th>
                <th className="p-3">Role</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((u) => (
                <tr key={u._id} className="border-b hover:bg-muted/30">
                  <td className="p-3 truncate">{u.userName}</td>
                  <td className="p-3 truncate">{u.email}</td>
                  <td className="p-3">{safeDate(u.createdAt)}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        onClick={() => onToggleRole(u)}
                        title={u.role === "admin" ? "Make User" : "Make Admin"}
                        className="min-w-[110px]"
                      >
                        {u.role === "admin" ? "Make User" : "Make Admin"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => onDelete(u._id)}
                        className="min-w-[90px]"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {tableRows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-sm text-muted-foreground" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
