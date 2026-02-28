<div align="center">

<img src="frontend/public/logo.png" alt="Status One Logo" width="120" />

# Status One

**Self-hosted uptime monitoring & beautiful status pages**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://github.com/DeForge-Labs/status-one/pkgs/container/status-one-backend)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-f9f1e1?logo=bun)](https://bun.sh)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)

*Monitor your websites, APIs, and services. Alert your team instantly. Show the world your uptime.*

</div>

---

## Overview

Status One is a lightweight, self-hosted uptime monitoring platform built by [DeForge Labs](https://github.com/DeForge-Labs). It provides real-time monitoring of your infrastructure, beautiful public status pages, intelligent incident management, and multi-channel notifications — all running on a single SQLite database with zero external dependencies.

---

## Screenshots


---

## Features

### Monitoring

| Type | Description |
|---|---|
| **HTTP(S)** | Monitor endpoints with custom methods, headers, body, auth (Basic/Bearer), and accepted status codes |
| **Keyword** | HTTP check + verify a keyword exists (or doesn't) in the response body |
| **Ping** | ICMP ping monitoring |
| **TCP** | TCP port connectivity checks |
| **DNS** | DNS record resolution (A, AAAA, CNAME, MX, TXT, etc.) |
| **SSL** | SSL certificate expiry monitoring with configurable warning threshold |
| **Push / Heartbeat** | Passive monitoring — your services push heartbeats to Status One |

**Additional capabilities:**
- Configurable check intervals (10s – 24h), timeouts, and retry logic
- Degraded state detection (response time threshold)
- Per-monitor notification channel linking
- Tag-based organization with color-coded labels
- Pause/resume and one-off test checks
- Status badges for individual monitors

### Status Pages

- **Public-facing pages** at `/status/your-slug` — no login required
- **Custom domain support** — point your domain and it resolves automatically
- **Branding** — custom logo, header text, footer text, and injected CSS
- **Light & dark themes** per page
- **90-day uptime history** visualization with daily bars
- **Active incidents & maintenance** display with live updates
- **Embeddable uptime badges** — 5 SVG styles with Markdown/HTML snippets
- **Auto-refresh** every 60 seconds
- **Published / draft** toggle for controlling visibility

### Incident Management

- **Auto-detection** — incidents created automatically after consecutive check failures
- **Auto-resolution** — incidents resolved when monitor recovers
- **Manual incidents** — create and track incidents independently
- **Status workflow** — Investigating → Identified → Monitoring → Resolved
- **Timeline updates** — add detailed status messages to track progress
- **Notifications** sent on creation, updates, and resolution

### Maintenance Windows

- Scheduled maintenance periods with start/end times
- Per-monitor or global scope
- Recurring schedules via cron expressions
- Monitors in maintenance are automatically skipped (no false alerts)

### Notifications

| Channel | Highlights |
|---|---|
| **Email** | SMTP-based HTML emails with status-prefixed subjects |
| **Discord** | Color-coded rich embed notifications via webhooks |
| **Telegram** | Bot notifications with subscriber management (`/start`, `/stop`) |
| **Webhook** | JSON payloads with HMAC-SHA256 signature verification |
| **Slack** | Slack-compatible webhook integration |

Events: Monitor Down, Recovered, Degraded, Incident Updates, and Test notifications.

### Analytics & Data

- Dashboard overview with real-time status of all monitors
- 24h / 7d / 30d / 90d uptime percentages and average response times
- Response time charts (area charts with gradient fills)
- Daily stats aggregation via cron (total checks, up/down/degraded counts, avg/min/max response)
- Configurable data retention (default: 90 days raw, 365 days aggregated)

### User & Access Management

- **First-run setup wizard** — guided admin account creation
- **Multi-user support** with safety guards (can't delete last admin)
- **JWT authentication** (7-day expiry) for the web dashboard
- **API key authentication** (`X-API-Key`) for external integrations
- **Password reset via email** with time-limited tokens
- **Rate limiting** — 200 req/min global, 20 req/min on auth endpoints

### System Administration

- Health check endpoint (public, no auth)
- System info (version, runtime, DB size, monitor counts, memory)
- Database backup (SQLite `VACUUM INTO`)
- Purge old check data
- Factory reset with confirmation safeguard
- Configurable application settings (app name, URL, retention periods, cron schedules)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Runtime | [Bun](https://bun.sh) |
| Backend Framework | [Express.js](https://expressjs.com) |
| Database | [SQLite](https://sqlite.org) (WAL mode, zero-config) |
| Frontend | [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Charts | [Recharts](https://recharts.org) |
| Icons | [Lucide React](https://lucide.dev) |

---

## Quick Start with Docker (Recommended)

The fastest way to get Status One running. Requires [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Clone the repository

```bash
git clone https://github.com/DeForge-Labs/status-one.git
cd status-one
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
# IMPORTANT: Generate a strong random secret
JWT_SECRET=your-random-secret-here

# URL the browser uses to reach the backend API
# Use your server IP or domain if not running locally
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

> **Tip:** Generate a JWT secret with: `openssl rand -hex 32`

### 3. Start the application

```bash
docker compose build
docker compose up -d
```

That's it! Open **http://localhost:3001** in your browser. You'll be guided through the setup wizard to create your admin account.

### Updating

```bash
docker compose pull
docker compose up -d
```

### Volumes

| Volume | Purpose |
|---|---|
| `status-one-data` | SQLite database and backups — **back this up!** |

---

## Manual Setup (Development)

### Prerequisites

- [Bun](https://bun.sh) v1.3.5+ (backend)
- [Node.js](https://nodejs.org) v22+ (frontend)

### Backend

```bash
cd backend
cp .env.example .env    # Edit with your settings
bun install
bun run start           # Production
bun run dev             # Development (hot reload)
```

The backend starts on `http://localhost:3000` by default.

### Frontend

```bash
cd frontend
cp env.local.example .env.local    # Set NEXT_PUBLIC_API_URL
npm install
npm run build && npm start          # Production
npm run dev                         # Development
```

The frontend starts on `http://localhost:3001` by default.

---

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Backend HTTP port |
| `JWT_SECRET` | `change-me-to-a-random-secret` | **Change this!** Secret for JWT signing |
| `SMTP_HOST` | *(empty)* | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for SMTP |
| `SMTP_USER` | *(empty)* | SMTP username |
| `SMTP_PASS` | *(empty)* | SMTP password |
| `SMTP_FROM` | `Status One <noreply@example.com>` | Sender address for emails |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api` | Backend API URL (used by browser) |
| `MAIN_DOMAINS` | *(empty)* | Domains not to be used for status pages (basically dashboard url) |

---

## Reverse Proxy (Production)

For production deployments behind Nginx or Caddy:

<details>
<summary><strong>Nginx example</strong></summary>

```nginx
server {
    listen 80;
    server_name status.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

</details>

<details>
<summary><strong>Caddy example</strong></summary>

```caddyfile
status.yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:3000
    }
    handle {
        reverse_proxy localhost:3001
    }
}
```

</details>

When using a reverse proxy, update your `.env`:

```env
NEXT_PUBLIC_API_URL=https://status.yourdomain.com/api
```

---

## Project Structure

```
status-one/
├── backend/                  # Bun + Express API server
│   ├── src/
│   │   ├── database/         # SQLite connection, migrations, seeds
│   │   ├── middleware/        # Auth, rate limiting, error handling
│   │   ├── models/           # Data models (monitors, incidents, etc.)
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Monitor engine, notifiers, analytics
│   │   │   └── checkers/     # HTTP, TCP, Ping, DNS, SSL, Keyword checks
│   │   └── utils/            # Crypto, helpers, logger, validators
│   └── data/                 # SQLite database files (auto-created)
├── frontend/                 # Next.js 16 web application
│   ├── app/                  # App Router pages
│   │   ├── (auth)/           # Login, setup, password reset
│   │   ├── (dashboard)/      # Dashboard, monitors, incidents, etc.
│   │   └── status/[slug]/    # Public status pages
│   ├── components/           # Reusable UI components
│   ├── contexts/             # Auth & theme providers
│   ├── hooks/                # Custom hooks (polling)
│   └── lib/                  # API client & utilities
├── docker-compose.yml        # One-click deployment
└── .github/workflows/        # CI/CD pipeline
```

---

## License

Status One is open-source software licensed under the [GNU General Public License v3.0](LICENSE).

---

## Note

This project was mostly vibe coded.

Also, you might ask, why does this project exist ? The reason is, we were looking for a self hostable solution for status page. There are quite a few options in that regard. We chose [uptime kuma](https://uptime.kuma.pet/) for our status page. We were even using it in our beta phase. But it has a major drawback, no incident retention. So, we planned on switching to something else. We were thinking of [Gatus](https://gatus.io/) but then decided on [openstatus](https://www.openstatus.dev/). But I failed at hosting openstatus because there were just too many complications and I just couldn't fix everything. Hence, status-one was made as a simple alternative with just the features we need.

---

<div align="center">

Made with care by [DeForge Labs](https://github.com/DeForge-Labs)

</div>
