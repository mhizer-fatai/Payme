const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const linksRouter = require("./routes/links");
const paymentsRouter = require("./routes/payments");
const profilesRouter = require("./routes/profiles");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
// General limiter — all API routes
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in 15 minutes." },
});

// Strict limiter — username claiming (prevents mass username squatting)
const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many username claims from this IP. Try again in an hour." },
});

// Moderate limiter — payment link creation
const linkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many links created. Please slow down." },
});

app.use("/api/", generalLimiter);
app.use("/api/profiles", claimLimiter);
app.use("/api/links", linkLimiter);

// ─── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/links", linksRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/profiles", profilesRouter);

// Proxy Circle Balance API (fallback for browser CORS issues)
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

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`✅ PayMe API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
