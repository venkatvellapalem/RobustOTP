const express  = require('express');
const router   = express.Router();

const {
  generateOTP, hashOTP, verifyOTP, generateSessionToken,
} = require('../utils/crypto');

const { validateIdentifier, validateCode } = require('../utils/validation');

const {
  setOTP, getOTP, incrementAttempts, markUsed,
  checkSendRateLimit, recordSend, MAX_ATTEMPTS,
} = require('../store/otpStore');

const { sendOTPEmail } = require('../services/email');

router.post('/send', async (req, res) => {
  try {
    const { identifier: rawIdentifier } = req.body;

    const { valid, normalized, type, error } = validateIdentifier(rawIdentifier);
    if (!valid) return res.status(400).json({ message: error });

    const rateCheck = await checkSendRateLimit(normalized);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        message: `Too many OTP requests. Try again after ${rateCheck.resetAt.toISOString()}.`,
      });
    }

    const otp  = generateOTP();
    const hash = await hashOTP(otp);

    await setOTP(normalized, hash);
    await recordSend(normalized);

    console.log(`[OTP] ${normalized} → ${otp}`);

    if (process.env.NODE_ENV === 'test' && req.app._testLastOTPs) {
      req.app._testLastOTPs.set(normalized, otp);
    }

    if (process.env.NODE_ENV === 'test') {
      return res.status(200).json({ message: 'OTP sent' });
    }

    const delivered = await sendOTPEmail(normalized, otp);
    if (!delivered) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[/auth/send error]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { identifier: rawIdentifier, code: rawCode } = req.body;

    const idCheck = validateIdentifier(rawIdentifier);
    if (!idCheck.valid) return res.status(400).json({ message: idCheck.error });

    const codeCheck = validateCode(rawCode);
    if (!codeCheck.valid) return res.status(400).json({ message: codeCheck.error });

    const normalized = idCheck.normalized;
    const code       = rawCode.trim();

    const record = await getOTP(normalized);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found for this identifier. Please request a new code.' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        message: 'OTP locked after too many failed attempts. Please request a new code.',
        attempts_remaining: 0,
      });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
    }

    if (record.used) {
      return res.status(400).json({ message: 'OTP has already been used. Please request a new code.' });
    }

    const isMatch = await verifyOTP(code, record.hash);

    if (!isMatch) {
      const updated = await incrementAttempts(normalized);
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

    await markUsed(normalized);

    return res.status(200).json({
      message: 'Verified',
      session_token: generateSessionToken(),
    });
  } catch (err) {
    console.error('[/auth/verify error]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
