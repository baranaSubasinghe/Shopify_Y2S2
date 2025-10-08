// frontend/src/pages/shopping-view/payhere-return.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const API_BASE = "http://localhost:5001";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const looksLikeMongoId = (v = "") => /^[a-f0-9]{24}$/i.test(v.trim());

export default function PayHereReturn() {
  const query = useQuery();
  const navigate = useNavigate();

  const initialOrderId = query.get("orderId") || "";
  const [orderId, setOrderId] = useState(initialOrderId);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(!!initialOrderId);
  const [searchKey, setSearchKey] = useState(initialOrderId);

  const loadOrderById = async (id) => {
    if (!id) {
      setOrder(null);
      return;
    }
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/api/shop/order/details/${id}`, {
        withCredentials: true,
      });
      if (data?.success) {
        setOrder(data.data);

        const status = String(data?.data?.paymentStatus || "").toUpperCase();
        if (status === "PAID") toast.success("Payment successful");
        else if (status === "FAILED") toast.error("Payment failed");
        else toast("Payment is being verified…");
      } else {
        setOrder(null);
        toast.error(data?.message || "Order not found");
      }
    } catch (e) {
      console.error("Load order error:", e);
      setOrder(null);
      toast.error("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderId) loadOrderById(initialOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  const handleSearch = async () => {
    const key = (searchKey || "").trim();
    if (!key) return toast.error("Enter an Order ID or Payment ID");

    // If it looks like a Mongo ObjectId => treat as Order ID
    if (looksLikeMongoId(key)) {
      await loadOrderById(key);
      setOrderId(key);
      navigate(`/payhere-return?orderId=${encodeURIComponent(key)}`, { replace: true });
      return;
    }

    // Otherwise, try as Payment ID via admin find endpoint
    try {
      const { data } = await axios.get(`${API_BASE}/api/admin/payments/find`, {
        params: { paymentId: key },
        withCredentials: true,
      });
      if (data?.success && data?.data?._id) {
        const foundId = data.data._id;
        await loadOrderById(foundId);
        setOrderId(foundId);
        navigate(`/payhere-return?orderId=${encodeURIComponent(foundId)}`, { replace: true });
        return;
      }
      toast.error("No order found for that Payment ID");
    } catch (e) {
      console.error("Find by paymentId error:", e);
      toast.error("Search by Payment ID failed");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDownloadPDF = () => {
    if (!orderId) return toast.error("No order selected");
    window.open(`${API_BASE}/api/shop/order/invoice/${orderId}`, "_blank");
  };

  const items = Array.isArray(order?.cartItems) ? order.cartItems : [];
  const totalAmount = Number(order?.totalAmount || 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Payment Return</h1>

      {/* Search */}
      <div className="flex gap-2 mb-5">
        <Input
          placeholder="Search by Order ID or Payment ID..."
          value={searchKey}
          onChange={(e) => setSearchKey(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-96"
        />
        <Button onClick={handleSearch}>Search</Button>
      </div>

      {loading ? (
        <div className="p-6 rounded border">Loading order details…</div>
      ) : !order ? (
        <div className="p-6 rounded border">
          No order loaded. Search by **Order ID** (24-char hex) or **Payment ID** (from PayHere).
        </div>
      ) : (
        <div className="space-y-6">
          {/* Invoice card */}
          <div className="rounded border p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">Invoice</h2>
                <p className="text-sm text-muted-foreground">
                  Order ID: <span className="font-mono">{orderId}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Payment ID: <span className="font-mono">{order?.paymentId || "-"}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm">
                  Date:{" "}
                  {new Date(order?.orderDate || order?.createdAt || Date.now()).toLocaleString()}
                </p>
                <p className="text-sm">
                  Status: <b>{order?.paymentStatus || "-"}</b>
                </p>
                <p className="text-sm">Method: {order?.paymentMethod || "payhere"}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="mt-4">
              <h3 className="font-semibold">Bill To</h3>
              <div className="text-sm">
                {[
                  `${order?.addressInfo?.firstName || ""} ${order?.addressInfo?.lastName || ""}`.trim() || "Customer",
                  order?.addressInfo?.email,
                  order?.addressInfo?.phone,
                  order?.addressInfo?.address,
                  [order?.addressInfo?.city, order?.addressInfo?.country].filter(Boolean).join(", "),
                ]
                  .filter(Boolean)
                  .map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
              </div>
            </div>

            {/* Items */}
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left border">Item</th>
                    <th className="p-2 text-right border">Qty</th>
                    <th className="p-2 text-right border">Unit (LKR)</th>
                    <th className="p-2 text-right border">Total (LKR)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const qty = Number(it.quantity || 0);
                    const unit = Number(it.price || 0);
                    return (
                      <tr key={idx}>
                        <td className="p-2 border">{it.title || it.productId?.title || "-"}</td>
                        <td className="p-2 text-right border">{qty}</td>
                        <td className="p-2 text-right border">
                          {unit.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-right border">
                          {(qty * unit).toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                  {!items.length && (
                    <tr>
                      <td colSpan="4" className="p-3 text-center border">
                        No items recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals + actions */}
            <div className="mt-4 flex items-center justify-between">
              <div />
              <div className="text-right">
                <div className="text-lg font-semibold">
                  Grand Total: Rs.{" "}
                  {totalAmount.toLocaleString("en-LK", { minimumFractionDigits: 2 })}
                </div>
                <div className="mt-2">
                  <Button
                    onClick={handleDownloadPDF}
                    className="bg-black text-white hover:bg-black/90"
                  >
                    Download Invoice PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/shop/account")}>
              Go to My Orders
            </Button>
            <Button variant="outline" onClick={() => navigate("/shop/home")}>
              Continue Shopping
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
