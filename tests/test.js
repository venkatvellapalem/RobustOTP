/**
 * test.js
 * Automated test suite for the Abuse-Resistant OTP System.
 * Uses Node's built-in http module — no test framework required.
 *
 * Run: node tests/test.js
 * (Server must be running on PORT 3000 or set TEST_PORT env var)
 */

'use strict';

const http = require('http');

const PORT    = process.env.TEST_PORT || 3000;
const BASE    = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

// ── Helpers ──────────────────────────────────────────────────────────────────

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port:     PORT,
      path,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`${BASE}${path}`, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  [PASS]  ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL]  ${name}${detail ? ' - ' + detail : ''}`);
    failed++;
  }
}

/** Extract the OTP from the server logs is not possible in tests;
 *  instead we call /auth/send, then steal the OTP via a monkey-patched
 *  approach: we expose a test-only endpoint only when NODE_ENV=test.
 *
 *  Since we can't intercept console.log here, we use the test-debug
 *  endpoint /auth/_test_last_otp exposed by the server in test mode.
 */
async function getLastOTP(identifier) {
  const r = await post('/auth/_test_last_otp', { identifier });
  if (r.status === 200) return r.body.otp;
  throw new Error('Test OTP endpoint not available. Set NODE_ENV=test and restart.');
}

// ── Test Suites ───────────────────────────────────────────────────────────────

async function testHealthCheck() {
  console.log('\n▸ Health check');
  const r = await get('/health');
  assert(r.status === 200, 'GET /health returns 200');
  assert(r.body.status === 'ok', 'body.status is "ok"');
}

async function testInputValidation() {
  console.log('\n▸ Input validation');

  let r = await post('/auth/send', {});
  assert(r.status === 400, 'Missing identifier → 400');

  r = await post('/auth/send', { identifier: 'not-valid' });
  assert(r.status === 400, 'Invalid identifier → 400');

  r = await post('/auth/verify', { identifier: 'a@b.com' });
  assert(r.status === 400, 'Missing code → 400');

  r = await post('/auth/verify', { identifier: 'a@b.com', code: '12345' });
  assert(r.status === 400, '5-digit code → 400');

  r = await post('/auth/verify', { identifier: 'a@b.com', code: 'abcdef' });
  assert(r.status === 400, 'Non-numeric code → 400');
}

async function testHappyPath() {
  console.log('\n▸ Happy path (send → verify)');

  const identifier = `test_${Date.now()}@example.com`;

  let r = await post('/auth/send', { identifier });
  assert(r.status === 200, 'POST /auth/send → 200');
  assert(typeof r.body.message === 'string', 'Response has message field');

  // We need the OTP. In test mode the server exposes it.
  let otp;
  try {
    otp = await getLastOTP(identifier);
  } catch {
    console.log('  [SKIP]  Skipping OTP-dependent tests (start server with NODE_ENV=test)');
    return;
  }

  assert(/^\d{6}$/.test(otp), 'OTP is exactly 6 digits');

  r = await post('/auth/verify', { identifier, code: otp });
  assert(r.status === 200, 'POST /auth/verify → 200 with correct code');
  assert(typeof r.body.session_token === 'string', 'Response includes session_token');
  assert(r.body.message === 'Verified', 'Response message is "Verified"');

  // Same code a second time must fail (reuse prevention)
  r = await post('/auth/verify', { identifier, code: otp });
  assert(r.status === 400, 'Second verify with same code → 400 (reuse prevention)');
}

async function testBruteForce() {
  console.log('\n▸ Brute-force protection (5-attempt lock)');

  const identifier = `brute_${Date.now()}@example.com`;
  await post('/auth/send', { identifier });

  let lastStatus;
  for (let i = 0; i < 5; i++) {
    const r = await post('/auth/verify', { identifier, code: '000000' });
    lastStatus = r.status;
    if (r.status === 429) break;
  }
  assert(lastStatus === 429, 'OTP locked after 5 bad attempts → 429');

  // Even with correct code it should be locked (if we knew it)
  const r = await post('/auth/verify', { identifier, code: '000000' });
  assert(r.status === 429, 'Subsequent attempt after lock → still 429');
}

async function testSendRateLimit() {
  console.log('\n▸ Send rate limit (3 per 5-min window)');

  const identifier = `ratelimit_${Date.now()}@example.com`;

  for (let i = 0; i < 3; i++) {
    await post('/auth/send', { identifier });
  }

  const r = await post('/auth/send', { identifier });
  assert(r.status === 429, '4th send within window → 429');
}

async function testCodeExpiry() {
  console.log('\n▸ Code expiry (simulated via test endpoint)');
  // We can only reliably test this with the test endpoint
  let otp;
  const identifier = `expiry_${Date.now()}@example.com`;
  await post('/auth/send', { identifier });

  try {
    otp = await getLastOTP(identifier);
  } catch {
    console.log('  [SKIP]  Skipping expiry test (start with NODE_ENV=test)');
    return;
  }

  // Force-expire via test endpoint
  const expireR = await post('/auth/_test_expire_otp', { identifier });
  if (expireR.status !== 200) {
    console.log('  [SKIP]  Force-expire endpoint unavailable');
    return;
  }

  const r = await post('/auth/verify', { identifier, code: otp });
  assert(r.status === 400, 'Expired OTP → 400');
}

async function testNoOTPRecord() {
  console.log('\n▸ Verify with no prior send');
  const r = await post('/auth/verify', { identifier: `ghost_${Date.now()}@example.com`, code: '123456' });
  assert(r.status === 400, 'Verify without prior send → 400');
}



// ── Run All ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('══════════════════════════════════════════');
  console.log('  Abuse-Resistant OTP System — Test Suite');
  console.log('══════════════════════════════════════════');

  try {
    await testHealthCheck();
    await testInputValidation();
    await testHappyPath();
    await testBruteForce();
    await testSendRateLimit();
    await testCodeExpiry();
    await testNoOTPRecord();

  } catch (err) {
    console.error('\n[FATAL] Could not connect to server:', err.message);
    console.error(`Make sure the server is running: node src/server.js`);
    process.exit(1);
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('══════════════════════════════════════════\n');
  process.exit(failed > 0 ? 1 : 0);
}

run();
