/**
 * crypto.js
 * Cryptographic helpers for OTP generation and hashing.
 *
 * CSPRNG: crypto.randomInt (Node.js built-in, backed by OpenSSL CSPRNG).
 * Hashing: bcrypt with cost factor 12.
 */

const nodeCrypto = require('crypto');
const bcrypt      = require('bcryptjs'); // pure-JS bcrypt — no native bindings required
const { v4: uuidv4 } = require('uuid');

const BCRYPT_ROUNDS = 12;

/**
 * Generate a cryptographically secure random 6-digit OTP string.
 * Uses crypto.randomInt(min, max) which is backed by the OS CSPRNG.
 * Range: [0, 1_000_000) — padded to always be 6 digits.
 */
function generateOTP() {
  // crypto.randomInt(0, 1_000_000) produces integers in [0, 999999]
  const raw = nodeCrypto.randomInt(0, 1_000_000);
  return String(raw).padStart(6, '0');
}

/**
 * Hash a plaintext OTP using bcrypt.
 * @param {string} otp - The 6-digit plaintext code.
 * @returns {Promise<string>} bcrypt hash.
 */
async function hashOTP(otp) {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

/**
 * Verify a submitted code against a stored bcrypt hash.
 * @param {string} submitted - The code submitted by the user.
 * @param {string} storedHash - The bcrypt hash from the store.
 * @returns {Promise<boolean>}
 */
async function verifyOTP(submitted, storedHash) {
  return bcrypt.compare(submitted, storedHash);
}

/**
 * Generate an opaque session token (UUID v4).
 * @returns {string}
 */
function generateSessionToken() {
  return uuidv4();
}

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP,
  generateSessionToken,
};
