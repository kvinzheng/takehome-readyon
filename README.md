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
| **Route handlers** | `src/app/route/pto/*/route.ts` | Thin HTTP wrappers — parse request, call handler, serialize response |
| **Handlers** | `src/route/pto/*.ts` | Pure handler functions — all business logic, typed errors, fully unit-testable |
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
      → GET /route/pto/events pushes frame to every open tab
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
- `proxy.ts` — edge middleware that redirects unauthenticated and wrong-role requests before any page renders
- Each `page.tsx` — secondary guard with typed `getSessionUser()` helper; `/login` redirects authenticated users to their role-based page
- Each Server Action — re-validates before any mutation

**Accessing session data:**
- Server Components: `await auth()` — reads cookie directly, no network
- Client Components: `useSession()` from `next-auth/react` — available via `SessionProvider` in `providers.tsx`

### Key design decisions

Each choice below was made by asking: *given an external source of truth we don't control, what's the safest behavior?*

#### 1. Server Components first, Client Components only for interactivity

**Decision:** Every page is an async Server Component that fetches data via the DAL and passes it as props to a `*Client` wrapper. No `useEffect(fetch...)` for initial loads.

**Why:** Fetching on the server keeps balances out of `localStorage`, eliminates a loading flicker, and gives auth a single chokepoint (`auth()` runs before any fetch). Client Components only own things that genuinely need the browser: form state, optimistic UI, SSE subscription.

**Considered and rejected:**
- *All-client SPA with TanStack Query* — would need a separate client cache layer, lose SSR, and complicate auth.
- *Server Components everywhere with Server Actions for every read* — actions are mutation-shaped; readers should be `cache()`-wrapped functions.

#### 2. Optimistic on the employee side, pessimistic on the manager side

**Decision:** `useTimeOffSubmit` deducts the balance instantly via `useOptimistic`. The manager view waits for the real response before updating UI.

**Why:** Asymmetric stakes. A wrong optimistic deduction on the employee side is recoverable — it auto-reverts on error and the user sees the corrected number. A wrong optimistic "approved" on the manager side could mean somebody books a flight against a denied request. Approve/deny stays pessimistic.

#### 3. Silent-failure defence as a first-class state

**Decision:** Treat `status: "silent_failure"` as a distinct response, not an error and not a success. Show a yellow warning, not a green banner, and rely on the next `router.refresh()` to reconcile.

**Why:** The brief explicitly calls out "assume a success response can still be wrong." A naive client treats HTTP 200 as truth. We carry a discriminated union (`accepted` | `silent_failure`) through the entire stack so the UI can render the third state honestly.

#### 4. Real-time push via SSE, not polling or WebSockets

**Decision:** `GET /route/pto/events` is an SSE stream. `useSSESync()` subscribes once per tab and calls `router.refresh()` on every `balance-update` frame.

**Why:** The bonus is server-initiated, one-way, infrequent, and tiny. SSE matches that exactly. Polling would burn requests for nothing 99% of the time; WebSockets would add complexity (handshake, heartbeats, framing) we don't need. `EventSource` reconnects automatically.

**Considered and rejected:**
- *15-second polling* — wasted requests, worse UX, no real benefit.
- *WebSockets via Socket.IO* — bidirectional channel we don't need.
- *Client-side timer that refetches on focus* — misses cross-tab updates entirely.

> **Note:** The in-process `EventEmitter` bus works for single-instance deployments. Multi-replica deployments would replace it with Redis pub/sub.

#### 5. Stale-data warning UI wired to the SSE event

**Decision:** When SSE fires, `useSSESync` flips `isStale = true` immediately and triggers `router.refresh()`. The UI shows a `StaleWarning` banner and a "Pending refresh" badge on each `BalanceCard` until the new server payload arrives, at which point `useEffect([initialBalances])` clears the stale flag.

**Why:** The brief asks for "graceful reconciliation." A silent re-render that just shows new numbers is *too* graceful — users distrust numbers that move without explanation. The amber stale state gives them a 200ms heads-up plus a manual refresh button.

#### 6. Caching strategy — server-side only

**Decision:**
- `React.cache()` wraps the 4 DAL read functions (`dalGetBalance`, `dalGetEmployeeBalances`, `dalGetEmployeeRequests`, `dalGetPendingRequests`) for per-request dedupe.
- `Cache-Control: private, no-store` on all mutable/per-user JSON routes.
- `Cache-Control: public, max-age=300, stale-while-revalidate=3600` on the reference-data route (`/route/pto/employees`).
- SSE route gets `no-cache, no-transform`.

**Why:** Balances are external-source-of-truth data — caching them across requests on either server or client risks shipping stale numbers that the user trusts. `React.cache()` is safe because it dies at the end of the request. Cross-request caching is only used where the data is genuinely static.

**Considered and rejected:**
- *TanStack Query / SWR on the client* — would re-introduce stale-data risk that SSE was built to prevent, and offers no value when RSC already delivers fresh server data.
- *React Context as a balance cache* — context is for sharing, not caching; couples unrelated subtrees to a single re-render.
- *`unstable_cache()` on balances* — wrong tool for data the external system can mutate without our knowledge.
- *`localStorage`* — security, cross-tab divergence, cross-device divergence; nothing to gain.

#### 7. Handler/route split with typed errors

**Decision:** Each endpoint has a thin route wrapper in [src/app/route/pto/](src/app/route/pto/) that parses HTTP input and calls a pure handler from [src/route/pto/](src/route/pto/). Handlers throw typed `ApiError` subclasses (`ValidationError`, `NotFoundError`, `ConflictError`, `InsufficientBalanceError`); the wrapper serializes them via `handleRoute()`.

**Why:** Pure handlers are unit-testable without spinning up a request mock. Typed errors give us correct HTTP status codes for free and prevent the "every error is 500" anti-pattern. The split also makes it trivial to swap the transport (REST → tRPC → gRPC) without rewriting business logic.

#### 8. NextAuth at three layers, defense in depth

**Decision:** Auth is enforced in `proxy.ts` (edge), each `page.tsx` (server), and each server action (mutation boundary). Roles (`employee` | `manager`) are baked into the JWT.

**Why:** Edge guard catches 99% of unauthorized requests before any code runs. Page guard provides typed `getSessionUser()` for the rest. Server-action guard ensures even a forged client call can't trigger an unauthorized mutation. Each layer assumes the others might be misconfigured.

---

## File Structure

```
src/
  app/
    actions.ts            # Server Actions (auth-gated mutations)
    providers.tsx         # SessionProvider — global client state root
    route/pto/            # Thin Next.js route handlers (HTTP in/out only)
      balance/            # GET  single balance
      balances/batch/     # GET  all balances
      employees/          # GET  employee list
      events/             # GET  SSE stream (balance-update push)
      requests/           # GET, POST  list / submit
      requests/[id]/      # GET, PATCH approve / deny
      anniversary-bonus/  # POST test harness: trigger bonus manually
    employee/page.tsx     # Server Component — anniversary check + data fetch
    manager/page.tsx      # Server Component — pending requests + live balances
    login/page.tsx        # Login page — redirects authenticated users by role
  route/pto/              # Pure handler functions (business logic, typed errors)
    errors.ts             # ApiError subclasses (ValidationError, NotFoundError, …)
    utils.ts              # handleRoute() — uniform error serialization
    balance.ts
    balances-batch.ts
    employees.ts
    requests.ts
    requests-id.ts
    anniversary-bonus.ts
    events.ts             # createEventsStream() — SSE stream factory
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
    unit/                 # pto-store pure logic + api-handlers (24 tests)
    components/           # BalanceCard, RequestCard, TimeOffForm
    integration/          # employee-view, manager-view, request-lifecycle, time-off-submission
    acceptance/           # Per-route AC: optimistic updates, rollback, silent failures, a11y
```

## Mock PTO Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/route/pto/balance` | GET | Real-time single-cell balance |
| `/route/pto/balances/batch` | GET | Full balance corpus |
| `/route/pto/requests` | GET, POST | List / submit requests |
| `/route/pto/requests/:id` | GET, PATCH | Fetch / approve / deny |
| `/route/pto/events` | GET | SSE stream — balance-update push |
| `/route/pto/anniversary-bonus` | POST | Test harness: trigger bonus manually |
| `/route/pto/employees` | GET | List employees |

**Forcing scenarios for tests:** Send `x-pto-scenario: silent_failure | conflict | insufficient | validation` as a request header on `POST /route/pto/requests` to deterministically hit a failure path. Without the header, silent failures fire on ~5% of requests randomly.

---

## Testing Strategy

The brief says future contributors must not be able to silently break this system. The test pyramid is shaped accordingly:

| Layer | Count | What it guards | When it runs |
|---|---|---|---|
| **Unit** — `pto-store` | 15 | Pure deduction / restore / anniversary logic. The math that protects the balance never lies. | Every commit (`npm test`) |
| **Unit** — API handlers | 24 | Each handler's happy path + all typed error paths (validation, not-found, conflict, insufficient, silent failure). Catches regressions in business rules without touching HTTP. | Every commit |
| **Component** | 29 | Each UI component's render states (loading, empty, optimistic, error, accessible). Backstops the Storybook visual contract. | Every commit |
| **Integration** | 26 | Real `EmployeeClient` / `ManagerClient` against a mocked Server Action layer. Verifies the optimistic-then-reconcile flow end-to-end. | Every commit |
| **Acceptance** | 23 | Per-route AC framed as Given/When/Then. Verifies the spec, not the implementation. Includes a11y violations check via `jest-axe`. | Every commit |
| **Storybook interaction** | — | Visual + interaction tests via `@storybook/addon-vitest`. | `npm run test:all` |

**117 unit-project tests pass on every commit.** Storybook tests run separately because Playwright is slower and shouldn't gate fast feedback.

**Deliberate omissions:** No end-to-end browser tests (Playwright). The single-process in-memory store means there's no orchestration to verify that a unit/integration test can't already cover. Adding Playwright later for cross-tab SSE behavior is straightforward.

