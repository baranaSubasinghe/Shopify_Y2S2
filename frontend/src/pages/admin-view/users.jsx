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
import { Users as UsersIcon, Shield, Truck } from "lucide-react";

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

  const [stats, setStats] = useState({ total: 0, admins: 0, delivery: 0, users: 0 });

useEffect(() => {
  // same base as your other API calls (adjust base URL if you use env)
  fetch(`${import.meta.env.VITE_API_BASE_URL || "http://localhost:5001"}/api/admin/users/stats`, {
    credentials: "include",
  })
    .then(r => r.json())
    .then(j => {
      if (j?.success && j.data) setStats(j.data);
    })
    .catch(() => {});
}, []);
 const onToggleRole = async (user) => {
  // cycle: user → admin → delivery → user
  const nextRole =
    user.role === "user"
      ? "admin"
      : user.role === "admin"
      ? "delivery"
      : "user";

  try {
    await dispatch(updateUserRole({ userId: user._id, role: nextRole })).unwrap();
    toast.success(`Role changed to ${nextRole}.`);
  } catch (e) {
    toast.error(e?.response?.data?.message || "Failed to update role.");
  }
};


  const tableRows = useMemo(() => items || [], [items]);



// auto-search when typing (debounced)
useEffect(() => {
  const timer = setTimeout(() => {
    dispatch(setSearch(localSearch.trim()));
  }, 500); // wait 0.5s after typing stops
  return () => clearTimeout(timer);
}, [localSearch, dispatch]);

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
      {/* KPI cards with colors */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <div className="rounded-xl border p-4 bg-gradient-to-br from-slate-100 to-slate-200 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700 font-medium">Total Users</span>
      <UsersIcon className="w-5 h-5 text-slate-600" />
    </div>
    <div className="mt-2 text-3xl font-bold text-slate-800">{stats.total}</div>
  </div>

  <div className="rounded-xl border p-4 bg-gradient-to-br from-emerald-100 to-emerald-200 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-sm text-emerald-700 font-medium">Admins</span>
      <Shield className="w-5 h-5 text-emerald-600" />
    </div>
    <div className="mt-2 text-3xl font-bold text-emerald-800">{stats.admins}</div>
  </div>

  <div className="rounded-xl border p-4 bg-gradient-to-br from-amber-100 to-yellow-200 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-sm text-yellow-700 font-medium">Delivery</span>
      <Truck className="w-5 h-5 text-yellow-600" />
    </div>
    <div className="mt-2 text-3xl font-bold text-yellow-800">{stats.delivery}</div>
  </div>

  <div className="rounded-xl border p-4 bg-gradient-to-br from-blue-100 to-blue-200 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-sm text-blue-700 font-medium">Regular Users</span>
      <UsersIcon className="w-5 h-5 text-blue-600" />
    </div>
    <div className="mt-2 text-3xl font-bold text-blue-800">{stats.users}</div>
  </div>
</div>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold">Users ({total})</h2>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name or email"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-[320px]"
          />
          
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
                        className="min-w-[120px]"
                      >
                        {u.role === "user"
                          ? "Make Admin"
                          : u.role === "admin"
                          ? "Make Delivery"
                          : "Make User"}
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
