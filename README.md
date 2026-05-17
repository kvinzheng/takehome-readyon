# ReadyOn Time-Off

A time-off request management app built to solve the core data-integrity challenges that arise when your UI doesn't own the source of truth.

**Stack:** Next.js 16 (App Router) · TypeScript · NextAuth v5 · Tailwind CSS · Storybook · Vitest

## The Problem

Vacation balances are owned by an external PTO system (like Workday), not by ReadyOn. This creates four hard problems:

- **Optimistic updates** — show instant feedback on submission, roll back cleanly if the PTO system rejects it
- **Stale data** — a user's balance can change underneath them (e.g. work-anniversary bonus) while they're mid-session
- **Silent failures** — the PTO system sometimes returns HTTP 200 but never commits the change
- **Cache invalidation** — when to re-fetch, when to trust local state, how to reconcile a background update against an in-flight user action

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Employee | alice@readyon.com | alice123 |
| Manager | carol@readyon.com | carol123 |

## Running Locally

```bash
echo 'AUTH_SECRET=dev-secret-change-in-prod' > .env.local
npm run dev        # http://localhost:3000
npm run storybook  # http://localhost:6006
```

## Testing

```bash
npm test                # Unit + acceptance + component tests (Vitest, jsdom)
npm run test:all        # All Vitest projects including Storybook interaction tests
npm run test:integration # Integration tests only (verbose)
```

---

## Architecture

### Rendering model

Every page is a **Server Component** that fetches data, then passes it as props to a `*Client` component that owns all interactivity. No client-side data fetching for initial loads.

```
/login     → LoginForm (Client)
/employee  → EmployeePage (Server) → EmployeeClient (Client)
/manager   → ManagerPage  (Server) → ManagerClient  (Client)
```

### Component tree

```
RootLayout
├── Providers (SessionProvider — gives Client Components useSession())
├── /employee  EmployeePage (Server Component)
│   ├── auth() — reads JWT cookie, no network round-trip
│   ├── isWorkAnniversary() — grants +5 day bonus at login if today matches hire date
│   ├── dalGetEmployeeBalances() ─┐ parallel fetches
│   ├── dalGetEmployeeRequests() ─┘
│   └── EmployeeClient (Client Component)
│       ├── useSSESync()         — persistent EventSource, calls router.refresh() on push
│       ├── useTimeOffSubmit()   — optimistic deduction, silent-failure detection, rollback
│       ├── BalanceCard[]
│       ├── TimeOffForm
│       └── RequestCard[]
└── /manager  ManagerPage (Server Component)
    ├── auth() — role guard
    ├── dalGetPendingRequests()
    ├── dalGetBalance() × N      — live balance per request, parallel
    └── ManagerClient (Client Component)
        ├── handleApprove / handleDeny  — useTransition, pessimistic
        └── RequestCard[]
```

### Data flow layers

| Layer | Files | Responsibility |
|---|---|---|
| **Route handlers** | `src/app/api/pto/*/route.ts` | Mock PTO system — all mutable state lives here |
| **Store** | `src/lib/pto-store.ts` | In-process singleton — balance deduction, anniversary, request state |
| **DAL** | `src/lib/pto-dal.ts` | Typed wrappers over the store with simulated latency |
| **Server Actions** | `src/app/actions.ts` | Auth-gated mutations — `submitTimeOff`, `approveTimeOff`, `denyTimeOff`, `login`, `logout` |
| **Server Components** | `src/app/*/page.tsx` | Fetch + pass props, no client state |
| **Client hooks** | `src/hooks/` | `useTimeOffSubmit` (optimistic submit), `useSSESync` (real-time push) |
| **Client Components** | `src/components/*/` | Pure UI — render props, emit events |
| **SSE bus** | `src/lib/sse-bus.ts` | In-process EventEmitter connecting route handlers to open browser tabs |

### Real-time balance updates (SSE)

Work-anniversary bonuses surface in real time without polling:

```
Employee logs in
  → EmployeePage (Server) checks isWorkAnniversary()
  → grantAnniversaryBonus() mutates store
  → emitBalanceUpdate() fires on SSE bus
      → GET /api/pto/events pushes frame to every open tab
          → useSSESync() receives "balance-update"
              → router.refresh() re-renders Server Component
                  → BalanceCard shows +5 days

Current tab: already has the bonus baked into initialBalances (no refresh needed)
Other open tabs: receive the SSE push and refresh automatically
```

**Why SSE and not polling or WebSockets?**
- The bonus is server-initiated and one-way — SSE is the right primitive
- `EventSource` reconnects automatically; no manual retry logic needed
- WebSockets would be overkill (no client→server data on this channel)

> **Note:** The in-process `EventEmitter` bus works for single-instance deployments. Multi-replica deployments would replace it with Redis pub/sub.

### Auth

NextAuth v5 with a JWT strategy. The `role` claim (`employee` | `manager`) is embedded in the token and enforced in:
- `middleware.ts` — redirects at the edge before any page renders
- Each `page.tsx` — secondary guard with typed `getSessionUser()` helper
- Each Server Action — re-validates before any mutation

**Accessing session data:**
- Server Components: `await auth()` — reads cookie directly, no network
- Client Components: `useSession()` from `next-auth/react` — available via `SessionProvider` in `providers.tsx`

### Key design decisions

**Optimistic updates (employee) / pessimistic (manager)**
Employees see instant feedback on submission — the balance deducts optimistically and rolls back on error. Managers wait for a real confirmation before seeing state change — a wrong approval has legal/pay consequences.

**Silent failure defence**
HCM may return HTTP 200 with `status: "silent_failure"`. `useTimeOffSubmit` detects this and shows a warning instead of a success banner. The `router.refresh()` triggered by the next SSE event (or manual navigation) reconciles the balance back to the real value.

**No client-side data fetching hooks**
In App Router, Server Components fetch data. Hooks own client-side mutations and reactive state only. Moving fetches to hooks would lose SSR, introduce waterfalls, and require manual cache management.

**Router cache for cross-page persistence**
Next.js caches RSC payloads client-side for the session. Employee → Manager → back to Employee reuses the cached payload — no re-fetch, no hook needed.

---

## File Structure

```
src/
  app/
    actions.ts            # Server Actions (auth-gated mutations)
    providers.tsx          # SessionProvider — global client state root
    api/pto/              # Mock PTO route handlers
      balance/            # GET  single balance
      balances/batch/     # GET  all balances
      employees/          # GET  employee list
      events/             # GET  SSE stream (balance-update push)
      requests/           # GET, POST  list / submit
      requests/[id]/      # GET, PATCH approve / deny
      anniversary-bonus/  # POST test harness: trigger bonus manually
    employee/page.tsx     # Server Component — anniversary check + data fetch
    manager/page.tsx      # Server Component — pending requests + live balances
    login/page.tsx        # Login page
  components/
    employee/             # BalanceCard, TimeOffForm, EmployeeClient
    manager/              # ManagerClient
    shared/               # RequestCard, StatusBanners, LoginForm
  hooks/
    use-time-off-submit.ts # Optimistic submit + error/success state
    use-sse-sync.ts        # EventSource subscription → router.refresh()
  lib/
    pto-store.ts          # In-memory store (balances, requests, anniversary)
    pto-dal.ts            # Typed DAL with simulated latency
    pto-api.ts            # Client-side fetch helpers (test harness)
    sse-bus.ts            # EventEmitter pub/sub for SSE
  tests/
    unit/                 # pto-store pure logic
    components/           # BalanceCard, RequestCard, TimeOffForm
    integration/          # employee-view, manager-view, request-lifecycle, time-off-submission
    acceptance/           # Per-route AC: optimistic updates, rollback, silent failures, a11y
```

## Mock PTO Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/pto/balance` | GET | Real-time single-cell balance |
| `/api/pto/balances/batch` | GET | Full balance corpus |
| `/api/pto/requests` | GET, POST | List / submit requests |
| `/api/pto/requests/:id` | GET, PATCH | Fetch / approve / deny |
| `/api/pto/events` | GET | SSE stream — balance-update push |
| `/api/pto/anniversary-bonus` | POST | Test harness: trigger bonus manually |
| `/api/pto/employees` | GET | List employees |

