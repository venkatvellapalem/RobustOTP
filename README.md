# RobustOTP

### *The Enterprise-Grade, Abuse-Resistant One-Time Password Microservice*

RobustOTP is a decoupled, security-hardened authentication gateway designed to manage one-time password (OTP) verification with zero-knowledge data retention, intelligent billing protection, and complete session integrity.

---

## Key Defensive Pillars

*   🛡️ **Cryptographic Device Binding**: Binds OTP codes mathematically to the requesting client’s IP address and browser fingerprint. Attempts to verify a code from a mismatched device are rejected immediately, neutralizing interception and MITM session attacks.
*   ⏱️ **Exponential Backoff Throttling**: Enforces progressive wait times between consecutive OTP requests. Scaled delay intervals throttle brute-force automation and email flooding before they can hit your server pool.
*   🍯 **Deceptive Honeypot Shielding**: Redirects automated flood attacks exceeding request limits to a mock success gateway. Attack scripts receive realistic confirmations while database writes and external email carrier API billing are bypassed entirely.
*   🔒 **Zero-Knowledge Storage**: Plaintext codes are never stored in the database. Every token is processed instantly using bcrypt cryptographic hashing, ensuring complete user account security even in the event of a total database breach.
*   🧹 **Zero-Footprint Purging**: An automated database self-cleaning routine continuously scrubs verified and expired codes from storage. Your database footprint remains clean and under budget indefinitely.
*   🔄 **Database Hibernation Prevention**: A built-in keep-alive cron scheduler automatically handles periodic database pings, preventing remote serverless database instances from falling into idle hibernation.

---

## Quick Onboarding

### Live Demonstration
Skip the installation completely and test the security, rate-limiting, and verification systems directly in your browser:
👉 **[Evaluate Live on Vercel](https://robust-otp-cytrus.vercel.app/)**

---

### Zero-Config Local Installation
Evaluate RobustOTP locally with a single command. The installer handles dependencies, configures environment files, and initializes a local SQLite database automatically.

#### Windows (PowerShell)
```powershell
irm https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.ps1 | iex
```

#### macOS & Linux (Shell)
```bash
curl -fsSL https://raw.githubusercontent.com/venkatvellapalem/RobustOTP/main/install.sh | bash
```

---

### Production Deployment
To deploy RobustOTP in a production environment with a dedicated PostgreSQL database:

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/venkatvellapalem/RobustOTP.git
    cd RobustOTP
    ```
2.  **Install Dependencies**:
    ```bash
    npm install --production
    ```
3.  **Configure Environment**:
    Copy `.env.example` to `.env` and configure your API keys and database credentials:
    *   `DATABASE_URL`: Your PostgreSQL / Neon database connection string.
    *   `BREVO_API_KEY`: Your Brevo transactional email API key.
    *   `CRON_SECRET`: A secure token to authorize Vercel keep-alive cron jobs.
4.  **Initialize Schema & Run**:
    ```bash
    npx prisma db push
    npm start
    ```

---

## API Specifications

All request payloads and responses use standard JSON formatting.

| Endpoint | Method | Headers | Payload | Description |
|---|---|---|---|---|
| `/auth/send` | `POST` | — | `{ "identifier": "email@example.com" }` | Generates a hashed OTP, dispatches it via email, and returns a transaction confirmation. |
| `/auth/verify` | `POST` | `User-Agent` | `{ "identifier": "email@example.com", "code": "123456" }` | Validates code correctness, device fingerprint, and returns a secure `session_token`. |
| `/api/cron` | `GET` | `Authorization: Bearer <SECRET>` | — | Triggered by the scheduler to delete expired data and keep database engines active. |
| `/health` | `GET` | — | — | Returns `200 OK` and system status metadata. |
| `/health/email` | `GET` | — | — | Checks SMTP connection readiness and transactional API health. |

---

## Automated Verification Suite

RobustOTP includes an integration testing suite covering healthy code dispatches, brute-force lockout, backoffs, honeypot deflection, and fingerprint mismatches.

To execute the test suite:
1.  Launch the server in test mode:
    ```bash
    NODE_ENV=test npm start
    ```
2.  Run the test runner:
    ```bash
    npm test
    ```
