import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchMyOrders } from "@/store/shop/order-slice";
import { Button } from "@/components/ui/button";

const fmtAmt = (n) =>
  Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2 });
const safeDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleString();
};
const tone = (s = "") => {
  const v = String(s).toUpperCase();
  if (v === "PAID") return "bg-emerald-100 text-emerald-800";
  if (v === "PENDING") return "bg-amber-100 text-amber-800";
  if (v === "FAILED") return "bg-rose-100 text-rose-800";
  if (v === "REFUNDED") return "bg-violet-100 text-violet-800";
  return "bg-slate-100 text-slate-800";
};

export default function ShoppingOrders() {
  const dispatch = useDispatch();
  const { orderList, listStatus,error } = useSelector((s) => s.shopOrder);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  const refresh = () => dispatch(fetchMyOrders());

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-medium">My Orders</h3>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

     <div className="overflow-x-auto">
  <table className="w-full text-sm text-slate-700 border-collapse">
    <thead className="bg-slate-50 text-slate-600 uppercase text-xs tracking-wide">
      <tr>
        <th className="p-3 text-left w-[20%]">Order</th>
        <th className="p-3 text-right w-[15%]">Amount</th>
        <th className="p-3 text-center w-[15%]">Payment</th>
        <th className="p-3 text-center w-[15%]">Status</th>
        <th className="p-3 text-right w-[20%]">Date</th>
      </tr>
    </thead>

    <tbody>
      {listStatus === "loading" && (
        <tr>
          <td className="p-5 text-center text-muted-foreground" colSpan={5}>
            Loading…
          </td>
        </tr>
      )}

      {listStatus !== "loading" && orderList.length === 0 && (
        <tr>
          <td className="p-5 text-center text-muted-foreground" colSpan={5}>
            {error || "No orders yet."}
          </td>
        </tr>
      )}

      {orderList.map((o) => (
        <tr
          key={o._id}
          className="border-b hover:bg-slate-50 transition-all duration-150"
        >
          <td className="p-3 font-mono text-slate-900 truncate align-middle">
            #{o._id?.slice(-8) || "-"}
          </td>
          <td className="p-3 text-right font-semibold align-middle">
            Rs {fmtAmt(o.totalAmount)}
          </td>
          <td className="p-3 text-center align-middle">
            <span className="inline-block px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              {o.paymentMethod || "-"}
            </span>
          </td>
          <td className="p-3 text-center align-middle">
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${tone(
                o.paymentStatus
              )}`}
            >
             {(o.paymentStatus || "-").toUpperCase()}
            </span>
          </td>
          <td className="p-3 text-right text-slate-600 align-middle">
            {safeDate(o.orderDate || o.createdAt)}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
    </div>
  );
}