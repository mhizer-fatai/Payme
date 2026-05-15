const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Fallback in-memory store (data is lost on server restart — dev only)
const memStore = {
  links: new Map(),
  payments: [],
  profiles: new Map(),
};

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️  Supabase credentials not set — using in-memory store (data will NOT persist across restarts).");
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log("🔌 Supabase client initialized.");
  } catch (e) {
    console.error("❌ Supabase client failed to initialize:", e.message);
    console.warn("⚠️  Falling back to in-memory store.");
  }
}

module.exports = { supabase, memStore };
