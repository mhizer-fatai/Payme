const crypto = require("crypto");

const SESSION_TTL_SECONDS = 60 * 60;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function getSessionSecret() {
  const secret = process.env.PAYME_SESSION_SECRET || process.env.CIRCLE_ENTITY_SECRET || process.env.CIRCLE_API_KEY;
  if (!secret) throw new Error("PAYME_SESSION_SECRET is not configured");
  return secret;
}

function signPayload(payload) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function normalizeUserKey(userKey) {
  return String(userKey || "").trim().toLowerCase();
}

function validateSessionIdentity({ authProvider, providerUserId, email, userKey }) {
  const normalizedProvider = String(authProvider || "").trim().toLowerCase();
  const normalizedUserKey = normalizeUserKey(userKey);
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedProviderUserId = String(providerUserId || "").trim().toLowerCase();

  if (!["google", "email"].includes(normalizedProvider)) {
    const error = new Error("Unsupported auth provider");
    error.status = 400;
    throw error;
  }
  if (!normalizedUserKey || !normalizedProviderUserId) {
    const error = new Error("Missing login identity");
    error.status = 400;
    throw error;
  }
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error("Valid login email is required");
    error.status = 400;
    throw error;
  }
  if (!normalizedUserKey.startsWith(`email:${normalizedEmail}`)) {
    const error = new Error("Login identity does not match Cavopay account");
    error.status = 403;
    throw error;
  }

  return {
    authProvider: normalizedProvider,
    providerUserId: normalizedProviderUserId,
    email: normalizedEmail,
    userKey: normalizedUserKey,
  };
}

function createPayMeSession(identity) {
  const verified = validateSessionIdentity(identity);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...verified,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const signature = signPayload(`${header}.${payload}`);
  return {
    token: `${header}.${payload}.${signature}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    userKey: verified.userKey,
  };
}

function verifyPayMeSession(token) {
  const [header, payload, signature] = String(token || "").split(".");
  if (!header || !payload || !signature) {
    const error = new Error("Missing or invalid Cavopay session");
    error.status = 401;
    throw error;
  }

  const expected = signPayload(`${header}.${payload}`);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    const error = new Error("Invalid Cavopay session");
    error.status = 401;
    throw error;
  }

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    const error = new Error("Invalid Cavopay session payload");
    error.status = 401;
    throw error;
  }

  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) {
    const error = new Error("Cavopay session expired. Please sign in again.");
    error.status = 401;
    throw error;
  }

  return claims;
}

function requirePayMeSession(req, res, next) {
  try {
    const auth = req.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    req.paymeSession = verifyPayMeSession(token);
    next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || "Unauthorized" });
  }
}

function requireMatchingUserKey(req, res, next) {
  const requestedUserKey = normalizeUserKey(
    req.body?.userKey || req.query?.userKey || req.body?.walletAddress || req.query?.walletAddress
  );
  const sessionUserKey = normalizeUserKey(req.paymeSession?.userKey);
  if (!requestedUserKey || requestedUserKey !== sessionUserKey) {
    return res.status(403).json({ error: "Cavopay session does not match this account" });
  }
  next();
}

module.exports = {
  createPayMeSession,
  requirePayMeSession,
  requireMatchingUserKey,
};
