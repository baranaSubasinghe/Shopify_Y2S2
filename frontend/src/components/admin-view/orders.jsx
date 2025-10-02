import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import AdminOrderDetailsView from "./order-details";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllOrdersForAdmin,
  getOrderDetailsForAdmin,
  resetOrderDetails,
} from "@/store/admin/order-slice";
import { Badge } from "../ui/badge";

// ⬇️ add this import
import { exportOrdersListPDF } from "../../utils/pdf/adminOrderReports";

function AdminOrdersView() {
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [query, setQuery] = useState(""); // search text
  const { orderList, orderDetails } = useSelector((state) => state.adminOrder);
  const dispatch = useDispatch();

  const LKR = (n) => `Rs. ${Number(n ?? 0).toLocaleString("en-LK")}`;

  const safeDate = (d) => {
    try {
      if (!d) return "-";
      const dt = new Date(d);
      return isNaN(dt.getTime())
        ? String(d).split("T")?.[0] || "-"
        : dt.toISOString().split("T")[0];
    } catch {
      return "-";
    }
  };

  function handleFetchOrderDetails(id) {
    dispatch(getOrderDetailsForAdmin(id));
  }

  useEffect(() => {
    dispatch(getAllOrdersForAdmin());
  }, [dispatch]);

  useEffect(() => {
    if (orderDetails) setOpenDetailsDialog(true);
  }, [orderDetails]);

  // Case-insensitive local filter by: id, status, date, customer, phone, city
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderList || [];
    return (orderList || []).filter((o) => {
      const id = String(o?._id || "").toLowerCase();
      const status = String(o?.orderStatus || "").toLowerCase();
      const date = safeDate(o?.orderDate).toLowerCase();
      const name = String(o?.addressInfo?.name || "").toLowerCase();
      const phone = String(o?.addressInfo?.phone || "").toLowerCase();
      const city = String(o?.addressInfo?.city || "").toLowerCase();
      return (
        id.includes(q) ||
        status.includes(q) ||
        date.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        city.includes(q)
      );
    });
  }, [orderList, query]);

  const statusColor = (s) =>
    s === "confirmed"
      ? "bg-green-600"
      : s === "inProcess"
      ? "bg-amber-600"
      : s === "inShipping"
      ? "bg-blue-600"
      : s === "delivered"
      ? "bg-emerald-600"
      : s === "rejected"
      ? "bg-red-600"
      : "bg-black"; // pending / unknown

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>All Orders</CardTitle>
        <div className="flex items-center gap-2 w-full max-w-lg">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, status, date, customer, phone or city…"
            aria-label="Search orders"
          />
          {/* ⬇️ new: export exactly what's visible */}
          <Button
            variant="outline"
            onClick={() =>
              exportOrdersListPDF(filtered, {
                title: "Orders Report",
                brandName: "Shopify",
              })
            }
          >
            Download PDF (All)
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Order Status</TableHead>
              <TableHead>Order Price</TableHead>
              <TableHead>
                <span className="sr-only">Details</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length ? (
              filtered.map((orderItem) => (
                <TableRow key={orderItem?._id}>
                  <TableCell className="font-mono text-xs">
                    {orderItem?._id}
                  </TableCell>

                  <TableCell>{safeDate(orderItem?.orderDate)}</TableCell>

                  <TableCell>
                    <Badge
                      className={`py-1 px-3 ${statusColor(
                        orderItem?.orderStatus
                      )}`}
                    >
                      {orderItem?.orderStatus || "pending"}
                    </Badge>
                  </TableCell>

                  <TableCell className="font-semibold">
                    {LKR(orderItem?.totalAmount)}
                  </TableCell>

                  <TableCell>
                    <Dialog
                      open={openDetailsDialog}
                      onOpenChange={() => {
                        setOpenDetailsDialog(false);
                        dispatch(resetOrderDetails());
                      }}
                    >
                      <Button
                        onClick={() =>
                          handleFetchOrderDetails(orderItem?._id)
                        }
                      >
                        View Details
                      </Button>
                      <AdminOrderDetailsView orderDetails={orderDetails} />
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  {query ? "No matches." : "No orders available."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default AdminOrdersView;
