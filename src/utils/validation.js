const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateIdentifier(raw) {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, normalized: null, type: null, error: 'identifier is required and must be a string' };
  }
  const trimmed = raw.trim().toLowerCase();
  if (EMAIL_RE.test(trimmed)) {
    return { valid: true, normalized: trimmed, type: 'email', error: null };
  }
  return { valid: false, normalized: null, type: null, error: 'identifier must be a valid email address' };
}

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
