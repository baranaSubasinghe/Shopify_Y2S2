import { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input"; // If you don't have this, swap for a plain <input />
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import ShoppingOrderDetailsView from "./order-details";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllOrdersByUserId,
  getOrderDetails,
  resetOrderDetails,
} from "@/store/shop/order-slice";
import { Badge } from "../ui/badge";

function ShoppingOrders() {
  const [openDetailsDialog, setOpenDetailsDialog] = useState(false);
  const [query, setQuery] = useState(""); // search text

  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { orderList, orderDetails } = useSelector((state) => state.shopOrder);

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

  // ✅ Works whether your user object has _id or id
  useEffect(() => {
    const uid = user?._id || user?.id;
    if (uid) {
      dispatch(getAllOrdersByUserId(uid));
    }
  }, [dispatch, user?._id, user?.id]);

  useEffect(() => {
    if (orderDetails) setOpenDetailsDialog(true);
  }, [orderDetails]);

  function handleFetchOrderDetails(id) {
    dispatch(getOrderDetails(id));
  }

  // Case-insensitive local filter (id / status / date)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderList || [];
    return (orderList || []).filter((o) => {
      const id = String(o?._id || "").toLowerCase();
      const status = String(o?.orderStatus || "").toLowerCase();
      const date = safeDate(o?.orderDate).toLowerCase();
      return id.includes(q) || status.includes(q) || date.includes(q);
    });
  }, [orderList, query]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Order History</CardTitle>
        <div className="w-full max-w-sm">
          {/* If you don't have shadcn Input, replace with: 
              <input className="border h-9 px-3 rounded-md w-full" ... /> */}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, status, or date…"
          />
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
            {Array.isArray(filtered) && filtered.length > 0 ? (
              filtered.map((orderItem) => (
                <TableRow key={orderItem?._id}>
                  <TableCell className="font-mono text-xs">
                    {orderItem?._id}
                  </TableCell>

                  <TableCell>{safeDate(orderItem?.orderDate)}</TableCell>

                  <TableCell>
                    <Badge
                      className={`py-1 px-3 ${
                        orderItem?.orderStatus === "confirmed"
                          ? "bg-green-500"
                          : orderItem?.orderStatus === "rejected"
                          ? "bg-red-600"
                          : orderItem?.orderStatus === "shipped"
                          ? "bg-blue-600"
                          : orderItem?.orderStatus === "delivered"
                          ? "bg-emerald-600"
                          : "bg-black"
                      }`}
                    >
                      {orderItem?.orderStatus}
                    </Badge>
                  </TableCell>

                  <TableCell>{LKR(orderItem?.totalAmount)}</TableCell>

                  <TableCell>
                    <Dialog
                      open={openDetailsDialog}
                      onOpenChange={() => {
                        setOpenDetailsDialog(false);
                        dispatch(resetOrderDetails());
                      }}
                    >
                      <Button onClick={() => handleFetchOrderDetails(orderItem?._id)}>
                        View Details
                      </Button>
                      <ShoppingOrderDetailsView orderDetails={orderDetails} />
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {query ? "No matches." : "No orders yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default ShoppingOrders;
