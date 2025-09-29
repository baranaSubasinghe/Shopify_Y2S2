import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useSearchParams, Link } from "react-router-dom";

export default function PayHereCancel() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");

  return (
    <Card className="max-w-lg mx-auto mt-10">
      <CardHeader>
        <CardTitle>Payment was cancelled</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Order ID: {orderId}</p>
        <Link to="/cart" className="underline">Back to cart</Link>
      </CardContent>
    </Card>
  );
}
