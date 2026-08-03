const express = require("express");
const {
  changePin,
  createApproval,
  getPinStatus,
  recoverPin,
  setRecoveryQuestion,
  setupPin,
} = require("../services/paymePinService");
const { requireMatchingUserKey, requirePayMeSession } = require("../services/paymeSessionService");

const router = express.Router();

router.get("/status", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    const userKey = req.query.userKey;
    if (!userKey) return res.status(400).json({ error: "userKey is required" });
    return res.json(await getPinStatus(userKey));
  } catch (err) {
    console.error("Cavopay PIN status error:", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to fetch PIN status" });
  }
});

router.post("/setup", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    const { userKey, pin, recoveryAnswers, recoveryAnswer } = req.body;
    return res.status(201).json(await setupPin(userKey, pin, recoveryAnswers, recoveryAnswer));
  } catch (err) {
    console.error("Cavopay PIN setup error:", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to set Cavopay PIN" });
  }
});

router.post("/change", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    return res.json(await changePin(req.body));
  } catch (err) {
    console.error("Cavopay PIN change error:", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to change Cavopay PIN", code: err.code });
  }
});

router.post("/recovery-question", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    return res.json(await setRecoveryQuestion(req.body));
  } catch (err) {
    console.error("Cavopay PIN recovery question error:", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to save security question", code: err.code });
  }
});

router.post("/recover", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    return res.json(await recoverPin(req.body));
  } catch (err) {
    console.error("Cavopay PIN recovery error:", err.message || err);
    return res.status(err.status || 500).json({ error: err.message || "Failed to recover Cavopay PIN", code: err.code });
  }
});

router.post("/approve", requirePayMeSession, requireMatchingUserKey, async (req, res) => {
  try {
    return res.json(await createApproval(req.body));
  } catch (err) {
    console.error("Cavopay PIN approval error:", err.message || err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to approve transaction",
      code: err.code,
    });
  }
});

module.exports = router;
