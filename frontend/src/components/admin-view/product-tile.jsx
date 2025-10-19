// frontend/src/components/admin-view/product-card.jsx
import { Button } from "@/components/ui/button";

const LOW_STOCK_THRESHOLD =
  Number(import.meta.env.VITE_LOW_STOCK_THRESHOLD || 5);

export default function AdminProductCard({ product, onEdit, onDelete }) {
  const {
    _id,
    title,
    image,
    price,
    salePrice,
    totalStock = 0,
  } = product || {};

  const lowStock = Number(totalStock) <= LOW_STOCK_THRESHOLD;

  return (
    <div
      className={[
        "rounded-xl border shadow-sm overflow-hidden transition-colors",
        lowStock ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      {/* image */}
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover object-center"
          loading="lazy"
        />
      </div>

      {/* content */}
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug line-clamp-2">{title}</h3>

          {/* Low stock badge */}
          {lowStock && (
            <span className="shrink-0 rounded-full bg-rose-100 text-rose-700 text-xs font-medium px-2 py-0.5">
              Low stock ({totalStock})
            </span>
          )}
        </div>

        {/* prices */}
        <div className="flex items-baseline gap-2">
          {Number(salePrice) > 0 ? (
            <>
              <span className="font-semibold">
                Rs. {Number(salePrice).toLocaleString("en-LK")}
              </span>
              <span className="text-slate-400 line-through text-sm">
                Rs. {Number(price).toLocaleString("en-LK")}
              </span>
            </>
          ) : (
            <span className="font-semibold">
              Rs. {Number(price).toLocaleString("en-LK")}
            </span>
          )}
        </div>

        {/* stock row (optional) */}
        <div className="text-xs text-slate-500">
          Stock: <b className={lowStock ? "text-rose-700" : "text-slate-700"}>{totalStock}</b>
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" onClick={() => onEdit?.(product)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => onDelete?.(_id)}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}