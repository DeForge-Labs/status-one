# Frontend

Built with [Next.js](https://nextjs.org) 16 (App Router), React 19, and Tailwind CSS v4.

## Prerequisites

- [Node.js](https://nodejs.org) 18+ or [Bun](https://bun.sh)
- The backend API must be running (see the backend README)

## Setup

1. Copy the example environment file and fill in the values:

   ```bash
   cp env.local.example .env.local
   ```

2. Install dependencies:

   ```bash
   bun install
   # or
   npm install
   ```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Base URL of the backend API |

## Running

```bash
# Development (with hot reload)
bun dev

# Production build
bun run build
bun start
```

The app will be available at [http://localhost:3000](http://localhost:3000) by default.

## Linting

```bash
bun run lint
```

---

## Project Structure

```
app/                    # Next.js App Router
  (auth)/               # Unauthenticated pages (login, setup, password reset)
  (dashboard)/          # Authenticated dashboard pages
    dashboard/          # Overview dashboard
    monitors/           # Monitor management
    incidents/          # Incident management
    maintenance/        # Maintenance windows
    status-pages/       # Status page management
    notifications/      # Notification channels
    api-keys/           # API key management
    users/              # User management
    settings/           # Account/org settings
    profile/            # User profile
  status/[slug]/        # Public-facing status pages (also used for custom domains)

components/
  ui/                   # Base UI primitives (Button, Card, Modal, Input, etc.)
  dashboard/            # Dashboard-specific components (Sidebar, etc.)
  monitor-form.js       # Shared monitor create/edit form
  response-chart.js     # Response time chart
  uptime-bar.js         # Uptime history bar

contexts/
  auth.js               # Authentication state (current user, login/logout)
  theme.js              # Light/dark/system theme state

hooks/
  use-polling.js        # Hook for polling an API endpoint on an interval

lib/
  api.js                # API client (wraps all backend endpoints)
  utils.js              # General utility helpers
```

---

## Key Concepts

### API Client

All backend calls go through `lib/api.js`. It automatically attaches the JWT from `localStorage` to every request. When a `401` is returned, the token is cleared and the user is redirected to `/login`.

To call a new endpoint, add a function to `lib/api.js` following the existing pattern and import it where needed.

### Authentication

Auth state is managed by `AuthContext` (`contexts/auth.js`). Access it in any client component with `useAuth()`:

```js
import { useAuth } from '@/contexts/auth';

const { user, login, logout } = useAuth();
```

The JWT is stored in `localStorage` under the key `status_one_token`. On first load the app checks the setup status — if the instance has no admin yet it redirects to `/setup`.

### Theming

Theme preference (`light`, `dark`, `system`) is stored in `localStorage` under `status_one_theme` and managed by `ThemeContext`. A small inline `<script>` in `app/layout.js` applies the `dark` class before hydration to prevent a flash of unstyled content.

To support dark mode in a new component, use Tailwind's `dark:` variant.

### Route Groups

- `(auth)` — shares a minimal layout with no sidebar. Redirects to `/dashboard` when already logged in.
- `(dashboard)` — requires authentication. The shared layout renders the sidebar.
- `status/[slug]` — fully public. Also handles custom domain rewrites via `middleware.js`.

### Custom Domain Routing

`middleware.js` intercepts requests from hostnames that are **not** listed in `MAIN_DOMAINS`. It queries the API to resolve the hostname to a status page slug and transparently rewrites the request to `/status/[slug]`. No changes are needed in the status page components themselves.

### UI Components

Reusable primitives live in `components/ui/`. They accept a `className` prop for overrides. Prefer these over one-off markup directly in pages.

| Component | Usage |
|---|---|
| `Button` | All clickable actions |
| `Card` | Content containers |
| `Input` / `Textarea` / `Select` | Form fields |
| `Modal` | Dialog overlays |
| `Badge` | Status labels |
| `Spinner` | Loading states |
| `EmptyState` | Empty list placeholders |
| `Pagination` | List pagination |
