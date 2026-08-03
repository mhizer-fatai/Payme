const express = require("express");
const {
  createDeviceTokenForSocialLogin,
} = require("../services/circleAuthService");
const { createPayMeSession } = require("../services/paymeSessionService");
const { requestEmailCode, verifyEmailCode } = require("../services/emailOtpService");

const router = express.Router();

router.post("/social/device-token", async (req, res) => {
  try {
    const { deviceId } = req.body;
    if (!deviceId) return res.status(400).json({ error: "deviceId is required" });
    const token = await createDeviceTokenForSocialLogin(deviceId);
    return res.json(token);
  } catch (err) {
    console.error("Social device token error:", err.data || err.message || err);
    return res.status(err.status || 500).json({
      error: "Failed to create social login device token",
      details: process.env.NODE_ENV !== "production" ? (err.data || err.message) : undefined,
    });
  }
});

router.post("/email/token", async (req, res) => {
  return res.status(410).json({
    error: "Circle email login has been retired. Cavopay email code login is coming soon.",
  });
});

router.post("/email/request-code", async (req, res) => {
  try {
    const result = await requestEmailCode(req.body?.email);
    return res.json(result);
  } catch (err) {
    console.error("Email code request error:", err.message || err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to send email code",
    });
  }
});

router.post("/email/verify-code", async (req, res) => {
  try {
    const { email } = await verifyEmailCode(req.body?.email, req.body?.code);
    const userKey = `email:${email}`;
    const session = createPayMeSession({
      authProvider: "email",
      providerUserId: email,
      email,
      userKey,
    });
    return res.json({
      authProvider: "email",
      providerUserId: email,
      email,
      userKey,
      session,
    });
  } catch (err) {
    console.error("Email code verify error:", err.message || err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to verify email code",
    });
  }
});

router.post("/session", async (req, res) => {
  try {
    return res.json(createPayMeSession(req.body));
  } catch (err) {
    console.error("Cavopay session error:", err.message || err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to create Cavopay session",
    });
  }
});

module.exports = router;
