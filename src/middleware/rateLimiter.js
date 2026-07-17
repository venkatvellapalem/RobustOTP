const requests = new Map();

// ponytail: periodic memory leak prevention by cleanup of expired rate-limit buckets.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requests.entries()) {
    if (now - entry.start > 60 * 60 * 1000) {
      requests.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function rateLimit(windowMs, max) {
  return (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const key = req.ip + ':' + req.path;
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now - entry.start > windowMs) {
      requests.set(key, { count: 1, start: now });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ message: 'Too many requests. Try again later.' });
    }

    entry.count += 1;
    next();
  };
}

module.exports = { rateLimit };
