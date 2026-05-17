# Abuse-Resistant OTP System

A production-grade OTP (One-Time Password) authentication backend built with Node.js and Express. Implements cryptographically secure code generation, bcrypt hashing, brute-force protection, send-rate limiting, and immediate code invalidation — all without using any authentication library.

---

## Table of Contents

1. [Setup & Run](#setup--run)
2. [API Reference](#api-reference)
3. [Security Design](#security-design)
4. [CSPRNG Choice](#csprng-choice)
5. [Hashing Approach](#hashing-approach)
6. [Rate Limit Tracking](#rate-limit-tracking)
7. [Threat Model — What Can Be Recovered From a Leaked OTP Table?](#threat-model)
8. [Running Tests](#running-tests)
9. [Project Structure](#project-structure)

---

## Setup & Run

### Prerequisites

- Node.js ≥ 18.0.0 (required for `crypto.randomInt`)
- npm ≥ 8

### Install dependencies

```bash
npm install
```

### Start the server

```bash
node src/server.js
# or, with auto-reload during development:
npm run dev
```

The server starts on **http://localhost:3000** by default.  
Set the `PORT` environment variable to override:

```bash
PORT=8080 node src/server.js
```

### OTP delivery

OTPs are **printed to the console** in development mode. In a production integration, replace the `console.log` line in `src/routes/auth.js` with a call to your SMS provider (Twilio, AWS SNS, etc.) or email service (SendGrid, SES, etc.).

```
[OTP] user@example.com → 472813
```

---

## API Reference

### `POST /auth/send`

Request a new OTP for an email address or phone number.

**Request body**

```json
{ "identifier": "user@example.com" }
```

`identifier` accepts:
- Email addresses: `user@example.com`
- Phone numbers (E.164 format recommended): `+14155552671`

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | OTP generated and sent | `{ "message": "OTP sent to user@example.com" }` |
| 400 | Invalid or missing identifier | `{ "message": "<validation error>" }` |
| 429 | Rate limit exceeded (>3 sends per 10 min) | `{ "message": "Too many OTP requests. Try again after <ISO timestamp>." }` |

---

### `POST /auth/verify`

Submit a code to verify identity.

**Request body**

```json
{ "identifier": "user@example.com", "code": "472813" }
```

**Responses**

| Status | Condition | Body |
|--------|-----------|------|
| 200 | Code matches, not expired, not used, attempts OK | `{ "message": "Verified", "session_token": "<uuid>" }` |
| 400 | No OTP on record | `{ "message": "No OTP found for this identifier. Please request a new code." }` |
| 400 | Code expired (>10 min old) | `{ "message": "OTP has expired. Please request a new code." }` |
| 400 | Code already used | `{ "message": "OTP has already been used. Please request a new code." }` |
| 400 | Wrong code | `{ "message": "Invalid or expired code", "attempts_remaining": N }` |
| 429 | ≥5 incorrect attempts (brute-force lock) | `{ "message": "OTP locked after too many failed attempts. Please request a new code.", "attempts_remaining": 0 }` |

---

### `GET /health`

```json
{ "status": "ok", "ts": "2024-01-15T10:30:00.000Z" }
```

---

## Security Design

All security rules from the assessment are enforced:

| Rule | Implementation |
|------|---------------|
| **OTP storage** | bcrypt hash (cost 12) stored; plaintext never persisted |
| **Code expiry** | `expiresAt = createdAt + 10 min`; checked on every verify |
| **Brute-force limit** | Attempt counter per record; locked at 5 failures → 429 |
| **Send rate limit** | Per-identifier sliding window; max 3 sends per 10 min → 429 |
| **Code reuse** | `used` flag set to `true` immediately on successful verify |
| **CSPRNG** | `crypto.randomInt(0, 1_000_000)` — never `Math.random()` |

Rate limits are tracked **per identifier**, not per IP, as required. This correctly handles shared NAT/proxies and correctly isolates users behind the same IP.

---

## CSPRNG Choice

**Function used: `crypto.randomInt(min, max)` from Node.js's built-in `crypto` module.**

### Why `crypto.randomInt`?

- Introduced in Node.js 14.10.0; stable and well-tested in Node ≥ 18.
- Backed by **OpenSSL's `RAND_bytes`**, which uses the operating-system CSPRNG (`/dev/urandom` on Linux/macOS, `BCryptGenRandom` on Windows).
- Provides **unbiased uniform distribution** over the range `[min, max)` using rejection sampling internally — no modulo bias.
- Synchronous variant used (`crypto.randomInt(0, 1_000_000)`) — no async overhead for this short range.

### Why not alternatives?

| Source | Problem |
|--------|---------|
| `Math.random()` | Not cryptographically secure; predictable seed |
| `crypto.randomBytes` + manual modulo | Introduces modulo bias unless carefully rejected; `randomInt` handles this |
| `secrets.token_bytes` (Python) | Wrong language; equivalent to `crypto.randomBytes` |
| UUID v4 | Overkill for 6-digit OTP; still CSPRNG-backed but unnecessarily large entropy |

---

## Hashing Approach

**Algorithm: bcrypt with cost factor 12.**

### Why bcrypt?

OTPs are short (6 decimal digits = ~20 bits of entropy = 1,000,000 possible values). If plaintext codes were stored and the database leaked, an attacker could trivially enumerate all 1,000,000 values and find which users' codes match. A fast hash (MD5, SHA-256) provides almost no protection here — a GPU can check all 1,000,000 SHA-256 hashes in milliseconds.

bcrypt's key property is its **configurable work factor (cost)**. At cost 12:
- Each hash takes ~250–400 ms on typical hardware.
- An attacker who steals the database must spend ~250 ms per guess per identifier.
- Exhausting all 1,000,000 possibilities per user ≈ ~70 CPU-hours — economically unattractive compared to the 10-minute validity window.

### Why not SHA-256 with a salt?

SHA-256 is cryptographically sound but extremely fast (~1 billion hashes/second on a GPU). Even salted SHA-256 would allow an attacker to exhaust the 6-digit space for a stolen record in milliseconds. bcrypt's slowness is intentional and essential here.

### Why not Argon2?

Argon2 is excellent and memory-hard, but `bcrypt` has broader Node.js ecosystem support (`bcrypt` npm package), is battle-tested, and provides sufficient protection for a 6-digit, 10-minute OTP. Argon2 would be preferable for long-lived passwords.

---

## Rate Limit Tracking

Both rate limits are tracked **in memory per identifier**. No IP-based rate limiting is used.

### Send rate limit

```
sendRateLimits: Map<identifier, { count: number, windowStart: Date }>
```

- On each `POST /auth/send`, the map is checked.
- If `now - windowStart >= 10 minutes`, the window resets and count starts at 1.
- If `count >= 3` within the window, return 429.
- Otherwise, increment count and allow.

### Brute-force (attempt) counter

```
otpRecords: Map<identifier, { ..., attempts: number }>
```

- Stored alongside the OTP record itself.
- Incremented on every failed `POST /auth/verify`.
- If `attempts >= 5`, all subsequent verify requests return 429 regardless of the submitted code.
- Requesting a new OTP via `/auth/send` overwrites the record, resetting the attempt counter.

### Production considerations

For a horizontally scaled deployment, move rate-limit state to **Redis** using atomic operations (`INCR`, `EXPIRE`). The in-memory approach is correct and complete for this assessment.

---

## Threat Model

### If the OTP table were leaked, what could an attacker recover?

#### What they CANNOT recover

- **The plaintext OTP codes.** All codes are stored as bcrypt hashes. An attacker who steals the database cannot reverse a bcrypt hash to get the original 6-digit code.
- **Historical codes.** Each new `/auth/send` request overwrites the previous record. Only the most recent (current or expired) OTP per user is retained.
- **Session tokens.** Session tokens are generated and returned to the client but never stored server-side — they are not in the OTP table.

#### What they CAN recover (and the residual risk)

- **Email addresses and phone numbers (identifiers).** These are stored in plaintext as lookup keys. A leaked table reveals your entire user list.
- **Timing metadata.** `createdAt` and `expiresAt` timestamps reveal when users last requested an OTP, which can be used for activity profiling.
- **The `used` flag.** Reveals whether a user successfully authenticated in the last session.
- **The `attempts` counter.** Reveals how many failed verification attempts occurred.
- **Offline brute-force (theoretical).** An attacker with the bcrypt hash and sufficient compute *could* attempt all 1,000,000 OTP values offline. At bcrypt cost 12 (≈300 ms/hash on modern hardware), exhausting the space would take ~70 CPU-hours per record — impractical, especially since the OTP is only valid for 10 minutes. By the time the attacker finishes cracking, the window is closed. This residual risk would be eliminated by using a longer OTP (8+ digits) or a higher bcrypt cost.

#### Summary

The bcrypt hashing provides strong protection against the most likely attack (rapid offline brute-force after a breach). The primary residual exposure is the plaintext identifier list and metadata. To further reduce risk in production: encrypt identifiers at rest (or store hashed identifiers with a separate plaintext lookup table), and reduce metadata retention by clearing records after the expiry window passes.

---

## Running Tests

Start the server in test mode first:

```bash
NODE_ENV=test node src/server.js
```

Then in another terminal:

```bash
node tests/test.js
```

Test coverage:
- Health check endpoint
- Input validation (missing/invalid identifier, malformed codes)
- Happy path: send → verify → session token
- Code reuse prevention
- Brute-force lockout (5 attempts → 429)
- Send rate limiting (4th request → 429)
- Code expiry enforcement
- Verify with no prior send
- Phone number identifier support

---

## Project Structure

```
otp-system/
├── src/
│   ├── server.js              # Express app entry point
│   ├── routes/
│   │   └── auth.js            # POST /auth/send, POST /auth/verify
│   ├── middleware/
│   │   └── logger.js          # Request/response logger
│   ├── store/
│   │   └── otpStore.js        # In-memory OTP + rate-limit store
│   └── utils/
│       ├── crypto.js          # CSPRNG OTP generation, bcrypt hashing
│       └── validation.js      # Identifier and code validators
├── tests/
│   └── test.js                # Automated test suite (no framework required)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Security Checklist

- [x] OTPs generated with `crypto.randomInt` (CSPRNG)
- [x] OTPs stored as bcrypt hashes (cost 12) — never plaintext
- [x] 10-minute expiry enforced on every verify
- [x] Brute-force lock after 5 failed attempts → HTTP 429
- [x] Send rate limit: 3 per 10-minute window per identifier → HTTP 429
- [x] Successful verification immediately sets `used = true`
- [x] Second verify with same code → HTTP 400
- [x] No authentication library used
- [x] All rate limits tracked per identifier, not per IP
#   R o b u s t O T P  
 