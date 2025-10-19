// backend/server.js
require("dotenv").config(); 

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

/* -------- Routers -------- */
const userAccountRouter   = require("./routes/user/account-routes");
const adminReviewsRouter  = require("./routes/admin/reviews-routes");
const authRouter          = require("./routes/auth/auth-routes");
const adminProductsRouter = require("./routes/admin/products-routes");
const adminOrderRouter    = require("./routes/admin/order-routes");
const adminUsersRouter    = require("./routes/admin/users-routes");
const shopProductsRouter  = require("./routes/shop/products-routes");
const shopCartRouter      = require("./routes/shop/cart-routes");
const shopAddressRouter   = require("./routes/shop/address-routes");
const shopOrderRouter     = require("./routes/shop/order-routes");
const shopSearchRouter    = require("./routes/shop/search-routes");
const shopReviewRouter    = require("./routes/shop/review-routes");
const commonFeatureRouter = require("./routes/common/feature-routes");
const adminPaymentRouter  = require("./routes/admin/payment-routes");
const shopPaymentRouter   = require("./routes/shop/payment-routes"); // PayHere IPN

const deliveryOrdersRouter = require("./routes/delivery/order-routes");
const aiRouter = require("./routes/common/ai-routes");


/* -------- Config -------- */
const PORT        = Number(process.env.PORT || 5001);
const MONGODB_URI = process.env.MONGODB_URI;
const DBNAME      = process.env.MONGODB_DBNAME || "shopify";

if (!MONGODB_URI) {
  console.error("❌ Set MONGODB_URI in backend/.env");
  process.exit(1);
}

/* -------- DB -------- */
mongoose.set("strictQuery", true);
(async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: DBNAME,
      serverSelectionTimeoutMS: 10_000,
      family: 4, // prefer IPv4 on some networks
    });
    console.log(`✅ MongoDB connected (db: ${DBNAME})`);
  } catch (err) {
    console.error("❌ Mongo error:", err?.message || err);
    process.exit(1);
  }
})();

/* -------- App -------- */
const app = express();

/* -------- Allowed origins -------- */
const ALLOWED_ORIGINS = new Set(
  [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    process.env.ADMIN_URL,
    process.env.FRONTEND_URL,
    process.env.APP_BASE_URL,
  ].filter(Boolean)
);

/* -------- Manual preflight -------- */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Cache-Control, Expires, Pragma"
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

/* -------- cors() -------- */
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, ALLOWED_ORIGINS.has(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Expires", "Pragma"],
  })
);

/* -------- Parsers -------- */
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true })); // needed for PayHere IPN (form-encoded)

/* -------- Health (place BEFORE 404 catcher) -------- */
/* -------- Routes -------- */
app.use("/api/auth", authRouter);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/reviews", adminReviewsRouter);
app.use("/api/admin/payments", adminPaymentRouter);
app.use("/api/user/account", userAccountRouter);

app.use("/api/shop/products", shopProductsRouter);
app.use("/api/shop/cart", shopCartRouter);
app.use("/api/shop/address", shopAddressRouter);
app.use("/api/shop/order", shopOrderRouter);
app.use("/api/shop/search", shopSearchRouter);
app.use("/api/shop/review", shopReviewRouter);
app.use("/api/common/feature", commonFeatureRouter);
app.use("/api/delivery/orders", deliveryOrdersRouter);
app.use("/api/admin/orders", require("./routes/admin/order-routes"));
app.use("/api/delivery/orders", require("./routes/delivery/order-routes"));
app.use("/api/shop/order", require("./routes/shop/order-routes"));
app.use("/api/ai", aiRouter);


/* -------- Health -------- */
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), env: process.env.NODE_ENV || "dev", db: DBNAME })
);
app.get("/health", (_req, res) => res.json({ ok: true }));

/* -------- Routes -------- */
app.use("/api/auth",             authRouter);
app.use("/api/admin/products",   adminProductsRouter);
app.use("/api/admin/orders",     adminOrderRouter);
app.use("/api/admin/users",      adminUsersRouter);
app.use("/api/admin/reviews",    adminReviewsRouter);
app.use("/api/admin/payments",   adminPaymentRouter);
app.use("/api/user/account",     userAccountRouter);

app.use("/api/shop/products",    shopProductsRouter);
app.use("/api/shop/cart",        shopCartRouter);
app.use("/api/shop/address",     shopAddressRouter);
app.use("/api/shop/order",       shopOrderRouter);
app.use("/api/shop/search",      shopSearchRouter);
app.use("/api/shop/review",      shopReviewRouter);
app.use("/api/common/feature",   commonFeatureRouter);
app.use("/api/shop/payment",     shopPaymentRouter); // exposes /payhere/ipn

/* -------- 404 for /api (place AFTER real routes) -------- */
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }
  next();
});

/* -------- Error handler (last) -------- */
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error." });
});

/* -------- Process safety -------- */
process.on("unhandledRejection", (r) => console.error("🛑 Unhandled Rejection:", r));
process.on("uncaughtException", (e) => console.error("🛑 Uncaught Exception:", e));

/* -------- Listen -------- */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🩺 Health: http://localhost:${PORT}/api/health`);
});
