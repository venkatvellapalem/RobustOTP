'use strict';

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
}

const path = require('path');
const express = require('express');
const requestLogger = require('./middleware/logger');
const routes = require('./routes');
const { sendOTPEmail } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_TEST = process.env.NODE_ENV === 'test';

app.use(express.json());

// ponytail: manual security headers middleware to avoid Helmet dependency and increase security
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none';");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(requestLogger);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(routes);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.get('/security', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'security.html'));
});

app.get('/health/email', (_req, res) => {
  res.json({
    provider: 'Brevo REST API',
    configured: !!process.env.BREVO_API_KEY,
    senderConfigured: !!process.env.EMAIL_FROM,
    nodeVersion: process.version,
  });
});

if (IS_TEST) {
  console.warn('[TEST MODE] Debug endpoints are active.');

  app._testLastOTPs = new Map();

  app.post('/auth/_test_last_otp', (req, res) => {
    const id = (req.body.identifier || '').toLowerCase();
    const otp = app._testLastOTPs.get(id);
    if (!otp) return res.status(404).json({ message: 'No OTP found' });
    return res.json({ otp });
  });

  app.post('/auth/_test_expire_otp', async (req, res) => {
    const prisma = require('./config/prisma');
    const id = (req.body.identifier || '').toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: id } });
    if (!user) return res.status(404).json({ message: 'No user found' });
    await prisma.otpCode.updateMany({
      where: { userId: user.id, verified: false },
      data: { expiresAt: new Date(0) },
    });
    return res.json({ message: 'OTP force-expired' });
  });
}

const { rateLimit } = require('./middleware/rateLimiter');

app.get('/api/cron', rateLimit(60 * 60 * 1000, 5), async (req, res) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const emails = (process.env.KEEP_ALIVE_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    const results = [];
    const userRepository = require('./repositories/userRepository');
    const otpRepository = require('./repositories/otpRepository');
    const emailService = require('./services/emailService');
    const otpService = require('./services/otpService');

    await otpRepository.deleteExpired();

    for (const email of emails) {
      const user = await userRepository.findOrCreate(email);
      const otp = otpService.generateOTP();
      const hash = await otpService.hashOTP(otp);
      await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS));
      const emailResult = await emailService.sendOTPEmail(email, otp);
      results.push({ email, success: emailResult.success });
    }

    return res.json({ message: 'Keep-alive run completed', results });
  } catch (err) {
    console.error('[cron error]', err);
    return res.status(500).json({ message: 'Cron job failed', error: err.message });
  }
});

// ponytail: local setInterval keep-alive fallback for production environments
if (process.env.NODE_ENV === 'production' && process.env.KEEP_ALIVE_EMAILS) {
  const INTERVAL_2_WEEKS = 14 * 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      console.log('[keep-alive] Triggering scheduled OTP send...');
      const emails = process.env.KEEP_ALIVE_EMAILS.split(',').map(e => e.trim()).filter(Boolean);
      const userRepository = require('./repositories/userRepository');
      const otpRepository = require('./repositories/otpRepository');
      const emailService = require('./services/emailService');
      const otpService = require('./services/otpService');

      for (const email of emails) {
        const user = await userRepository.findOrCreate(email);
        const otp = otpService.generateOTP();
        const hash = await otpService.hashOTP(otp);
        await otpRepository.create(user.id, hash, 'auth', new Date(Date.now() + otpService.OTP_TTL_MS));
        await emailService.sendOTPEmail(email, otp);
      }
    } catch (err) {
      console.error('[keep-alive error]', err);
    }
  }, INTERVAL_2_WEEKS);
}

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    const hasBrevo = !!process.env.BREVO_API_KEY;
    const hasSMTP = !!process.env.SMTP_HOST;

    console.log(`\nRobustOTP — http://localhost:${PORT}`);
    console.log(`Provider      : Brevo REST API`);
    console.log(`Sender        : ${process.env.EMAIL_FROM || '(not set)'}`);
    console.log(`Environment   : ${IS_TEST ? 'TEST' : process.env.NODE_ENV || 'production'}`);

    if (!hasBrevo && !hasSMTP) {
      console.log(`\n\x1b[33m[DEMO MODE] SMTP/Brevo is not configured.\x1b[0m`);
      console.log(`\x1b[32m[DEMO MODE] You will retrieve your verification OTP codes printed right below in this terminal.\x1b[0m\n`);
    } else {
      console.log("");
    }
  });
}

module.exports = app;
