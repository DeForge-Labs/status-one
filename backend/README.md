# Backend Server

## Requirements

- [Bun](https://bun.com) runtime (v1.3.5+)

## Setup

Install dependencies:

```bash
bun install
```

## Running the Server

**Development** (with hot reload):
```bash
bun run dev
```

**Production:**
```bash
bun run start
```

The server starts on `http://localhost:3000` by default.

## Environment Variables

Create a `.env` file in the root of the backend directory. The following variables are supported:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP server listens on |
| `JWT_SECRET` | `change-me-to-a-random-secret` | Secret used to sign JWT tokens — **must be changed in production** |
| `SMTP_HOST` | _(empty)_ | SMTP server hostname for outbound email |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Set to `true` to use TLS (port 465) |
| `SMTP_USER` | _(empty)_ | SMTP authentication username |
| `SMTP_PASS` | _(empty)_ | SMTP authentication password |
| `SMTP_FROM` | `Status One <noreply@example.com>` | From address for outbound emails |

## Database

The server uses **SQLite** (via Bun's built-in driver). The database file is created automatically at:

```
data/status-one.db
```

Migrations and default settings are applied automatically on every startup — no manual migration step is needed.

## Project Structure

```
index.js              # Entry point — boots DB, app, and background services
src/
  app.js              # Express app factory, route registration, middleware
  config.js           # Central config (reads from env variables)
  database/
    connection.js     # SQLite connection singleton
    migrations.js     # Schema migrations (auto-run on startup)
    seed.js           # Default settings seeder (auto-run on startup)
  middleware/         # Express middleware (auth, rate limiting, error handling)
  models/             # Database model helpers (queries per entity)
  routes/             # Express route handlers grouped by resource
  services/           # Background services (monitor engine, notifier, cron jobs)
    checkers/         # Protocol-specific check implementations (HTTP, TCP, DNS, etc.)
  utils/              # Shared utilities (logger, crypto, validators)
```

## API Routes

All API routes are prefixed with `/api`.

| Prefix | Description |
|---|---|
| `/api/setup` | First-run admin account creation |
| `/api/auth` | Login, logout, token refresh |
| `/api/users` | User management |
| `/api/monitors` | Monitor CRUD and status |
| `/api/incidents` | Incident management |
| `/api/status-pages` | Status page configuration |
| `/api/notifications` | Notification channel management |
| `/api/maintenance` | Maintenance window management |
| `/api/analytics` | Analytics and uptime stats |
| `/api/settings` | Global application settings |
| `/api/api-keys` | API key management |
| `/api/tags` | Tag management |
| `/api/system` | System info and health |
| `/api/public` | Unauthenticated public status data |
| `/api/telegram` | Telegram bot webhook |
| `/api/ext` | API-key-authenticated external access |

Protected routes accept either a **JWT** (`Authorization: Bearer <token>`) or an **API key** (`X-API-Key: <key>`) header.

## Background Services

The following services start automatically with the server:

- **Monitor Engine** — polls active monitors at their configured intervals
- **Analytics Cron** — aggregates uptime statistics on a schedule
- **Data Retention Cron** — prunes old check results (default: 90-day retention)
- **Heartbeat Check** — expires stale heartbeat monitors

Default monitor behaviour (configurable via settings):

| Setting | Default |
|---|---|
| Check interval | 60 seconds |
| Check timeout | 10 000 ms |
| Retries before incident | 3 |
| Check data retention | 90 days |
| Stats retention | 365 days |

## Rate Limiting

- Global: **200 requests / minute** per IP
- Auth routes (`/api/auth`): **20 requests / minute** per IP

## First Run

On first startup with an empty database, all routes except `/api/setup` and `/api/public` are blocked until an admin account is created via `POST /api/setup`.
