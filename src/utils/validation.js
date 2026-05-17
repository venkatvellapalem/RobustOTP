/**
 * validation.js
 * Input validation helpers for the OTP endpoints.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[1-9]\d{6,14}$/; // E.164-ish: 7–15 digits, optional leading +

/**
 * Validate and normalize an identifier (email or phone number).
 * Returns { valid: boolean, normalized: string, type: 'email'|'phone'|null, error: string|null }
 */
function validateIdentifier(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, normalized: null, type: null, error: 'identifier is required and must be a string' };
  }

  const trimmed = raw.trim();

  if (EMAIL_RE.test(trimmed)) {
    return { valid: true, normalized: trimmed.toLowerCase(), type: 'email', error: null };
  }

  // Strip spaces/dashes for phone check
  const phone = trimmed.replace(/[\s\-()]/g, '');
  if (PHONE_RE.test(phone)) {
    return { valid: true, normalized: phone, type: 'phone', error: null };
  }

  return { valid: false, normalized: null, type: null, error: 'identifier must be a valid email address or phone number' };
}

/**
 * Validate the submitted OTP code (must be a 6-digit string).
 */
function validateCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'code is required and must be a string' };
  }
  if (!/^\d{6}$/.test(code.trim())) {
    return { valid: false, error: 'code must be exactly 6 digits' };
  }
  return { valid: true, error: null };
}

module.exports = { validateIdentifier, validateCode };
