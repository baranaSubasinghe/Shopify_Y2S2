import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function MarkCodCollectedButton({ order, onDone, className = "" }) {
  const isCOD = String(order?.paymentMethod || "").toLowerCase() === "cod";
  const alreadyPaid = String(order?.paymentStatus || "").toUpperCase() === "PAID";
  if (!isCOD || alreadyPaid) return null;

  const onClick = async () => {
    try {
      const { data } = await axios.patch(
        `${API}/api/delivery/orders/${order._id}/cod-collected`,
        {},
        { withCredentials: true }
      );
      if (data?.success) {
        toast.success("COD marked as collected");
        onDone?.();
      } else {
        toast.error(data?.message || "Failed to mark COD collected");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Request failed");
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      className={`h-7 px-2 text-xs border-slate-300 hover:bg-slate-50 ${className}`}
      title="Mark COD collected"
    >
      Collected
    </Button>
  );
}