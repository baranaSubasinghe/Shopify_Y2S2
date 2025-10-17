// frontend/src/pages/admin-view/payments.jsx
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function AdminPaymentsPage() {
  const [rows, setRows] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  // --- load from NEW list endpoint (/orders) ---
  const load = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${API_BASE}/api/admin/payments/orders`,
        { params: { page: 1, limit: 200 }, withCredentials: true }
      );
      if (data?.success) {
        setRows(data.items || []);
        setFiltered(data.items || []);
      } else {
        setRows([]); setFiltered([]);
        toast.error(data?.message || "Failed to load payments");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // --- client-side filter (order id / user / payment id / status / method / phone / city) ---
  const filter = (val) => {
    setQ(val);
    const v = val.toLowerCase();
    setFiltered(
      rows.filter((r) =>
        [
          r._id,
          r.paymentId,
          r.userId,
          r.paymentStatus,
          r.paymentMethod,
          r?.addressInfo?.phone,
          r?.addressInfo?.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(v)
      )
    );
  };

  // --- update status ---
  // Use the dedicated mark-paid endpoint for PAID,
  // fall back to legacy PATCH for other statuses.
  const updateStatus = async (id, paymentStatus) => {
    try {
      let resp;
      if (paymentStatus.toUpperCase() === "PAID") {
        resp = await axios.patch(
          `${API_BASE}/api/admin/payments/orders/${id}/mark-paid`,
          {}, { withCredentials: true }
        );
      } else {
        resp = await axios.patch(
          `${API_BASE}/api/admin/payments/${id}`,
          { paymentStatus: paymentStatus.toUpperCase() },
          { withCredentials: true }
        );
      }

      const ok = resp?.data?.success;
      if (ok) {
        toast.success(`Updated to ${paymentStatus.toUpperCase()}`);
        setRows((prev) =>
          prev.map((r) =>
            r._id === id ? { ...r, paymentStatus: paymentStatus.toUpperCase() } : r
          )
        );
        setFiltered((prev) =>
          prev.map((r) =>
            r._id === id ? { ...r, paymentStatus: paymentStatus.toUpperCase() } : r
          )
        );
      } else {
        toast.error(resp?.data?.message || "Update failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Update failed");
    }
  };

  // --- delete order/payment (legacy endpoint you already had) ---
  const deletePayment = async (id) => {
    if (!confirm("Delete this payment/order? This cannot be undone.")) return;
    try {
      const { data } = await axios.delete(
        `${API_BASE}/api/admin/payments/${id}`,
        { withCredentials: true }
      );
      if (data?.success) {
        toast.success("Deleted");
        setRows((prev) => prev.filter((r) => r._id !== id));
        setFiltered((prev) => prev.filter((r) => r._id !== id));
      } else {
        toast.error(data?.message || "Delete failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  };

  // --- export pdf (legacy endpoint you already had) ---
  const exportPDF = () => {
    window.open(`${API_BASE}/api/admin/payments/export/pdf`, "_blank");
  };

  const totalAmount = useMemo(
    () => filtered.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0),
    [filtered]
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex gap-2 items-center">
          <Input
            placeholder="Search order/user/phone/city…"
            value={q}
            onChange={(e) => filter(e.target.value)}
            className="w-72"
          />
          <Button onClick={exportPDF} className="bg-black text-white hover:bg-black/90">
            Download PDF
          </Button>
        </div>
      </div>

      <div className="mb-2 text-sm">
        Showing <b>{filtered.length}</b> records · Total LKR{" "}
        <b>{totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}</b>
      </div>

      {loading ? (
        <div className="p-6 border rounded">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 border text-left">Order ID</th>
                <th className="p-2 border text-left">Payment ID</th>
                <th className="p-2 border text-left">User</th>
                <th className="p-2 border text-right">Amount (LKR)</th>
                <th className="p-2 border text-left">Status</th>
                <th className="p-2 border text-left">Method</th>
                <th className="p-2 border text-left">Date</th>
                <th className="p-2 border text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r._id}>
                  <td className="p-2 border font-mono">{r._id}</td>
                  <td className="p-2 border font-mono">{r.paymentId || "-"}</td>
                  <td className="p-2 border">
                    {r.userEmail || r.userId || "-"}
                  </td>
                  <td className="p-2 border text-right">
                    {Number(r.totalAmount || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 border">
                    <span
                      className={[
                        "px-2 py-1 rounded text-xs",
                        r.paymentStatus === "PAID" ? "bg-black text-white" :
                        r.paymentStatus === "FAILED" ? "bg-red-600 text-white" :
                        "bg-gray-300 text-black",
                      ].join(" ")}
                    >
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td className="p-2 border">{r.paymentMethod || "-"}</td>
                  <td className="p-2 border">
                    {r.orderDate ? new Date(r.orderDate).toLocaleString() : "-"}
                  </td>
                  <td className="p-2 border">
                    <div className="flex flex-wrap gap-2">
                      <a className="underline" href={`/admin/orders/${r._id}`}>View</a>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r._id, "PAID")}>
                        Mark Paid
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r._id, "PENDING")}>
                        Mark Pending
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(r._id, "FAILED")}>
                        Mark Failed
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deletePayment(r._id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td className="p-4 text-center border" colSpan={8}>
                    No payments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
