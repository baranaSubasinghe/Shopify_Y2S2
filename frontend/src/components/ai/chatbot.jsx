import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

const PLACEHOLDER =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'><rect width='100%' height='100%' fill='%23f3f4f6'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='18'>No image</text></svg>";

function buildImageUrl(p) {
  const direct =
    p.images?.[0]?.secure_url ||
    p.images?.[0]?.url ||
    (typeof p.images?.[0] === "string" ? p.images[0] : null) ||
    p.image ||
    p.thumbnail ||
    p.cover;

  if (typeof direct === "string" && /^https?:\/\//i.test(direct)) return direct;

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const publicId =
    (typeof direct === "string" && direct) ||
    p.images?.[0]?.public_id ||
    p.public_id;

  if (cloudName && publicId && typeof publicId === "string") {
    return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${publicId}.jpg`;
  }
  return PLACEHOLDER;
}

function PriceRow({ price, salePrice }) {
  const p = typeof price === "number" ? price : null;
  const s = typeof salePrice === "number" ? salePrice : null;
  const hasSale = s != null && s > 0 && p != null && s < p;

  if (hasSale) {
    return (
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-emerald-600 font-semibold">Rs. {s}</span>
        <span className="text-gray-400 line-through">Rs. {p}</span>
        <span className="ml-auto text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Sale</span>
      </div>
    );
  }
  return (
    <div className="mt-1 font-semibold">
      {p != null ? `Rs. ${p}` : <span className="text-gray-400">—</span>}
    </div>
  );
}

export default function AiChatbot() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // ⬇️ include filters in local state
  const [reply, setReply] = useState({ summary: "", items: [], filters: {} });
  const navigate = useNavigate();

  const api = useMemo(() => import.meta.env.VITE_API_URL || "http://localhost:5001", []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPop = () => { if (location.hash !== "#chat") setOpen(false); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function openModal() {
    setOpen(true);
    if (location.hash !== "#chat") history.pushState({ chat: true }, "", "#chat");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    setOpen(false);
    document.body.style.overflow = "";
    if (location.hash === "#chat") history.back();
  }

  async function send() {
    const q = message.trim();
    if (!q || loading) return; 
    setLoading(true);
    try {
      const { data } = await axios.post(`${api}/api/ai/recommend`, { message: q, limit: 6 });
      if (!data?.success) throw new Error(data?.message || "Failed");
      // ⬇️ keep filters from backend so chips render
      setReply({
        summary: data.summary || "",
        items: data.items || [],
        filters: data.filters || {},
      });
    } catch (e) {
      console.error("[AI] error:", e?.response?.data || e);
      toast.error(e?.response?.data?.message || "AI recommend failed");
      setReply({ summary: "", items: [], filters: {} });
    } finally {
      setLoading(false);
    }
  }

  function handleViewProduct(p) {
    const id = p._id || p.id;
    if (!id) return toast.error("Product not found");
    window.location.href = `/shop/listing?open=${id}`;
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={openModal}
        className="fixed bottom-5 right-5 rounded-full shadow-lg px-4 py-3 bg-primary text-white hover:opacity-90 z-40"
      >
        Ask for products
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />

          <div className="relative w-full sm:max-w-3xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold">Product Finder</div>
              <button onClick={closeModal} className="rounded px-2 py-1 hover:bg-gray-100">✕</button>
            </div>

            {/* Search row */}
            <div className="p-4 flex gap-2">
              <input
                className="flex-1 border rounded px-3 py-2"
                placeholder="e.g., red hoodie under 3000"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
              />
              <button
                onClick={send}
                disabled={loading}
                className="px-4 py-2 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Thinking..." : "Find"}
              </button>
            </div>

            {/* ⬇️ FILTER CHIPS – place right under the search row */}
            {(reply?.filters &&
              (reply.filters.q ||
                reply.filters.colors?.length ||
                reply.filters.categories?.length ||
                reply.filters.minPrice ||
                reply.filters.maxPrice)) && (
              <div className="px-4 pb-2 flex flex-wrap gap-2 text-xs text-gray-600">
                {reply.filters.q && (
                  <span className="px-2 py-1 bg-gray-100 rounded">q: {reply.filters.q}</span>
                )}
                {reply.filters.colors?.map((c) => (
                  <span key={`c-${c}`} className="px-2 py-1 bg-gray-100 rounded">
                    color: {c}
                  </span>
                ))}
                {reply.filters.categories?.map((c) => (
                  <span key={`cat-${c}`} className="px-2 py-1 bg-gray-100 rounded">
                    category: {c}
                  </span>
                ))}
                {(reply.filters.minPrice || reply.filters.maxPrice) && (
                  <span className="px-2 py-1 bg-gray-100 rounded">
                    {reply.filters.minPrice ? `min ${reply.filters.minPrice}` : ""}
                    {reply.filters.maxPrice ? `  max ${reply.filters.maxPrice}` : ""}
                  </span>
                )}
              </div>
            )}

            {/* Optional summary */}
            {reply.summary && <p className="px-4 text-sm text-gray-600">{reply.summary}</p>}

            {/* Results */}
            <div className="p-4 overflow-y-auto max-h-[60vh] grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reply.items.map((p) => {
                const img = buildImageUrl(p);
                return (
                  <div key={p._id || p.id} className="border rounded-xl overflow-hidden">
                    <div className="w-full h-44 bg-gray-50">
                      <img
                        src={img}
                        alt={p.title || p.name}
                        className="w-full h-44 object-cover"
                        onError={(e) => (e.currentTarget.src = PLACEHOLDER)}
                      />
                    </div>
                    <div className="p-3">
                      <div className="font-medium line-clamp-1">{p.title || p.name}</div>
                      <div className="text-xs text-gray-500 line-clamp-1">
                        {p.category || p.categories?.[0] || p.type || "—"}
                      </div>
                      <PriceRow price={p.price} salePrice={p.salePrice} />
                      <button
                        onClick={() => handleViewProduct(p)}
                        className="mt-2 w-full rounded bg-primary text-white py-2 hover:opacity-90"
                      >
                        View Product
                      </button>
                    </div>
                  </div>
                );
              })}

              {!loading && reply.items.length === 0 && (
                <p className="text-sm text-gray-500">Try: “black sneakers under 5000”.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}