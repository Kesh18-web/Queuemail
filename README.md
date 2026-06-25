# Queuemail

A full-stack email scheduling system built with TypeScript. Upload a CSV of recipients, set a future send time, and the system handles the rest — queueing, throttling, retrying, and tracking every email through to delivery.

Built with **Express**, **BullMQ**, **Redis**, **MySQL**, and a **Next.js** dashboard.

---

## What it does

- Schedule a bulk email campaign for a future time
- Each recipient gets its own queued job with an individually calculated send time
- A background worker processes jobs, enforces rate limits, and sends via SMTP
- Sent emails generate a live preview URL (via Ethereal) so you can inspect the actual content
- The dashboard shows all scheduled and sent emails with real-time status
- Server restarts are safe — all queued jobs survive in Redis and resume automatically

---

## Architecture

```
Browser (Next.js)
      │
      ▼
  Express API  ──────────────►  MySQL
      │                      (campaigns, dispatches,
      │                       sender accounts)
      ▼
  BullMQ Queue
  (Redis)
      │
      ▼
  Worker Process
  ├── checks DB for duplicate sends
  ├── evaluates rate limits (Redis counters)
  ├── sends email via SMTP (Ethereal)
  └── updates dispatch status + preview URL
```

The API and worker run in the same Express process. All deferred work goes through BullMQ — no cron jobs.

---

## Database schema

| Table | Purpose |
|---|---|
| `User` | Google OAuth user records |
| `MailCampaign` | One row per campaign (subject, body, schedule config) |
| `MailDispatch` | One row per recipient per campaign — tracks status, send time, preview URL |
| `SenderAccount` | SMTP credentials; persisted so the same account survives restarts |

`MailDispatch` statuses: `PENDING` → `SCHEDULED` → `SENDING` → `SENT` / `FAILED` / `RATE_LIMITED`

---

## Scheduling logic

When you create a campaign via `POST /api/campaigns`:

1. A `MailCampaign` row is inserted
2. For each recipient, a `MailDispatch` row is created with a calculated `scheduledTime`:
   ```
   scheduledTime = startTime + (index × delayBetweenMs)
   ```
3. A BullMQ delayed job is enqueued for each dispatch with a matching delay
4. Jobs fire at the right time even after a server restart, because BullMQ state lives in Redis

---

## Worker & delivery

The worker listens to the `reachinboxScheduler` queue with configurable concurrency.

For each job it:
1. Checks if the dispatch is already `SENT` — skips if so (idempotency guard)
2. Marks the dispatch `SENDING`
3. Runs the rate limit check
4. Sends the email via the persisted SMTP account
5. Updates the dispatch to `SENT` and stores the Ethereal preview URL

**On rate limit hit:** rolls back the Redis counter increment, marks the dispatch `RATE_LIMITED`, and reschedules the job for the start of the next hour window. No emails are dropped.

**On failure:** marks the dispatch `FAILED` with an error message. BullMQ retries up to 3 times with exponential backoff (starting at 5 s).

---

## Rate limiting

Two Redis counters are incremented per email, keyed by the current UTC hour:

```
reachSessionLimit:global:YYYY-MM-DD-HH
reachSessionLimit:{senderId}:YYYY-MM-DD-HH
```

Both the global hourly cap and the per-sender cap must pass before an email is sent. If either limit is exceeded, both increments are rolled back before rescheduling.

Defaults (configurable via env):
- Global limit: `200` emails/hour
- Per-sender limit: `50` emails/hour

---

## Restart safety

Nothing is lost on restart because state lives in two durable stores:

- **MySQL** — all campaign and dispatch records
- **Redis** — all BullMQ delayed jobs

On startup, BullMQ reconnects to Redis and delayed jobs resume firing on schedule. The worker also guards against duplicate sends by checking the dispatch status before processing.

---

## Preview URLs (Ethereal)

Emails are sent through [Ethereal](https://ethereal.email), a free fake SMTP service. No real emails are delivered.

On startup, the app loads the sender account from `SenderAccount` in MySQL (or creates a new Ethereal account and persists it if none exists). This means the same inbox is reused across restarts — your sent emails do not disappear.

Every sent email returns a preview URL that is stored on the `MailDispatch` record and shown as a clickable link in the dashboard.

---

## API routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users` | Create or update a user (Google OAuth) |
| `POST` | `/api/campaigns` | Create a campaign and schedule all dispatches |
| `GET` | `/api/dispatches/scheduled` | Pending/scheduled dispatches for a user |
| `GET` | `/api/dispatches/sent` | Sent/failed dispatches for a user |
| `GET` | `/api/status` | Rate limit status and queue health |

---

## Running locally

### Prerequisites

- Node.js 18+
- Docker

### 1. Start MySQL and Redis

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
npm install
npm run db:migrate
npm run dev
```

Runs on `http://localhost:3001`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000`.

---

## Environment variables

Create a `.env` file in `backend/`:

```env
PORT=3001

DB_HOST=localhost
DB_PORT=3307
DB_USER=user
DB_PASSWORD=password
DB_NAME=reachinbox_email

REDIS_HOST=localhost
REDIS_PORT=6379

MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5

JWT_SECRET=change-this-in-production
```

Create a `.env.local` file in `frontend/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
