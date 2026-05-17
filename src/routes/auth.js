/**
 * auth.js
 * Express router for /auth/send and /auth/verify.
 */

const express  = require('express');
const router   = express.Router();

const {
  generateOTP,
  hashOTP,
  verifyOTP,
  generateSessionToken,
} = require('../utils/crypto');

const {
  validateIdentifier,
  validateCode,
} = require('../utils/validation');

const {
  setOTP,
  getOTP,
  incrementAttempts,
  markUsed,
  checkSendRateLimit,
  recordSend,
  MAX_ATTEMPTS,
} = require('../store/otpStore');

/* ─────────────────────────────────────────────
   POST /auth/send
   Body: { identifier: string }
   ───────────────────────────────────────────── */
router.post('/send', async (req, res) => {
  try {
    const { identifier: rawIdentifier } = req.body;

    // 1. Validate identifier
    const { valid, normalized, error } = validateIdentifier(rawIdentifier);
    if (!valid) {
      return res.status(400).json({ message: error });
    }

    // 2. Check send rate limit (per identifier)
    const rateCheck = checkSendRateLimit(normalized);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many OTP requests. Try again after ${rateCheck.resetAt.toISOString()}.`,
      });
    }

    // 3. Generate CSPRNG OTP and hash it (never store plaintext)
    const otp  = generateOTP();
    const hash = await hashOTP(otp);

    // 4. Persist hashed OTP
    setOTP(normalized, hash);

    // 5. Record this send against the rate-limit window
    recordSend(normalized);

    // 6. "Deliver" OTP — logged to console; replace with real SMS/email in production
    console.log(`[OTP] ${normalized} → ${otp}`);

    // In test mode, expose the plaintext OTP for test introspection only
    if (process.env.NODE_ENV === 'test' && req.app._testLastOTPs) {
      req.app._testLastOTPs.set(normalized, otp);
    }

    return res.status(200).json({
      message: `OTP sent to ${normalized}`,
    });
  } catch (err) {
    console.error('[/auth/send error]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/* ─────────────────────────────────────────────
   POST /auth/verify
   Body: { identifier: string, code: string }
   ───────────────────────────────────────────── */
router.post('/verify', async (req, res) => {
  try {
    const { identifier: rawIdentifier, code: rawCode } = req.body;

    // 1. Validate inputs
    const idCheck = validateIdentifier(rawIdentifier);
    if (!idCheck.valid) {
      return res.status(400).json({ message: idCheck.error });
    }

    const codeCheck = validateCode(rawCode);
    if (!codeCheck.valid) {
      return res.status(400).json({ message: codeCheck.error });
    }

    const normalized = idCheck.normalized;
    const code       = rawCode.trim();

    // 2. Fetch OTP record
    const record = getOTP(normalized);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found for this identifier. Please request a new code.' });
    }

    // 3. Check brute-force lock BEFORE doing anything else
    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        message: 'OTP locked after too many failed attempts. Please request a new code.',
        attempts_remaining: 0,
      });
    }

    // 4. Check expiry
    if (new Date() > record.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
    }

    // 5. Check reuse
    if (record.used) {
      return res.status(400).json({ message: 'OTP has already been used. Please request a new code.' });
    }

    // 6. Constant-time hash comparison via bcrypt
    const isMatch = await verifyOTP(code, record.hash);

    if (!isMatch) {
      // Increment attempt counter first
      const updated = incrementAttempts(normalized);
      const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - updated.attempts);

      if (attemptsRemaining === 0) {
        return res.status(429).json({
          message: 'OTP locked after too many failed attempts. Please request a new code.',
          attempts_remaining: 0,
        });
      }

      return res.status(400).json({
        message: 'Invalid or expired code',
        attempts_remaining: attemptsRemaining,
      });
    }

    // 7. SUCCESS — immediately invalidate (prevent reuse)
    markUsed(normalized);

    const sessionToken = generateSessionToken();

    return res.status(200).json({
      message: 'Verified',
      session_token: sessionToken,
    });
  } catch (err) {
    console.error('[/auth/verify error]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
