const bcrypt = require('bcryptjs');
const nodeCrypto = require('crypto');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SEND_LIMIT = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;
const BCRYPT_ROUNDS = 12;

function generateOTP() {
  return String(nodeCrypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function hashOTP(otp) {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

async function verifyOTP(otp, hash) {
  return bcrypt.compare(otp, hash);
}

function generateSessionToken() {
  return nodeCrypto.randomUUID();
}

module.exports = {
  generateOTP, hashOTP, verifyOTP, generateSessionToken,
  OTP_TTL_MS, MAX_ATTEMPTS, SEND_LIMIT, SEND_WINDOW_MS,
};
