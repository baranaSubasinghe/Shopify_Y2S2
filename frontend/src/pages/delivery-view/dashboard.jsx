// frontend/src/pages/delivery-view/dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle2,
  CircleDot,
  Truck,
  PackageCheck,
  RefreshCw,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5001";

// valid server statuses (we send these in lowercase; backend normalizes)
const NEXT_STATES = [
  { label: "Shipped", value: "shipped", icon: Truck },
  { label: "Out for delivery", value: "out_for_delivery", icon: CircleDot },
  { label: "Delivered", value: "delivered", icon: PackageCheck },
];

// ── helpers ───────────────────────────────────────────────────────────────────
const toK = (v) => String(v || "").trim().toLowerCase();

function StatusPill({ status }) {
  const s = toK(status);
  const map = {
    pending: "bg-gray-100 text-gray-700",
    processing: "bg-slate-100 text-slate-700",
    confirmed: "bg-slate-100 text-slate-700",
    shipped: "bg-blue-100 text-blue-700",
    out_for_delivery: "bg-amber-100 text-amber-700",
    delivered: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
    assigned: "bg-indigo-100 text-indigo-700",
  };
  const cls = map[s] || "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {s.replaceAll("_", " ")}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-50 border-slate-200",
    blue: "bg-blue-50 border-blue-200",
    amber: "bg-amber-50 border-amber-200",
    emerald: "bg-emerald-50 border-emerald-200",
  };
  return (
    <div className={`border ${tones[tone]} rounded-xl p-4 flex items-center gap-3`}>
      <div className="p-2 rounded-lg bg-white shadow-sm border">
        <Icon className="h-5 w-5 text-slate-700" />
      </div>
      <div>
        <div className="text-sm text-slate-500">{title}</div>
        <div className="text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1.4fr_.8fr_.8fr_1fr] items-center gap-4 py-4 border-b">
      <div className="h-4 bg-slate-100 rounded w-44" />
      <div className="h-4 bg-slate-100 rounded w-28" />
      <div className="h-4 bg-slate-100 rounded w-64" />
      <div className="h-4 bg-slate-100 rounded w-20" />
      <div className="h-6 bg-slate-100 rounded w-24" />
      <div className="h-9 bg-slate-100 rounded w-36 ml-auto" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DeliveryDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/delivery/orders/my`, {
        withCredentials: true,
      });
      setOrders(data?.data || []);
    } catch (e) {
      console.error("[delivery][load]", e?.response?.data || e);
      toast.error(e?.response?.data?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId, nextStatus) {
    try {
      // send lowercase; backend maps to enum
      await axios.patch(
        `${API}/api/delivery/orders/${orderId}/status`,
        { orderStatus: toK(nextStatus) },
        { withCredentials: true }
      );
      toast.success("Status updated");
      load();
    } catch (e) {
      console.error("[delivery][update]", e?.response?.data || e);
      toast.error(e?.response?.data?.message || "Update failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  // quick stats (normalize server’s UPPERCASE to lowercase keys)
  const stats = useMemo(() => {
    const s = { shipped: 0, out_for_delivery: 0, delivered: 0, pending: 0, processing: 0, confirmed: 0 };
    for (const o of orders) {
      const k = toK(o.orderStatus || "pending");
      s[k] = (s[k] || 0) + 1;
    }
    return s;
  }, [orders]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Delivery Dashboard</h1>
          <p className="text-slate-500">View and update orders assigned to you.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Shipped" value={stats.shipped || 0} icon={Truck} tone="blue" />
        <StatCard title="Out for delivery" value={stats.out_for_delivery || 0} icon={CircleDot} tone="amber" />
        <StatCard title="Delivered" value={stats.delivered || 0} icon={CheckCircle2} tone="emerald" />
        <StatCard
          title="Pending / Processing"
          value={(stats.pending || 0) + (stats.processing || 0) + (stats.confirmed || 0)}
          icon={PackageCheck}
        />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">My Assigned Orders</h2>
          <span className="text-sm text-slate-500">{orders.length} orders</span>
        </div>

        {/* Table header */}
        <div className="px-5 py-3 grid grid-cols-[1.2fr_1fr_1.4fr_.8fr_.8fr_1fr] gap-4 text-xs uppercase tracking-wide text-slate-500 border-b bg-slate-50/60">
          <div>Order</div>
          <div>Date</div>
          <div>Customer / Address</div>
          <div>Total</div>
          <div>Status</div>
          <div className="text-right">Action</div>
        </div>

        {/* Rows */}
        <div className="px-5">
          {loading && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}

          {!loading && orders.length === 0 && (
            <div className="py-10 text-center text-slate-500">No orders assigned.</div>
          )}

          {!loading &&
            orders.map((o) => {
              const current = toK(o.orderStatus || "pending");
              const addr = o.addressInfo || {};
              const dateStr =
                o.orderDate
                  ? new Date(o.orderDate).toLocaleDateString()
                  : o.createdAt
                  ? new Date(o.createdAt).toLocaleDateString()
                  : "—";
              const total = Number(o.totalAmount || 0).toLocaleString("en-LK");
              const itemsPreview =
                Array.isArray(o.cartItems) && o.cartItems.length
                  ? o.cartItems
                      .slice(0, 2)
                      .map((it) => `${it.title} × ${it.quantity}`)
                      .join(", ") + (o.cartItems.length > 2 ? "…" : "")
                  : "—";

              // determine next step based on normalized status
              let next = NEXT_STATES[0]; // default -> shipped
              if (current === "shipped") next = NEXT_STATES[1]; // out_for_delivery
              if (current === "out_for_delivery") next = NEXT_STATES[2]; // delivered
              if (current === "delivered") next = null;

              return (
                <div
                  key={o._id}
                  className="grid grid-cols-[1.2fr_1fr_1.4fr_.8fr_.8fr_1fr] items-center gap-4 py-4 border-b last:border-0"
                >
                  {/* Order */}
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      #{o.orderNumber || (o._id ? o._id.slice(-6) : "—")}
                    </div>
                    <div className="text-xs text-slate-500 truncate">{itemsPreview}</div>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-slate-700">{dateStr}</div>

                  {/* Customer / Address */}
                  <div className="min-w-0">
                    <div className="text-sm text-slate-900 truncate">
                      {addr.fullName || addr.name || "—"} {addr.phone ? `• ${addr.phone}` : ""}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {addr.address || "—"} {addr.city ? `• ${addr.city}` : ""}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="font-semibold">Rs. {total}</div>

                  {/* Status */}
                  <div>
                    <StatusPill status={current} />
                  </div>

                  {/* Action */}
                  <div className="ml-auto">
                    {next ? (
                      <button
                        onClick={() => updateStatus(o._id, next.value)}
                        disabled={current === "delivered"}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90 disabled:opacity-40"
                      >
                        <next.icon className="h-4 w-4" />
                        {next.label}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Completed</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}