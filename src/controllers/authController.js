const userRepository = require('../repositories/userRepository');
const otpRepository = require('../repositories/otpRepository');
const emailService = require('../services/emailService');
const otpService = require('../services/otpService');
const { validateIdentifier, validateCode } = require('../utils/validation');

async function send(req, res) {
  try {
    const { identifier: raw } = req.body;
    const { valid, normalized, error } = validateIdentifier(raw);
    if (!valid) return res.status(400).json({ message: error });

    if (process.env.NODE_ENV === 'test') {
      const user = await userRepository.findOrCreate(normalized);
      const otp = otpService.generateOTP();
      const hash = await otpService.hashOTP(otp);
      await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS));
      if (req.app._testLastOTPs) req.app._testLastOTPs.set(normalized, otp);
      console.log(`[OTP] ${normalized} → ${otp}`);
      return res.status(200).json({ message: 'OTP sent' });
    }

    const user = await userRepository.findOrCreate(normalized);

    const since = new Date(Date.now() - otpService.SEND_WINDOW_MS);
    const recentCount = await otpRepository.countRecentByUser(user.id, since);
    if (recentCount >= otpService.SEND_LIMIT) {
      return res.status(429).json({
        message: `Too many OTP requests. Try again later.`,
      });
    }

    const otp = otpService.generateOTP();
    const hash = await otpService.hashOTP(otp);

    await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS));

    console.log(`[OTP] ${normalized} → ${otp}`);

    const delivered = await emailService.sendOTP(normalized, otp);
    if (!delivered) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[/auth/send error]', err);
    return res.status(500).json({ message: 'Internal server error' });
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
