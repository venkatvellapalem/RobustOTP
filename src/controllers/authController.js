const userRepository = require('../repositories/userRepository');
const otpRepository = require('../repositories/otpRepository');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');
const { validateIdentifier, validateCode } = require('../utils/validation');

const activeRequests = new Set();
const crypto = require('crypto');

// ponytail: basic device hashing to bind OTP session. Upgrade path: use fully-featured fingerprinters (e.g. fingerprintJS).
function computeFingerprint(req) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(`${ip}-${ua}`).digest('hex');
}

async function send(req, res) {
  const { identifier: raw } = req.body;
  const { valid, normalized, error } = validateIdentifier(raw);
  if (!valid) return res.status(400).json({ message: error });

  if (activeRequests.has(normalized)) {
    return res.status(429).json({ message: 'A request is already in progress for this email.' });
  }
  activeRequests.add(normalized);

  try {
    // Purge expired and old verified OTPs to keep database storage footprint extremely small
    otpRepository.deleteExpired().catch(err => console.error('[cleanup-error]', err));

    const user = await userRepository.findOrCreate(normalized);
    const fingerprint = computeFingerprint(req);

    const since = new Date(Date.now() - otpService.SEND_WINDOW_MS);
    const recentCount = await otpRepository.countRecentByUser(user.id, since);

    // 1. Exponential Backoff (10s/30s in production, scaled down to 1s/2s in test mode)
    const latestOtp = await otpRepository.findLatest(user.id);
    if (latestOtp) {
      const elapsedMs = Date.now() - new Date(latestOtp.createdAt).getTime();
      const backoff1 = process.env.NODE_ENV === 'test' ? 1000 : 10 * 1000;
      const backoff2 = process.env.NODE_ENV === 'test' ? 2000 : 30 * 1000;
      
      // ponytail: interval check. Upgrade path: Redis-backed sliding-window backoffs.
      if (recentCount === 1 && elapsedMs < backoff1) {
        const waitSec = Math.ceil((backoff1 - elapsedMs) / 1000);
        return res.status(429).json({ message: `Please wait ${waitSec} seconds before requesting another code.` });
      }
      if (recentCount === 2 && elapsedMs < backoff2) {
        const waitSec = Math.ceil((backoff2 - elapsedMs) / 1000);
        return res.status(429).json({ message: `Please wait ${waitSec} seconds before requesting another code.` });
      }
    }

    // 2. Silent Rate-Limit Shielding (Honeypot)
    if (recentCount >= otpService.SEND_LIMIT) {
      console.log(`[HONEYPOT] Silent shielding active for: ${normalized}`);
      return res.status(200).json({ message: 'OTP sent successfully' });
    }

    if (process.env.NODE_ENV === 'test') {
      const otp = otpService.generateOTP();
      const hash = await otpService.hashOTP(otp);
      await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS), fingerprint);
      if (req.app._testLastOTPs) req.app._testLastOTPs.set(normalized, otp);
      console.log(`[OTP] ${normalized} → ${otp}`);
      return res.status(200).json({ message: 'OTP sent' });
    }

    const otp = otpService.generateOTP();
    const hash = await otpService.hashOTP(otp);

    await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS), fingerprint);

    const result = await emailService.sendOTPEmail(normalized, otp);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        provider: 'brevo',
        status: result.status,
        message: result.message,
        details: result.details,
      });
    }

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[/auth/send error]', err);
    return res.status(500).json({
      success: false,
      provider: 'brevo',
      message: 'Internal server error',
      details: err.message,
    });
  } finally {
    activeRequests.delete(normalized);
  }
}

async function verify(req, res) {
  try {
    const { identifier: rawIdentifier, code: rawCode } = req.body;
    const idCheck = validateIdentifier(rawIdentifier);
    if (!idCheck.valid) return res.status(400).json({ message: idCheck.error });

    const codeCheck = validateCode(rawCode);
    if (!codeCheck.valid) return res.status(400).json({ message: codeCheck.error });

    const user = await userRepository.findByEmail(idCheck.normalized);
    if (!user) {
      return res.status(400).json({ message: 'No OTP found. Please request a new code.' });
    }

    const record = await otpRepository.findLatestUnverified(user.id);
    if (!record) {
      return res.status(400).json({ message: 'No OTP found. Please request a new code.' });
    }

    const currentFingerprint = computeFingerprint(req);
    if (record.clientFingerprint && record.clientFingerprint !== currentFingerprint) {
      return res.status(400).json({ message: 'Device fingerprint mismatch. Verification must occur on the same device.' });
    }

    if (record.attempts >= otpService.MAX_ATTEMPTS) {
      return res.status(429).json({
        message: 'OTP locked after too many failed attempts. Please request a new code.',
        attempts_remaining: 0,
      });
    }

    if (new Date() > record.expiresAt) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
    }

    if (record.verified) {
      return res.status(400).json({ message: 'OTP has already been used. Please request a new code.' });
    }

    const isMatch = await otpService.verifyOTP(rawCode.trim(), record.otpHash);

    if (!isMatch) {
      const updated = await otpRepository.incrementAttempts(record.id);
      const remaining = Math.max(0, otpService.MAX_ATTEMPTS - updated.attempts);

      if (remaining === 0) {
        return res.status(429).json({
          message: 'OTP locked after too many failed attempts. Please request a new code.',
          attempts_remaining: 0,
        });
      }

      return res.status(400).json({
        message: 'Invalid or expired code',
        attempts_remaining: remaining,
      });
    }

    await otpRepository.markVerified(record.id);
    await otpRepository.invalidatePrevious(user.id, record.id);

    return res.status(200).json({
      message: 'Verified',
      session_token: otpService.generateSessionToken(),
    });
  } catch (err) {
    console.error('[/auth/verify error]', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { send, verify };
