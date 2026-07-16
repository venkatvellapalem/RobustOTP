# RobustOTP

OTP authentication system with Prisma, Neon PostgreSQL, and Brevo Email API.

---

## Quick Start

```bash
git clone <this-repo>
cd RobustOTP
npm install
cp .env.example .env
```

1. Sign up at https://neon.tech → create project → copy `DATABASE_URL`
2. Sign up at https://app.brevo.com → SMTP & API → API Keys → create key
3. Verify a sender in Brevo Dashboard → Senders
4. Fill `.env` and run:

```bash
npx prisma migrate dev --name init
node src/server.js
```

Open http://localhost:3000

## API

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/auth/send` | POST | `{ identifier }` | 200 OTP sent |
| `/auth/verify` | POST | `{ identifier, code }` | 200 + `session_token` |
| `/health` | GET | — | `{ status, ts }` |
| `/health/email` | GET | — | provider status |

### Security

- OTP: 6 digits via `crypto.randomInt` (CSPRNG)
- Storage: bcrypt hash only (cost 12), never plaintext
- Verification: constant-time bcrypt compare
- Lockout: 5 failed attempts → locked
- Rate limit: 3 sends per 10-min window per identifier
- Expiry: 5 minutes TTL
- Reuse: invalidated on first successful verify

## Tests

```bash
node tests/test.js
```

Server must be running with `NODE_ENV=test`.
