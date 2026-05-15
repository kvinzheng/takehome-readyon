# ReadyOn Time-Off

A Time-Off Request UI backed by a mock HCM (Human Capital Management) API. Built to solve the core data-integrity challenges that arise when your UI doesn't own the source of truth.

**Stack:** Next.js 15 (App Router) · TypeScript · TanStack Query v5 · Zustand · Tailwind CSS · Storybook 10 · Vitest

## The Problem

Vacation balances are owned by an external HCM system (like Workday), not by ReadyOn. This creates four hard problems:

- **Optimistic updates** — show instant feedback on submission, but gracefully roll back if the HCM later rejects it
- **Stale data reconciliation** — a user's balance can change underneath them (e.g. a work-anniversary bonus fires) while they're mid-session; surface that without confusing them
- **Silent failures** — the HCM sometimes returns HTTP 200 but never commits the change; the UI must be skeptical and handle late-arriving contradictions
- **Cache invalidation** — when to re-fetch, when to trust local state, how to reconcile a background refresh against an in-flight user action

See [TRD.md](TRD.md) for the full architecture and design decision writeup.

## Views

- **`/employee`** — see leave balances, submit time-off requests
- **`/manager`** — approve or deny pending requests with real-time balance data at decision time

## Running Locally

```bash
npm run dev        # Next.js dev server on :3000
npm run storybook  # Storybook on :6006
npm run test       # Vitest (unit + Storybook interaction tests)
```

All mock HCM endpoints are served by Next.js API routes — no separate process needed.

## Mock HCM Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/hcm/balance` | GET | Real-time single-cell balance read |
| `/api/hcm/balances/batch` | GET | Full balance corpus for all employees |
| `/api/hcm/requests` | GET, POST | List / submit requests |
| `/api/hcm/requests/:id` | GET, PATCH | Fetch / approve / deny |
| `/api/hcm/anniversary-bonus` | POST | Test harness: fire a +5 day bonus |
| `/api/hcm/employees` | GET | List employees |
