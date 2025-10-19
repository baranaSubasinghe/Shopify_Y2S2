const cron = require("node-cron");
const Product = require("../models/Product");
const Notification = require("../models/Notification");

const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 5);

// map common stock field names -> numeric
function readStock(p) {
  const candidates = [
    p?.totalStock, p?.stock, p?.quantity, p?.qty, p?.inventory, p?.count,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function upsertLowStockNotice(p, stock) {
  // If there is an unread LOW_STOCK for this product, skip to avoid spam
  const existing = await Notification.findOne({
    type: "LOW_STOCK",
    productId: p._id,
    isRead: false,
  }).lean();

  if (existing) return;

  await Notification.create({
    type: "LOW_STOCK",
    title: `Low stock: ${p.title || p.name || p._id}`,
    message: `${p.title || p.name || "Product"} has only ${stock} left (≤ ${threshold}).`,
    productId: p._id,
    meta: { stock, threshold },
    link: `/admin/products?highlight=${p._id}`, // optional deep link
  });
}

async function scanLowStock() {
  // Pull only fields we need; don’t assume field name for stock
  const products = await Product.find({})
    .select("_id title name totalStock stock quantity qty")
    .lean();

  let created = 0;
  for (const p of products) {
    const s = readStock(p);
    if (s <= threshold) {
      await upsertLowStockNotice(p, s);
      created++;
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[low-stock] scan complete. Notices created: ${created}`);
  }
}

function start() {
  // run at boot + every 15 minutes
  scanLowStock().catch((e) => console.error("[low-stock] boot scan", e));
  cron.schedule("*/15 * * * *", () => {
    scanLowStock().catch((e) => console.error("[low-stock] cron", e));
  });
}

module.exports = { start, scanLowStock };