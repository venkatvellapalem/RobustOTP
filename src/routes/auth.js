const express = require('express');
const { send, verify } = require('../controllers/authController');

const router = express.Router();

router.post('/send', send);
router.post('/verify', verify);

module.exports = router;
