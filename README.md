# RobustOTP

Zero-cost OTP authentication system. Cryptographically secure code generation, bcrypt hashing, brute-force protection, send-rate limiting, one-time invalidation — with email delivery via Resend.

---

## Quick Start

```bash
git clone <this-repo>
cd RobustOTP
npm install
cp .env.example .env
```

1. Sign up at https://resend.com (free — 100 emails/day)
2. Verify a domain or use the default `cytrus@resend.dev`
3. Copy your API key from Dashboard → API Keys
4. Add to `.env`:

```
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=RobustOTP <cytrus@resend.dev>
```

```bash
node src/server.js
```

Open http://localhost:3000

## API

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/auth/send` | POST | `{ identifier }` | 200 OTP sent |
| `/auth/verify` | POST | `{ identifier, code }` | 200 + `session_token` |
| `/health` | GET | — | `{ status, ts }` |

### Security

- OTP: 6 digits via `crypto.randomInt` (CSPRNG)
- Storage: bcrypt hash only (cost 12), never plaintext
- Verification: constant-time bcrypt compare
- Lockout: 5 failed attempts → locked
- Rate limit: 3 sends per 10-min window per identifier
- Expiry: 10 minutes TTL
- Reuse: invalidated on first successful verify

## Tests

```bash
node tests/test.js
```

Server must be running with `NODE_ENV=test`:

```bash
NODE_ENV=test node src/server.js
```

## Project Structure

```
src/
  server.js          entry point, mounts routes + static files
  middleware/logger.js  request logger
  routes/auth.js     POST /send, POST /verify
  store/otpStore.js  in-memory OTP + rate-limit store
  services/email.js  Resend API delivery
  utils/crypto.js    OTP generation, bcrypt hash, session tokens
  utils/validation.js  identifier + code validation
public/
  index.html         web UI
  style.css
  app.js
tests/
  test.js            20 tests, zero frameworks (pure Node http)
```
