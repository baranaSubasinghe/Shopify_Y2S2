import { useMemo, useState } from "react";
import CommonForm from "../common/form";
import { DialogContent } from "../ui/dialog";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useDispatch, useSelector } from "react-redux";
import {
  getAllOrdersForAdmin,
  getOrderDetailsForAdmin,
  updateOrderStatus,
} from "@/store/admin/order-slice";
import { toast } from "sonner";

// ⬇️ PDF helper (relative path is safest)
import { exportOrderInvoicePDF } from "../../utils/pdf/orderPdf";

const initialFormData = { status: "" };

function AdminOrderDetailsView({ orderDetails }) {
  const [formData, setFormData] = useState(initialFormData);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const LKR = (n) => `Rs. ${Number(n ?? 0).toLocaleString("en-LK")}`;

  const safeDate = useMemo(() => {
    try {
      if (!orderDetails?.orderDate) return "-";
      const d = new Date(orderDetails.orderDate);
      return isNaN(d.getTime())
        ? String(orderDetails.orderDate).split("T")?.[0] || "-"
        : d.toISOString().split("T")[0];
    } catch {
      return "-";
    }
  }, [orderDetails?.orderDate]);

  const statusColor =
    orderDetails?.orderStatus === "inProcess"
      ? "bg-amber-600"
      : orderDetails?.orderStatus === "inShipping"
      ? "bg-blue-600"
      : orderDetails?.orderStatus === "delivered"
      ? "bg-emerald-600"
      : orderDetails?.orderStatus === "rejected"
      ? "bg-red-600"
      : "bg-black"; // pending / fallback

  function handleUpdateStatus(e) {
    e.preventDefault();
    const { status } = formData;
    if (!status) {
      toast("Please choose an order status.");
      return;
    }

    dispatch(updateOrderStatus({ id: orderDetails?._id, orderStatus: status }))
      .then((res) => {
        if (res?.payload?.success) {
          dispatch(getOrderDetailsForAdmin(orderDetails?._id));
          dispatch(getAllOrdersForAdmin());
          setFormData(initialFormData);
          toast(res?.payload?.message || "Order status updated");
        }
      })
      .catch(() => toast("Failed to update status"));
  }

  const handleDownload = () => {
    if (!orderDetails?._id) return;
    try {
      exportOrderInvoicePDF(orderDetails, { brandName: "Shopify" });
    } catch (err) {
      console.error("PDF export failed:", err);
      toast("Couldn't download PDF. See console for details.");
    }
  };

  return (
    <DialogContent className="sm:max-w-[700px]">
      <div className="grid gap-6">
        {/* Header: ID + status + download */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-6">
            <div>
              <p className="font-medium">Order ID</p>
              <Label className="font-mono text-xs">
                {orderDetails?._id || "-"}
              </Label>
            </div>
            <Badge className={`py-1 px-3 ${statusColor}`}>
              {orderDetails?.orderStatus || "pending"}
            </Badge>
          </div>

          <Button onClick={handleDownload}>Download Invoice (PDF)</Button>
        </div>

        <Separator />

        {/* Meta */}
        <div className="grid gap-2">
          <div className="flex mt-2 items-center justify-between">
            <p className="font-medium">Order Date</p>
            <Label>{safeDate}</Label>
          </div>
          <div className="flex mt-2 items-center justify-between">
            <p className="font-medium">Order Price</p>
            <Label>{LKR(orderDetails?.totalAmount)}</Label>
          </div>
          <div className="flex mt-2 items-center justify-between">
            <p className="font-medium">Payment method</p>
            <Label className="uppercase">
              {orderDetails?.paymentMethod || "-"}
            </Label>
          </div>
          <div className="flex mt-2 items-center justify-between">
            <p className="font-medium">Payment Status</p>
            <Label className="uppercase">
              {orderDetails?.paymentStatus || "-"}
            </Label>
          </div>
        </div>

        <Separator />

        {/* Items */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-medium">Order Details</div>
            <ul className="grid gap-3">
              {Array.isArray(orderDetails?.cartItems) &&
              orderDetails.cartItems.length > 0
                ? orderDetails.cartItems.map((item, idx) => {
                    const key =
                      item?._id ||
                      item?.productId ||
                      `${item?.title || "item"}-${idx}`;
                    const qty = Number(item?.quantity ?? 1);
                    const price = Number(item?.price ?? 0);
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="truncate max-w-[50%]">
                          Title: {item?.title || "-"}
                        </span>
                        <span>Quantity: {qty}</span>
                        <span>Price: {LKR(price)}</span>
                        <span className="font-medium">
                          Total: {LKR(qty * price)}
                        </span>
                      </li>
                    );
                  })
                : <li className="text-muted-foreground">No items.</li>}
            </ul>
          </div>
        </div>

        {/* Shipping */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-medium">Shipping Info</div>
            <div className="grid gap-0.5 text-muted-foreground">
              <span>
                {orderDetails?.addressInfo?.name || user?.userName || "-"}
              </span>
              <span>{orderDetails?.addressInfo?.address || "-"}</span>
              <span>{orderDetails?.addressInfo?.city || "-"}</span>
              <span>{orderDetails?.addressInfo?.pincode || "-"}</span>
              <span>{orderDetails?.addressInfo?.phone || "-"}</span>
              <span>{orderDetails?.addressInfo?.notes || "-"}</span>
            </div>
          </div>
        </div>

        {/* Update status */}
        <div>
          <CommonForm
            formControls={[
              {
                label: "Order Status",
                name: "status",
                componentType: "select",
                options: [
                  { id: "pending", label: "Pending" },
                  { id: "inProcess", label: "In Process" },
                  { id: "inShipping", label: "In Shipping" },
                  { id: "delivered", label: "Delivered" },
                  { id: "rejected", label: "Rejected" },
                ],
              },
            ]}
            formData={formData}
            setFormData={setFormData}
            buttonText={"Update Order Status"}
            onSubmit={handleUpdateStatus}
          />
        </div>
      </div>
    </DialogContent>
  );
}

export default AdminOrderDetailsView;
