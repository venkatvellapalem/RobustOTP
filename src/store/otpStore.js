/**
 * otpStore.js
 * In-memory store for OTP records and rate-limit counters.
 *
 * OTP record shape:
 * {
 *   identifier: string,       // email or phone (normalized)
 *   hash:       string,       // bcrypt hash of the 6-digit code
 *   createdAt:  Date,
 *   expiresAt:  Date,         // createdAt + OTP_TTL_MS
 *   used:       boolean,      // true once verified successfully
 *   attempts:   number        // count of failed verify attempts
 * }
 *
 * Rate-limit record shape (send):
 * {
 *   count:     number,
 *   windowStart: Date
 * }
 */

const OTP_TTL_MS        = 10 * 60 * 1000;  // 10 minutes
const MAX_ATTEMPTS      = 5;               // brute-force lock threshold
const SEND_LIMIT        = 3;               // max send requests per window
const SEND_WINDOW_MS    = 10 * 60 * 1000;  // 10-minute send window

// Map<identifier, OTPRecord>
const otpRecords = new Map();

// Map<identifier, { count, windowStart }>
const sendRateLimits = new Map();

/**
 * Store (or overwrite) an OTP record for an identifier.
 */
function setOTP(identifier, hash) {
  const now = new Date();
  otpRecords.set(identifier, {
    identifier,
    hash,
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    used: false,
    attempts: 0,
  });
}

/**
 * Retrieve the current OTP record for an identifier (or null).
 */
function getOTP(identifier) {
  return otpRecords.get(identifier) || null;
}

/**
 * Increment the failed-attempt counter for an OTP record.
 * Returns the updated record.
 */
function incrementAttempts(identifier) {
  const record = otpRecords.get(identifier);
  if (record) {
    record.attempts += 1;
    otpRecords.set(identifier, record);
  }
  return record;
}

/**
 * Mark an OTP as used (invalidate it after successful verification).
 */
function markUsed(identifier) {
  const record = otpRecords.get(identifier);
  if (record) {
    record.used = true;
    otpRecords.set(identifier, record);
  }
}

/**
 * Check whether a new send request is allowed for this identifier.
 * Returns { allowed: boolean, remaining: number, resetAt: Date }.
 */
function checkSendRateLimit(identifier) {
  const now = Date.now();
  const entry = sendRateLimits.get(identifier);

  if (!entry || now - entry.windowStart.getTime() >= SEND_WINDOW_MS) {
    // No entry or window has expired — reset
    const newEntry = { count: 0, windowStart: new Date(now) };
    sendRateLimits.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: SEND_LIMIT - 1,
      resetAt: new Date(now + SEND_WINDOW_MS),
    };
  }

  if (entry.count >= SEND_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(entry.windowStart.getTime() + SEND_WINDOW_MS),
    };
  }

  return {
    allowed: true,
    remaining: SEND_LIMIT - entry.count - 1,
    resetAt: new Date(entry.windowStart.getTime() + SEND_WINDOW_MS),
  };
}

/**
 * Record a successful send for this identifier.
 */
function recordSend(identifier) {
  const now = Date.now();
  const entry = sendRateLimits.get(identifier);

  if (!entry || now - entry.windowStart.getTime() >= SEND_WINDOW_MS) {
    sendRateLimits.set(identifier, { count: 1, windowStart: new Date(now) });
  } else {
    entry.count += 1;
    sendRateLimits.set(identifier, entry);
  }
}

module.exports = {
  setOTP,
  getOTP,
  incrementAttempts,
  markUsed,
  checkSendRateLimit,
  recordSend,
  MAX_ATTEMPTS,
  SEND_LIMIT,
};
