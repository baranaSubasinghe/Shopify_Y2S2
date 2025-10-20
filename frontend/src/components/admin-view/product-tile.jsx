// frontend/src/components/admin-view/product-card.jsx
import { useState } from "react";
import { Button } from "@/components/ui/button";

const LOW_STOCK_THRESHOLD = Number(import.meta.env.VITE_LOW_STOCK_THRESHOLD || 5);

export default function AdminProductCard({
  product,
  onEdit = () => {},
  onDelete = () => {},
}) {
  const [busy, setBusy] = useState(false);

  const {
    _id,
    title = "Untitled",
    image,
    price = 0,
    salePrice = 0,
    totalStock = 0,
  } = product || {};

  const lowStock = Number(totalStock) <= LOW_STOCK_THRESHOLD;

  const handleEdit = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onEdit(product);
  };

  const handleDelete = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!_id) return;

    const ok = window.confirm("Delete this product? This cannot be undone.");
    if (!ok) return;

    try {
      setBusy(true);
      await onDelete(_id); // parent should perform API call
    } finally {
      setBusy(false);
    }
  };

  const displayPrice =
    Number(salePrice) > 0 ? Number(salePrice) : Number(price);

  return (
    <div
      className={[
        "rounded-xl border shadow-sm overflow-hidden transition-colors",
        lowStock ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-white",
      ].join(" ")}
      role="article"
      aria-label={title}
    >
      {/* image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={image || "/placeholder.svg"}
          alt={title}
          className="h-full w-full object-cover object-center"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "/placeholder.svg";
          }}
        />
      </div>

      {/* content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="font-semibold leading-snug line-clamp-2"
            title={title}
          >
            {title}
          </h3>

          {/* Low stock badge */}
          {lowStock && (
            <span
              className="shrink-0 rounded-full bg-rose-100 text-rose-700 text-xs font-medium px-2 py-0.5"
              title={`Only ${totalStock} left`}
            >
              Low stock ({totalStock})
            </span>
          )}
        </div>

        {/* prices */}
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">
            Rs. {displayPrice.toLocaleString("en-LK")}
          </span>
          {Number(salePrice) > 0 && (
            <span className="text-slate-400 line-through text-sm">
              Rs. {Number(price).toLocaleString("en-LK")}
            </span>
          )}
        </div>

        {/* stock row */}
        <div className="text-xs text-slate-500">
          Stock:{" "}
          <b className={lowStock ? "text-rose-700" : "text-slate-700"}>
            {totalStock}
          </b>
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            onClick={handleEdit}
            disabled={busy}
          >
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleDelete}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}