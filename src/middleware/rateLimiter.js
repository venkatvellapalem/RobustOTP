const requests = new Map();

function rateLimit(windowMs, max) {
  return (req, res, next) => {
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
