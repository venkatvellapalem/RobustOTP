const OTP_TTL_MS    = 10 * 60 * 1000;
const MAX_ATTEMPTS  = 5;
const SEND_LIMIT    = 3;
const SEND_WINDOW_MS = 10 * 60 * 1000;

let kv = null;

try {
  if (process.env.KV_URL) kv = require('@vercel/kv').kv;
} catch {}

const mem = { otp: new Map(), rate: new Map() };

function redisKey(k) { return `robustotp:${k}`; }

async function setOTP(identifier, hash) {
  const now = Date.now();
  const record = { hash, createdAt: now, expiresAt: now + OTP_TTL_MS, used: false, attempts: 0 };
  if (kv) {
    await kv.set(redisKey(identifier), record, { ex: Math.ceil(OTP_TTL_MS / 1000) });
  } else {
    mem.otp.set(identifier, record);
  }
}

async function getOTP(identifier) {
  if (kv) return await kv.get(redisKey(identifier));
  const r = mem.otp.get(identifier);
  if (!r) return null;
  if (Date.now() > r.expiresAt) { mem.otp.delete(identifier); return null; }
  return r;
}

async function incrementAttempts(identifier) {
  if (kv) {
    const record = await kv.get(redisKey(identifier));
    if (!record) return null;
    record.attempts += 1;
    await kv.set(redisKey(identifier), record, { ex: Math.ceil(OTP_TTL_MS / 1000) });
    return record;
  }
  const record = mem.otp.get(identifier);
  if (record) record.attempts += 1;
  return record;
}

async function markUsed(identifier) {
  if (kv) {
    const record = await kv.get(redisKey(identifier));
    if (!record) return;
    record.used = true;
    await kv.set(redisKey(identifier), record, { ex: Math.ceil(OTP_TTL_MS / 1000) });
    return;
  }
  const record = mem.otp.get(identifier);
  if (record) record.used = true;
}

async function checkSendRateLimit(identifier) {
  const key = redisKey(identifier);
  if (kv) {
    const count = await kv.get(key);
    const now = Date.now();
    if (count === null) {
      return { allowed: true, remaining: SEND_LIMIT - 1, resetAt: new Date(now + SEND_WINDOW_MS) };
    }
    if (count >= SEND_LIMIT) {
      const ttl = await kv.ttl(key);
      return { allowed: false, remaining: 0, resetAt: new Date(now + Math.max(0, ttl * 1000)) };
    }
    return { allowed: true, remaining: SEND_LIMIT - count - 1, resetAt: new Date(now + SEND_WINDOW_MS) };
  }
  const now = Date.now();
  let entry = mem.rate.get(identifier);
  if (!entry || now - entry.windowStart >= SEND_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    mem.rate.set(identifier, entry);
    return { allowed: true, remaining: SEND_LIMIT - 1, resetAt: new Date(now + SEND_WINDOW_MS) };
  }
  if (entry.count >= SEND_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: new Date(entry.windowStart + SEND_WINDOW_MS) };
  }
  return { allowed: true, remaining: SEND_LIMIT - entry.count - 1, resetAt: new Date(entry.windowStart + SEND_WINDOW_MS) };
}

async function recordSend(identifier) {
  const key = redisKey(identifier);
  if (kv) {
    const count = await kv.incr(key);
    if (count === 1) await kv.expire(key, Math.ceil(SEND_WINDOW_MS / 1000));
    return;
  }
  const now = Date.now();
  const entry = mem.rate.get(identifier);
  if (!entry || now - entry.windowStart >= SEND_WINDOW_MS) {
    mem.rate.set(identifier, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

module.exports = {
  setOTP, getOTP, incrementAttempts, markUsed,
  checkSendRateLimit, recordSend, MAX_ATTEMPTS, SEND_LIMIT,
};
