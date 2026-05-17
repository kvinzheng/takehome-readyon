# ReadyOn Time-Off

A time-off request management app built to solve the core data-integrity challenges that arise when your UI doesn't own the source of truth.

**Stack:** Next.js 16 (App Router) · TypeScript · NextAuth v5 · Tailwind CSS · Storybook · Vitest · Playwright

## The Problem

Vacation balances are owned by an external PTO system (like Workday), not by ReadyOn. This creates four hard problems:

- **Optimistic updates** — show instant feedback on submission, but gracefully roll back if the PTO system later rejects it
- **Stale data reconciliation** — a user's balance can change underneath them (e.g. a work-anniversary bonus fires) while they're mid-session; surface that without confusing them
- **Silent failures** — the PTO system sometimes returns HTTP 200 but never commits the change; the UI must be skeptical and handle late-arriving contradictions
- **Cache invalidation** — when to re-fetch, when to trust local state, how to reconcile a background refresh against an in-flight user action

See [TRD.md](TRD.md) for the full architecture and design decision writeup.

## Views

- **`/login`** — credential login (employee or manager)
- **`/employee`** — see PTO balances, submit time-off requests
- **`/manager`** — approve or deny pending requests with real-time balance data at decision time

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Employee | alice@readyon.com | alice123 |
| Manager | carol@readyon.com | carol123 |

## Running Locally

```bash
# Required — NextAuth session signing
echo 'AUTH_SECRET=dev-secret-change-in-prod' > .env.local

npm run dev        # Next.js dev server on :3000
npm run storybook  # Storybook on :6006
```

All mock PTO endpoints are served by Next.js API routes — no separate process needed.

## Testing

```bash
npm test              # Unit + acceptance tests (Vitest, no server needed)
npm run test:e2e      # Full E2E suite (Playwright, requires dev server on :3000)
npm run test:storybook # Storybook interaction tests
```

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest + jsdom | `pto-store`, individual components |
| Acceptance | Vitest + jsdom | Per-route AC (optimistic updates, rollback, silent failures, WCAG, keyboard focus) |
| Component | Vitest + jsdom | `BalanceCard`, `RequestCard`, `TimeOffForm` |
| E2E | Playwright | Full browser flow against live server — auth, navigation, real API |

## Mock PTO Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/pto/balance` | GET | Real-time single-cell balance read |
| `/api/pto/balances/batch` | GET | Full balance corpus for all employees |
| `/api/pto/requests` | GET, POST | List / submit requests |
| `/api/pto/requests/:id` | GET, PATCH | Fetch / approve / deny |
| `/api/pto/anniversary-bonus` | POST | Test harness: fire a +5 day bonus |
| `/api/pto/employees` | GET | List employees |
