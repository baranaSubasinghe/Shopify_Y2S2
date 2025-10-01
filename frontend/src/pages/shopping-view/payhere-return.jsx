import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { getAllOrdersByUserId } from "@/store/shop/order-slice";
//import { getOrderById } from "@/store/shop/order-slice"; // adjust import if path differs

export default function PayHereReturn() {
  const { search } = useLocation();
  const orderId = new URLSearchParams(search).get("orderId");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!orderId) {
      toast.error("Missing orderId");
      navigate("/cart");
      return;
    }
    dispatch(getAllOrdersByUserId(orderId))
      .unwrap()
      .then((res) => {
        if (res?.data?.paymentStatus === "paid") {
          toast.success("Payment successful");
        } else {
          toast("Payment is being verified…");
        }
      })
      .catch(() => {});
  }, [orderId]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-semibold">Thank you!</h1>
      <p className="text-sm text-muted-foreground">
        We’re finalizing your order. You can view it in{" "}
        <button className="underline" onClick={() => navigate("/shop/account")}>
          My Orders
        </button>.
      </p>
    </div>
  );
}
