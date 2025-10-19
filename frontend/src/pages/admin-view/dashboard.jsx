import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Package, ShoppingCart, Users, CreditCard, Image as ImageIcon } from "lucide-react";

/* ========= Feature Images (from your previous dashboard) ========= */
import ProductImageUpload from "@/components/admin-view/image-upload";
import { useDispatch, useSelector } from "react-redux";
import { addFeatureImage, getFeatureImages, deleteFeature } from "@/store/common-slice";
/* ================================================================= */

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

/* ---------- utils ---------- */
const fmtAmt = (n) => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 });
const safeDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleString();
};
const pickArray = (res) => {
  const d = res?.data ?? res;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.items)) return d.items;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(d?.data?.items)) return d.data.items;
  return [];
};
const pickObject = (res) => {
  const d = res?.data ?? res;
  if (d?.data && !Array.isArray(d.data)) return d.data;
  return d;
};
const oid = (o) => String(o?._id ?? o?.id ?? "-");

/* ====================================================== */

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);

  const [paySummary, setPaySummary] = useState({ byStatus: [], byMethod: [] });
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [usersSummary, setUsersSummary] = useState({ total: 0, admin: 0, delivery: 0, user: 0 });

  // dashboard tile images (best-effort defaults)
  const [featureTileImgs, setFeatureTileImgs] = useState({
    products: "/admin/tiles/products.jpg",
    orders: "/admin/tiles/orders.jpg",
    users: "/admin/tiles/users.jpg",
    payments: "/admin/tiles/payments.jpg",
  });

  /* ====== Feature Images uploader state (your previous code) ====== */
  const dispatch = useDispatch();
  const { featureImageList } = useSelector((s) => s.commonFeature);

  const [imageFile, setImageFile] = useState(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [imageLoadingState, setImageLoadingState] = useState(false);
  const [topSelling, setTopSelling] = useState([]);
  const [activeDelivery, setActiveDelivery] = useState([]);

  const handleUploadFeatureImage = async () => {
    if (!uploadedImageUrl) return;
    const r = await dispatch(addFeatureImage(uploadedImageUrl));
    if (r?.payload?.success) {
      await dispatch(getFeatureImages());
      setImageFile(null);
      setUploadedImageUrl("");
    }
  };

  const handleDeleteFeature = async (id) => {
    if (!confirm("Delete this feature image?")) return;
    const res = await dispatch(deleteFeature(id));
    if (res?.payload?.success) dispatch(getFeatureImages());
  };
  /* ================================================================= */

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);

        // Payments summary
        let ps = {};
        try {
          const r = await axios.get(`${API}/api/admin/payments/summary`, { withCredentials: true });
          ps = pickObject(r);
        } catch { ps = { byStatus: [], byMethod: [] }; }

                // Top selling
        let topSelling = [];
        try {
          const r = await axios.get(`${API}/api/admin/products/top-selling`, { withCredentials: true });
          topSelling = pickArray(r);
        } catch { topSelling = []; }
        setTopSelling(topSelling);
     
       // Orders (recent) — use payments list endpoint which returns Order docs
          let orders = [];
          try {
            const r = await axios.get(`${API}/api/admin/payments`, {
              params: { page: 1, limit: 12 },
              withCredentials: true,
            });
            orders = pickArray(r); // supports {items}, {data.items}, or bare array
          } catch {
            orders = [];
          }

          //active delivery staff
          try {
            const r = await axios.get(`${API}/api/admin/users/delivery/active`, {
              params: { days: 30, limit: 8 },
              withCredentials: true,
            });
            const arr = Array.isArray(r?.data?.data) ? r.data.data : [];
            setActiveDelivery(arr);
          } catch {
            setActiveDelivery([]);
            }
        // Products (admin preferred; fallback to shop)
        let products = [];
        try {
          const r = await axios.get(`${API}/api/admin/products`, {
            params: { page: 1, limit: 6 }, withCredentials: true,
          });
          products = pickArray(r);
        } catch {
          try {
            const r = await axios.get(`${API}/api/shop/products/get`, { withCredentials: true });
            products = pickArray(r).slice(0, 6);
          } catch { products = []; }
        }

        // Users summary
        let us = {};
        try {
          const r = await axios.get(`${API}/api/admin/users/summary`, { withCredentials: true });
          us = pickObject(r);
        } catch {
          try {
            const r = await axios.get(`${API}/api/admin/users`, {
              params: { page: 1, limit: 1000 }, withCredentials: true,
            });
            const list = pickArray(r);
            const rollup = list.reduce((acc, u) => {
              const role = String(u?.role || "user").toLowerCase();
              if (role === "admin") acc.admin++;
              else if (role === "delivery") acc.delivery++;
              else acc.user++;
              acc.total++;
              return acc;
            }, { total: 0, admin: 0, delivery: 0, user: 0 });
            us = rollup;
          } catch { us = { total: 0, admin: 0, delivery: 0, user: 0 }; }
        }

        // (optional) feature tiles lookup if you store keys in backend
        try {
          const r = await axios
            .get(`${API}/api/common/feature/list`)
            .catch(() => axios.get(`${API}/api/common/feature`));
          const map = pickArray(r).reduce((m, it) => { if (it.key && it.image) m[it.key] = it.image; return m; }, {});
          if (Object.keys(map).length) {
            setFeatureTileImgs((s) => ({ ...s, ...map }));
          }
        } catch {}

        if (!mounted) return;
        setPaySummary({
          byStatus: Array.isArray(ps?.byStatus) ? ps.byStatus : [],
          byMethod: Array.isArray(ps?.byMethod) ? ps.byMethod : [],
        });
        setRecentOrders(orders);
        setTopProducts(products);
        setUsersSummary(us);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // load feature images list used on homepage (your redux slice)
    dispatch(getFeatureImages());

    return () => { mounted = false; };
  }, [dispatch]);

  /* ---------- charts (filtered) ---------- */

  const relTime = (d) => {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "-";
  const diff = (Date.now() - dt.getTime()) / 1000;
  const mins = Math.floor(diff / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};
const initials = (s="") => {
  const parts = String(s).trim().split(/\s+/).slice(0,2);
  return parts.map(p=>p[0]?.toUpperCase() || "").join("") || "D";
};

  // Only PENDING & PAID
  const statusPie = useMemo(() => {
    const keep = new Set(["PENDING","PAID"]);
    const filtered = (paySummary?.byStatus || []).filter(s => keep.has(String(s?._id ?? "").toUpperCase()));
    return filtered.map((s) => ({
      name: String(s?._id ?? "-"),
      value: Number(s?.count || 0),
      amount: Number(s?.amount || 0),
      color: s?._id?.toUpperCase?.() === "PAID" ? "#10b981" : "#111827",
    }));
  }, [paySummary]);

  // Only PAYHERE
  const methodBars = useMemo(() => {
    const filtered = (paySummary?.byMethod || []).filter(
      m => String(m?._id ?? "").toLowerCase() === "payhere"
    );
    return filtered.map((m) => ({
      method: String(m?._id ?? "payhere"),
      orders: Number(m?.count || 0),
      amount: Number(m?.amount || 0),
    }));
  }, [paySummary]);

  // Revenue Trend
  const revenueTrend = useMemo(() => {
    const fromOrders = (() => {
      const map = new Map();
      (recentOrders || []).forEach((o) => {
        const d = new Date(o.orderDate || o.createdAt);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
          map.set(key, (map.get(key) || 0) + Number(o.totalAmount || 0));
        }
      });
      return Array.from(map.entries()).sort((a,b)=>a[0]<b[0]?-1:1).map(([date, amount]) => ({ date, amount }));
    })();

    if (fromOrders.length) return fromOrders;

    const paid = (paySummary?.byStatus || []).find(s => String(s?._id).toUpperCase() === "PAID");
    if (paid?.amount) {
      const today = new Date();
      const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
      return [{ date: key, amount: Number(paid.amount) }];
    }
    return [];
  }, [recentOrders, paySummary]);

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground">Overview of sales, payments, orders & users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardStat
          title="Users"
          value={usersSummary.total}
          hint={`Admin ${usersSummary.admin} • Delivery ${usersSummary.delivery} • Users ${usersSummary.user}`}
          gradient="from-indigo-50 to-white"
        />
        <CardStat title="Orders (latest)" value={recentOrders.length} hint="Recent admin view" gradient="from-sky-50 to-white" />
        <CardStat title="Payment Methods" value={(paySummary?.byMethod || []).filter(m => String(m?._id).toLowerCase()==="payhere").length} hint="Unique methods" gradient="from-emerald-50 to-white" />
        <CardStat title="Payment States" value={(paySummary?.byStatus || []).filter(s => ["PAID","PENDING"].includes(String(s?._id).toUpperCase())).length} hint="paid / pending" gradient="from-amber-50 to-white" />
      </div>

      {/* FEATURE TILES */}
      <FeatureTiles imgs={featureTileImgs} />

      {/* ========= Feature Images Uploader Panel ========= */}
      <div className="rounded-2xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Feature Images</h3>
            <p className="text-xs text-muted-foreground">These images appear on the homepage strip.</p>
          </div>
          <Link to="/admin/images">
            <Button variant="outline"><ImageIcon className="mr-2 h-4 w-4" /> Manage on full page</Button>
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* upload card */}
          <div className="rounded-xl border p-3">
            <ProductImageUpload
              imageFile={imageFile}
              setImageFile={setImageFile}
              uploadedImageUrl={uploadedImageUrl}
              setUploadedImageUrl={setUploadedImageUrl}
              setImageLoadingState={setImageLoadingState}
              imageLoadingState={imageLoadingState}
              isCustomStyling
            />
            <Button onClick={handleUploadFeatureImage} className="mt-3 w-full" disabled={!uploadedImageUrl}>
              Upload
            </Button>
          </div>

          {/* gallery */}
          <div className="rounded-xl border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.isArray(featureImageList) && featureImageList.length > 0 ? (
                featureImageList.map((img) => {
                  const id = img._id || img.id;
                  return (
                    <div key={id} className="relative group rounded-lg overflow-hidden border">
                      <img
                        src={img.image}
                        className="w-full h-40 object-cover"
                        alt={img.title || "Feature"}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteFeature(id)}
                      >
                        Delete
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">No feature images yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* =================================================== */}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-4">
          <div className="mb-3">
            <h3 className="text-lg font-semibold">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground">From recent orders</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(v) => v.toLocaleString("en-LK")} />
                <Tooltip formatter={(v) => `Rs ${fmtAmt(v)}`} labelFormatter={(l) => `Date: ${l}`} />
                <Legend />
                <Line type="monotone" dataKey="amount" name="Revenue" dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        

        <div className="rounded-2xl border p-4">
          <div className="mb-3">
            <h3 className="text-lg font-semibold">Payments by Method</h3>
            <p className="text-xs text-muted-foreground">Only PayHere (count & amount)</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip formatter={(v, n) => (n === "amount" ? [`Rs ${fmtAmt(v)}`, "Amount"] : [v, "Orders"])} />
                <Legend />
                <Bar dataKey="orders" name="Orders" />
                <Bar dataKey="amount" name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border p-4">
          <div className="mb-3">
            <h3 className="text-lg font-semibold">Payments by Status</h3>
            <p className="text-xs text-muted-foreground">paid & pending</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={84} label={({ name, value }) => `${name} (${value})`}>
                  {statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v, n, p) => [v, `${p?.payload?.name} • Rs ${fmtAmt(p?.payload?.amount)}`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
              <div className="rounded-2xl border p-4">
            <div className="mb-3">
              <h3 className="text-lg font-semibold">Top Selling Products</h3>
              <p className="text-xs text-muted-foreground">Most ordered products</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topSelling}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip formatter={(v) => `${v} sold`} />
                  <Bar dataKey="soldCount" fill="#6366f1" name="Units Sold" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Active Delivery Staff */}
<div className="rounded-2xl border p-4">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <h3 className="text-lg font-semibold">Active Delivery Staff</h3>
      <p className="text-xs text-muted-foreground">Recently delivered orders</p>
    </div>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {activeDelivery.map((row) => {
      const u = row.user || {};
      const avatarText = initials(u.userName || u.email);
      return (
        <div key={String(u._id)} className="flex items-center gap-3 rounded-xl border p-3">
          {/* Avatar */}
          {u.avatar ? (
            <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full grid place-items-center bg-sky-100 text-sky-700 font-semibold">
              {avatarText}
            </div>
          )}

          <div className="min-w-0">
            <div className="truncate font-medium">
              {u.userName || u.email || "Delivery"}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.deliveredCount} delivered • {relTime(row.lastDeliveredAt)}
            </div>
          </div>
        </div>
      );
    })}
    {activeDelivery.length === 0 && (
      <div className="text-sm text-muted-foreground">No recent deliveries.</div>
    )}
  </div>
</div>
      {/* tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Recent Orders</h3>
              <p className="text-xs text-muted-foreground">Latest admin-visible orders</p>
            </div>
            <Button variant="outline" onClick={() => (window.location.href = "/admin/orders")}>View all</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Order</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2">Pay</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={oid(o)} className="border-b">
                    <td className="p-2 font-mono truncate">{oid(o)}</td>
                    <td className="p-2 text-right">Rs {fmtAmt(o.totalAmount)}</td>
                    <td className="p-2"><Badge tone={pickPay(o.paymentStatus)}>{o.paymentStatus}</Badge></td>
                    <td className="p-2"><Badge tone={pickOrder(o.orderStatus)}>{o.orderStatus}</Badge></td>
                    <td className="p-2">{safeDate(o.orderDate || o.createdAt)}</td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={5}>No data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Top Products</h3>
              <p className="text-xs text-muted-foreground">Quick glance from products</p>
            </div>
            <Button variant="outline" onClick={() => (window.location.href = "/admin/products")}>Manage</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topProducts.map((p) => (
              <div key={oid(p)} className="flex items-center gap-3 rounded-xl border p-3">
                <img
                  src={p?.image || p?.images?.[0] || "https://via.placeholder.com/64x64?text=P"}
                  alt={p?.title || p?.name || "Product"}
                  className="h-12 w-12 rounded object-cover"
                />
                <div className="min-w-0">
                  <div className="truncate font-medium">{p?.title || p?.name || "-"}</div>
                  <div className="text-xs text-muted-foreground">
                    Rs {fmtAmt(p?.price ?? p?.salePrice ?? p?.finalPrice ?? 0)}
                  </div>
                </div>
              </div>
            ))}
            {topProducts.length === 0 && <div className="text-sm text-muted-foreground">No products.</div>}
          </div>
        </div>
      </div>
    </div>
    
  );
}

/* ---------- Feature tiles ---------- */
function FeatureTiles({ imgs }) {
  const tiles = [
    { key:"products", label: "Products", to: "/admin/products", img: imgs.products, icon: <Package className="h-6 w-6" />, gradient: "from-indigo-100/60 to-white" },
    { key:"orders",   label: "Orders",   to: "/admin/orders",   img: imgs.orders,   icon: <ShoppingCart className="h-6 w-6" />, gradient: "from-sky-100/60 to-white" },
    { key:"users",    label: "Users",    to: "/admin/users",    img: imgs.users,    icon: <Users className="h-6 w-6" />, gradient: "from-emerald-100/60 to-white" },
    { key:"payments", label: "Payments", to: "/admin/payments", img: imgs.payments, icon: <CreditCard className="h-6 w-6" />, gradient: "from-amber-100/60 to-white" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {tiles.map((t) => (
        <Link
          key={t.label}
          to={t.to}
          className={`group relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br ${t.gradient}`}
        >
          <div className="absolute inset-0">
            <img
              src={t.img}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              alt=""
              className="h-full w-full object-cover opacity-20 group-hover:opacity-30 transition-opacity"
            />
          </div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 backdrop-blur">
              {t.icon}
            </div>
            <div>
              <div className="text-base font-semibold">{t.label}</div>
              <div className="text-xs text-muted-foreground">Open {t.label.toLowerCase()}</div>
            </div>
          </div>
        </Link>
      ))}
      {/* quick access to full Images manager */}
      <Link
        to="/admin/images"
        className="group relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br from-slate-100/60 to-white"
      >
        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/80 backdrop-blur">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-base font-semibold">Images</div>
            <div className="text-xs text-muted-foreground">Upload/manage dashboard tiles</div>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ---------- small UI bits ---------- */
function CardStat({ title, value, hint, gradient = "from-slate-50 to-white" }) {
  return (
    <div className={`rounded-2xl border p-4 bg-gradient-to-br ${gradient}`}>
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint ? <div className="text-xs text-slate-500 mt-1">{hint}</div> : null}
    </div>
  );
}
function Badge({ children, tone = "slate" }) {
  const map = {
    slate: "bg-slate-100 text-slate-800",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-rose-100 text-rose-800",
    blue: "bg-sky-100 text-sky-800",
    violet: "bg-violet-100 text-violet-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${map[tone] || map.slate}`}>
      {children || "-"}
    </span>
  );
}
function pickPay(s = "") {
  const v = String(s || "").toUpperCase();
  if (v === "PAID") return "green";
  if (v === "PENDING") return "amber";
  if (v === "FAILED") return "red";
  if (v === "REFUNDED") return "violet";
  return "slate";
}
function pickOrder(s = "") {
  const v = String(s || "").toUpperCase();
  if (v === "CONFIRMED" || v === "DELIVERED") return "green";
  if (v === "PENDING" || v === "PROCESSING" || v === "OUT_FOR_DELIVERY") return "amber";
  if (v === "CANCELLED") return "red";
  if (v === "SHIPPED") return "blue";
  return "slate";
}