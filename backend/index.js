const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const linksRouter = require("./routes/links");
const paymentsRouter = require("./routes/payments");
const profilesRouter = require("./routes/profiles");
const arcscanRouter = require("./routes/arcscan");
const paymePinRouter = require("./routes/paymePin");
const authRouter = require("./routes/auth");
const { router: walletsRouter, setSupabase: setWalletSupabase } = require("./routes/wallets");
const { setSupabase: setPayMePinSupabase } = require("./services/paymePinService");
const { supabase } = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== "production";

// Core middleware shared by all API routes.
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

// General limiter for all API routes.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 10_000 : 1000,
  skip: (req) => req.path === "/health",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

// Stricter limiter for username claiming.
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDevelopment ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many username claims from this IP. Try again in an hour." },
});

// Moderate limiter for payment link creation.
const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 300 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many links created. Please slow down." },
});

app.use("/api/", generalLimiter);
app.post("/api/profiles", claimLimiter);
app.use("/api/links", linkLimiter);

app.use("/api/links", linksRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/profiles", profilesRouter);
app.use("/api/arcscan", arcscanRouter);
app.use("/api/auth", authRouter);
app.use("/api/payme-pin", paymePinRouter);
app.use("/api/wallets", walletsRouter);

setWalletSupabase(supabase);
setPayMePinSupabase(supabase);

// Proxy Circle balance requests when browser CORS blocks direct calls.
app.post("/api/proxy-balances", async (req, res) => {
  try {
    const response = await fetch("https://gateway-api-testnet.circle.com/v1/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Failed to fetch from Circle API" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Cavopay API running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
