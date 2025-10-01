import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Badge } from "../ui/badge";
import { DialogContent } from "../ui/dialog";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Download } from "lucide-react"; // optional icon (shadcn/lucide)

// use relative path (safest across machines)
import { exportOrderInvoicePDF } from "../../utils/pdf/orderPdf";

function ShoppingOrderDetailsView({ orderDetails }) {
  const { user } = useSelector((state) => state.auth);

  // —— helpers ————————————————————————————————————————
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
    orderDetails?.orderStatus === "confirmed"
      ? "bg-green-600"
      : orderDetails?.orderStatus === "shipped"
      ? "bg-blue-600"
      : orderDetails?.orderStatus === "delivered"
      ? "bg-emerald-600"
      : orderDetails?.orderStatus === "rejected"
      ? "bg-red-600"
      : orderDetails?.orderStatus === "cancelled"
      ? "bg-zinc-600"
      : "bg-black";

  const handleDownload = () => {
    if (!orderDetails?._id) return;
    try {
      exportOrderInvoicePDF(orderDetails, { brandName: "Shopify" });
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Couldn't download PDF. Check console for details.");
    }
  };

  // Defensive: if dialog opened before data arrives
  if (!orderDetails) {
    return (
      <DialogContent className="sm:max-w-[600px]">
        <div className="py-10 text-center text-muted-foreground">
          Loading order…
        </div>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-[640px]">
      <div className="grid gap-6">
        {/* Header row with Download button */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-6">
            <div>
              <p className="font-medium">Order ID</p>
              <Label className="font-mono text-xs">{orderDetails?._id}</Label>
            </div>
            <Badge className={`py-1 px-3 ${statusColor}`}>
              {orderDetails?.orderStatus ?? "pending"}
            </Badge>
          </div>

          <Button onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
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
                      item?.productId ||
                      item?._id ||
                      `${item?.title || "item"}-${idx}`;
                    const price = Number(item?.price ?? 0);
                    const qty = Number(item?.quantity ?? 1);
                    return (
                      <li
                        key={key}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="truncate max-w-[48%]">
                          <span className="text-muted-foreground">Title: </span>
                          {item?.title || "-"}
                        </span>
                        <span>
                          <span className="text-muted-foreground">
                            Quantity:{" "}
                          </span>
                          {qty}
                        </span>
                        <span>
                          <span className="text-muted-foreground">Price: </span>
                          {LKR(price)}
                        </span>
                        <span className="font-medium">
                          <span className="text-muted-foreground">Total: </span>
                          {LKR(price * qty)}
                        </span>
                      </li>
                    );
                  })
                : (
                  <li className="text-muted-foreground">No items found.</li>
                )}
            </ul>
          </div>
        </div>

        {/* Shipping */}
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="font-medium">Shipping Info</div>
            <div className="grid gap-0.5 text-muted-foreground">
              <span>
                {orderDetails?.addressInfo?.name ||
                  user?.userName ||
                  "-"}
              </span>
              <span>{orderDetails?.addressInfo?.address || "-"}</span>
              <span>{orderDetails?.addressInfo?.city || "-"}</span>
              <span>{orderDetails?.addressInfo?.pincode || "-"}</span>
              <span>{orderDetails?.addressInfo?.phone || "-"}</span>
              <span>{orderDetails?.addressInfo?.notes || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  );
}

export default ShoppingOrderDetailsView;
