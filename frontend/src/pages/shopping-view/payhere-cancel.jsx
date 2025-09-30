import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function PayHereCancel() {
  const { search } = useLocation();
  const orderId = new URLSearchParams(search).get("orderId");
  const navigate = useNavigate();

  useEffect(() => {
    toast("Payment cancelled");
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-xl font-semibold">Payment cancelled</h1>
      {orderId && <p className="text-sm text-muted-foreground">Order <code>{orderId}</code> was not completed.</p>}
      <button className="mt-4 btn" onClick={() => navigate("/cart")}>Back to cart</button>
    </div>
  );
}
