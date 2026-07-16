'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const express = require('express');
const requestLogger = require('./middleware/logger');
const routes = require('./routes');
const { sendOTPEmail } = require('./services/emailService');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_TEST = process.env.NODE_ENV === 'test';

app.use(express.json());
app.use(requestLogger);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(routes);

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

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

app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ message: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nRobustOTP — http://localhost:${PORT}`);
    console.log(`Provider      : Brevo REST API`);
    console.log(`Sender        : ${process.env.EMAIL_FROM || '(not set)'}`);
    console.log(`Environment   : ${IS_TEST ? 'TEST' : process.env.NODE_ENV || 'production'}\n`);
  });
}

module.exports = app;
