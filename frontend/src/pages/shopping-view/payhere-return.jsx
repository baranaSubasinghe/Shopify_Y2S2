import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function PayHereReturn() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");

  // We rely on IPN to finalize status. This page is just a friendly stop.
  useEffect(() => {
    // you could poll /details/:id here if you want live status
  }, [orderId]);

  return (
    <Card className="max-w-lg mx-auto mt-10">
      <CardHeader>
        <CardTitle>Thanks! Processing your payment…</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Order ID: {orderId}</p>
        <p className="mb-6">
          You can view the order details once we confirm your payment.
        </p>
        <Link to={`/orders/${orderId}`} className="underline">
          Go to Order Details
        </Link>
      </CardContent>
    </Card>
  );
}
