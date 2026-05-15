const express = require("express");
const { supabase, memStore } = require("../supabase");
const { v4: uuidv4 } = require("uuid");

const router = express.Router();

// ─── POST /api/payments ───────────────────────────────────────────────────────
// Log a confirmed on-chain payment
router.post("/", async (req, res) => {
  try {
    const { linkId, payerAddress, txHash, amount, token } = req.body;

    if (!linkId || !payerAddress || !txHash) {
      return res.status(400).json({
        error: "linkId, payerAddress, and txHash are required",
      });
    }

    // ─── Wallet address format check ──────────────────────────────────────────
    if (!/^0x[a-fA-F0-9]{40}$/i.test(payerAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }

    // ─── tx_hash validation: format check ───────────────────────────────────────
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ error: "Invalid transaction hash format" });
    }

    // ─── tx_hash validation: on-chain verification ────────────────────────────
    // Ask the Arc blockchain directly: does this transaction actually exist?
    try {
      const rpcRes = await fetch("https://rpc.testnet.arc.network", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getTransactionReceipt",
          params: [txHash],
          id: 1,
        }),
      });
      const rpcData = await rpcRes.json();

      if (!rpcData.result) {
        return res.status(400).json({ error: "Transaction not found on the blockchain" });
      }

      // Check transaction was actually successful (status 0x1 = success)
      if (rpcData.result.status !== "0x1") {
        return res.status(400).json({ error: "Transaction failed on-chain" });
      }
    } catch (rpcErr) {
      console.error("RPC verification error:", rpcErr.message);
      // If the RPC is down, reject the payment to be safe
      return res.status(503).json({ error: "Unable to verify transaction on-chain. Please try again." });
    }

    const record = {
      id: uuidv4(),
      link_id: linkId,
      payer_address: payerAddress.toLowerCase(),
      tx_hash: txHash,
      amount: amount ? parseFloat(amount) : null,
      token: token || "USDC",
      created_at: new Date().toISOString(),
    };

    if (supabase) {
      const { error } = await supabase.from("payments").insert(record);
      if (error) throw error;
    } else {
      memStore.payments.push(record);
    }

    return res.status(201).json(record);
  } catch (err) {
    console.error("Error logging payment:", err);
    return res.status(500).json({ error: "Failed to log payment" });
  }
});

// ─── GET /api/payments/creator/:address ───────────────────────────────────────
// Fetch all payments received by a creator's wallet
router.get("/creator/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    let records;
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          payment_links!inner(creator_address, note, token)
        `)
        .eq("payment_links.creator_address", address)
        .order("created_at", { ascending: false });
      if (error) throw error;
      records = data || [];
    } else {
      // In-memory: cross-reference
      const creatorLinkIds = Array.from(memStore.links.values())
        .filter((l) => l.creator_address === address)
        .map((l) => l.id);
      records = memStore.payments.filter((p) =>
        creatorLinkIds.includes(p.link_id)
      );
    }

    return res.json(records);
  } catch (err) {
    console.error("Error fetching creator payments:", err);
    return res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ─── GET /api/payments/payer/:address ─────────────────────────────────────────
// Fetch all payments made by a specific wallet
router.get("/payer/:address", async (req, res) => {
  try {
    const address = req.params.address.toLowerCase();

    let records;
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          payment_links!inner(creator_address, note, token)
        `)
        .eq("payer_address", address)
        .order("created_at", { ascending: false });
      if (error) throw error;
      records = data || [];
    } else {
      records = memStore.payments.filter((p) => p.payer_address === address);
    }

    return res.json(records);
  } catch (err) {
    console.error("Error fetching payer payments:", err);
    return res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ─── GET /api/payments/link/:linkId ───────────────────────────────────────────
// Fetch payments for a specific link
router.get("/link/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;

    let records;
    if (supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("link_id", linkId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      records = data || [];
    } else {
      records = memStore.payments.filter((p) => p.link_id === linkId);
    }

    return res.json(records);
  } catch (err) {
    console.error("Error fetching link payments:", err);
    return res.status(500).json({ error: "Failed to fetch payments" });
  }
});

module.exports = router;
