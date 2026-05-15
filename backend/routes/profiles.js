const express = require("express");
const { supabase, memStore } = require("../supabase");

const router = express.Router();

const RESERVED_USERNAMES = [
  "dashboard", "pay", "home", "api", "login", "logout", "signup",
  "register", "settings", "profile", "user", "auth", "app", "dev",
  "test", "admin", "administrator", "support", "help", "payme",
  "system", "root", "staff", "moderator", "billing", "security",
  "official", "team", "contact", "usdc", "eurc", "circle", "arc",
  "network", "wallet", "contract", "token", "checkout", "invoice",
  "payment", "deposit", "withdraw"
];

// ─── Verify Supabase connection on startup ────────────────────────────────────
let useSupabase = false;
(async () => {
  if (!supabase) {
    console.log("⚠️  Profiles: No Supabase client — using memStore (data WILL be lost on restart).");
    return;
  }
  try {
    const { error } = await supabase.from("profiles").select("username").limit(1);
    if (error) {
      console.error("❌ Profiles: Supabase query failed:", error.message);
      console.log("⚠️  Profiles: Falling back to memStore.");
    } else {
      useSupabase = true;
      console.log("✅ Profiles: Connected to Supabase — usernames will persist permanently.");
    }
  } catch (e) {
    console.error("❌ Profiles: Supabase connection error:", e.message);
    console.log("⚠️  Profiles: Falling back to memStore.");
  }
})();

// ─── POST /api/profiles — Claim a username ────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    let { username, walletAddress } = req.body;

    if (!username || !walletAddress) {
      return res.status(400).json({ error: "Username and walletAddress are required" });
    }

    username = username.toLowerCase().trim();
    walletAddress = walletAddress.toLowerCase().trim();

    // ─── Wallet address format check ──────────────────────────────────────────
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address format" });
    }


    if (!/^[a-z0-9_]+$/.test(username) || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3–20 characters, letters/numbers/underscores only" });
    }

    if (RESERVED_USERNAMES.includes(username)) {
      return res.status(400).json({ error: "This username is reserved and cannot be claimed" });
    }

    const createdAt = new Date().toISOString();
    const record = { username, wallet_address: walletAddress, created_at: createdAt };

    if (useSupabase) {
      // Check if this wallet already has a username
      const { data: existingWallet, error: walletErr } = await supabase
        .from("profiles")
        .select("username")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (walletErr) throw walletErr;

      if (existingWallet) {
        // Wallet already has a username — return it instead of erroring
        return res.status(200).json(existingWallet);
      }

      // Check if username is taken
      const { data: existingUsername, error: usernameErr } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();

      if (usernameErr) throw usernameErr;

      if (existingUsername) {
        return res.status(400).json({ error: "Username is already taken" });
      }

      // Insert the new profile
      const { data, error: insertErr } = await supabase
        .from("profiles")
        .insert(record)
        .select()
        .single();

      if (insertErr) throw insertErr;

      return res.status(201).json(data);
    } else {
      // --- memStore fallback (dev only) ---
      for (const prof of memStore.profiles.values()) {
        if (prof.wallet_address === walletAddress) {
          return res.status(200).json(prof); // Return existing profile
        }
      }
      if (memStore.profiles.has(username)) {
        return res.status(400).json({ error: "Username is already taken" });
      }
      memStore.profiles.set(username, record);
      return res.status(201).json(record);
    }
  } catch (err) {
    console.error("Error claiming profile:", err);
    return res.status(500).json({ error: "Failed to claim username. Please try again." });
  }
});

// ─── GET /api/profiles/wallet/:walletAddress — Lookup by wallet ───────────────
// IMPORTANT: This route must be defined BEFORE /:username to avoid routing conflicts
router.get("/wallet/:walletAddress", async (req, res) => {
  try {
    const walletAddress = req.params.walletAddress.toLowerCase().trim();

    if (useSupabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("wallet_address", walletAddress)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Profile not found" });

      return res.json(data);
    } else {
      const record = Array.from(memStore.profiles.values()).find(
        (p) => p.wallet_address === walletAddress
      );
      if (!record) return res.status(404).json({ error: "Profile not found" });
      return res.json(record);
    }
  } catch (err) {
    console.error("Error fetching profile by wallet:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// ─── GET /api/profiles/:username — Lookup by username ────────────────────────
router.get("/:username", async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();

    if (useSupabase) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error || !data) return res.status(404).json({ error: "Profile not found" });

      return res.json(data);
    } else {
      const record = memStore.profiles.get(username);
      if (!record) return res.status(404).json({ error: "Profile not found" });
      return res.json(record);
    }
  } catch (err) {
    console.error("Error fetching profile:", err);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

module.exports = router;
