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

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.text("Registered Users", 14, 16);
    const rows = items.map((u) => ({
      userName: u.userName || "-",
      email: u.email || "-",
      createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString() : "-",
    }));
    autoTable(doc, {
      head: [columns.map((c) => c.header)],
      body: rows.map((r) => columns.map((c) => r[c.dataKey])),
      startY: 22,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [0, 0, 0] },
    });
    doc.save("users.pdf");
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
