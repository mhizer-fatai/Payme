const express = require("express");

const router = express.Router();
const ARCSCAN_API_BASE = "https://testnet.arcscan.app/api";

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

async function fetchArcscan(params) {
  const url = `${ARCSCAN_API_BASE}?${new URLSearchParams(params).toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = new Error(payload?.message || `Arcscan API ${response.status}`);
    error.status = response.status;
    error.data = payload;
    throw error;
  }
  return payload;
}

router.get("/token-balance", async (req, res) => {
  try {
    const { address, contractaddress } = req.query;
    if (!isAddress(address) || !isAddress(contractaddress)) {
      return res.status(400).json({ error: "Valid address and contractaddress are required" });
    }

    const payload = await fetchArcscan({
      module: "account",
      action: "tokenbalance",
      address: String(address),
      contractaddress: String(contractaddress),
    });
    return res.json(payload);
  } catch (err) {
    console.error("Arcscan token balance proxy error:", err.data || err.message || err);
    return res.status(err.status || 502).json({ error: "Failed to fetch token balance" });
  }
});

router.get("/native-balance", async (req, res) => {
  try {
    const { address } = req.query;
    if (!isAddress(address)) {
      return res.status(400).json({ error: "Valid address is required" });
    }

    const payload = await fetchArcscan({
      module: "account",
      action: "balance",
      address: String(address),
    });
    return res.json(payload);
  } catch (err) {
    console.error("Arcscan native balance proxy error:", err.data || err.message || err);
    return res.status(err.status || 502).json({ error: "Failed to fetch native balance" });
  }
});

router.get("/token-transfers", async (req, res) => {
  try {
    const { address, contractaddress } = req.query;
    if (!isAddress(address) || !isAddress(contractaddress)) {
      return res.status(400).json({ error: "Valid address and contractaddress are required" });
    }

    const payload = await fetchArcscan({
      module: "account",
      action: "tokentx",
      address: String(address),
      contractaddress: String(contractaddress),
    });
    return res.json(payload);
  } catch (err) {
    console.error("Arcscan token transfers proxy error:", err.data || err.message || err);
    return res.status(err.status || 502).json({ error: "Failed to fetch token transfers" });
  }
});

module.exports = router;
