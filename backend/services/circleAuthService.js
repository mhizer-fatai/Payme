const { v4: uuidv4 } = require("uuid");

const CIRCLE_API_BASE = process.env.CIRCLE_API_BASE || "https://api.circle.com";

function getApiKey() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not configured");
  return apiKey;
}

async function circleFetch(path, options = {}) {
  const response = await fetch(`${CIRCLE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      "X-Request-Id": uuidv4(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.message || payload?.error || payload?.data?.message || `Circle API ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = payload;
    throw error;
  }

  return payload.data || payload;
}

async function createDeviceTokenForSocialLogin(deviceId) {
  return circleFetch("/v1/w3s/users/social/token", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: uuidv4(),
      deviceId,
    }),
  });
}

module.exports = {
  createDeviceTokenForSocialLogin,
};
