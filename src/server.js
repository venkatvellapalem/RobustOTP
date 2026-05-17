/**
 * server.js
 * Entry point — sets up Express and mounts routes.
 */

'use strict';

const express       = require('express');
const requestLogger = require('./middleware/logger');
const authRoutes    = require('./routes/auth');
const { getOTP }    = require('./store/otpStore');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_TEST = process.env.NODE_ENV === 'test';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Test-only helpers (never expose in production) ────────────────────────────
if (IS_TEST) {
  console.warn('[⚠️  TEST MODE] Debug endpoints are active. Never use in production.');

  app._testLastOTPs = new Map();

  app.post('/auth/_test_last_otp', (req, res) => {
    const id = (req.body.identifier || '').toLowerCase();
    const otp = app._testLastOTPs.get(id);
    if (!otp) return res.status(404).json({ message: 'No OTP found for identifier' });
    return res.json({ otp });
  });

  app.post('/auth/_test_expire_otp', (req, res) => {
    const id = (req.body.identifier || '').toLowerCase();
    const record = getOTP(id);
    if (!record) return res.status(404).json({ message: 'No OTP record' });
    record.expiresAt = new Date(0);
    return res.json({ message: 'OTP force-expired' });
  });
}

// 404 fallback
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔐 Abuse-Resistant OTP System`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Mode: ${IS_TEST ? 'TEST (debug endpoints active)' : 'PRODUCTION'}`);
  console.log(`   OTPs are printed to this console (dev mode)\n`);
});

module.exports = app;
