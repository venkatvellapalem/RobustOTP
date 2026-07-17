const express = require('express');
const { send, verify } = require('../controllers/authController');
const { rateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/send', rateLimit(15 * 60 * 1000, 10), send);
router.post('/verify', rateLimit(15 * 60 * 1000, 20), verify);

module.exports = router;
