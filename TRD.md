# Technical Requirements Document  
## ReadyOn Time-Off Frontend

**Date:** 2026-05-14  
**Stack:** Next.js 15 (App Router) · TypeScript · TanStack Query v5 · Zustand · Tailwind CSS · Storybook 10 · Vitest  

---

## 1. Problem Statement

ReadyOn's Time-Off module must present HCM-owned balance data that is both **fast** (instant feedback) and **correct** (never misleads the employee or the approving manager). The core tensions are:

| Tension | Impact |
|---|---|
| HCM is the authoritative source, not ReadyOn | We cannot "own" the number; we can only cache it |
| Balances change outside ReadyOn (anniversaries, year-start) | Cached views go stale while users have tabs open |
| HCM returns occasional silent failures | A 200 OK does not guarantee commitment |
| Managers need fresh data at approval time | Stale balances at approval risk over-approving |

---

## 2. Architecture

### 2.1 Component Tree

```
RootLayout (Providers: QueryClientProvider)
├── Nav (Employee | Manager links)
├── /employee   → EmployeeView
│   ├── BalanceCard[]          ← reads from batch cache
│   ├── TimeOffForm            ← triggers optimistic mutation
│   └── RequestCard[]          ← employee's request history
└── /manager    → ManagerView
    └── RequestWithBalance[]   ← each card fetches a real-time balance
        └── RequestCard        ← approve / deny buttons
```

**Key mapping of concerns to layers:**

| Layer | Concern |
|---|---|
| TanStack Query | Server state, caching, background refetch, optimistic update rollback |
| Route handlers (`/api/hcm/*`) | Mock HCM — all mutable state lives here |
| `hcm-store.ts` | In-process state for mock HCM (replaces a real Workday API) |
| React components | Pure UI; receive data as props, emit events via callbacks |
| `use-balances`, `use-requests`, `use-mutations` | Query/mutation hooks — the only place data-fetching logic lives |

### 2.2 Data Flow: Employee Balance View

```
Page mount
  → useBatchBalances()            # batch fetch: initial hydration
  → cache["balances","batch"]     # stored with staleTime=30s
  → BalanceCard renders

Window focus / 60 s ticker
  → refetchInterval / refetchOnWindowFocus
  → batch re-fetched, cache updated
  → BalanceCard re-renders with new data (reconciliation)
```

### 2.3 Data Flow: Submit Time-Off Request

```
User submits form
  → useSubmitTimeOff().mutate()

onMutate (synchronous)
  → cancelQueries(balances)
  → snapshot previousBatch, previousSingle
  → setQueryData: optimistically deduct days from cache
  → BalanceCard shows "Pending" badge with reduced count

HCM responds
  case success
    → onSettled: invalidate balance queries
    → background refetch confirms or corrects the number
  case HCM error (4xx / 5xx)
    → onError: restore snapshots (rollback)
    → BalanceCard reverts to pre-submit number
    → ErrorBanner shown
  case silent failure (200 but no commit)
    → result.status === "silent_failure"
    → UI shows warning; onSettled invalidation forces refetch
    → real balance re-appears after refetch
```

---

## 3. Key Design Decisions

### 3.1 Optimistic vs. Pessimistic Updates

**Decision: Optimistic** for time-off submission; **Pessimistic** for manager approve/deny.

**Rationale:**  
- Employees expect instant feedback. A spinner until HCM responds is acceptable for a manager (low-frequency action) but frustrating for employees.  
- Managers approve with legal/pay implications; showing stale data during that action is worse than a brief wait. We fetch a real-time balance cell for each pending request in the manager view via `useBalance()`.  
- The optimistic path includes a rollback contract: `onMutate` snapshots, `onError` restores, `onSettled` always reconciles. This makes the optimistic layer safe.

**Alternatives considered:**

| Option | Rejected because |
|---|---|
| Pessimistic everywhere | Slow employee UX; spinner on form submit |
| Optimistic for manager too | Risk showing wrong balance at approval decision moment |
| Local state only (no refetch) | Would not catch mid-session HCM mutations |

### 3.2 Cache Invalidation Strategy

Two-tier approach:

1. **`staleTime: 30s`** — balance data is considered fresh for 30 seconds. Renders within that window use the cache with no network call.
2. **`refetchInterval: 60s` + `refetchOnWindowFocus: true`** — the batch endpoint is re-fetched in background every 60 s and on every window focus event. This is the mechanism that catches anniversary bonuses and year-start refreshes.
3. **Post-mutation `invalidateQueries`** — after any submit/approve/deny settles, the relevant balance cells are invalidated immediately, forcing a real-time read.

**Why batch for hydration, single-cell for manager view?**  
Batch is cheaper per-row at scale but one HTTP call returns everything. Real-time single-cell reads are used where data freshness matters most (manager decision point) without batching delays.

### 3.3 Silent Failure Defence

HCM may return HTTP 200 with `status: "silent_failure"`. The frontend:
1. Detects `result.status === "silent_failure"` in the mutation's `onSuccess` handler.
2. Does **not** mark the request as confirmed.
3. Shows a specific warning to the employee.
4. The `onSettled` invalidation forces a balance refetch, which will show the uncommitted (pre-deduction) balance.

This design means the UI can never show a "approved" state that HCM didn't actually commit.

### 3.4 Background Refresh During In-Flight Action

**Problem:** User is mid-form when HCM fires an anniversary bonus. The 60 s ticker triggers a batch refetch. If that refetch resolves while an optimistic update is pending, we could get a stale overwrite.

**Solution:** `onMutate` calls `cancelQueries({ queryKey: balanceKeys.all })` before setting the optimistic cache entry. This cancels any in-flight refetch. The `onSettled` invalidation then triggers a fresh refetch after the mutation resolves, ensuring the final displayed value is authoritative.

### 3.5 Manager View: Real-Time Balance at Decision Time

Each pending request in the manager view is wrapped in a `RequestWithBalance` component that calls `useBalance(employeeId, locationId)`. This is a separate real-time read (not the batch cache) triggered when the manager opens the approval list. The `asOf` timestamp is shown alongside the balance so the manager can see exactly how fresh the data is.

---

## 4. Mock HCM Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/hcm/balance` | GET | Real-time single-cell read |
| `/api/hcm/balances/batch` | GET | Full corpus for all employees |
| `/api/hcm/requests` | GET, POST | List/submit requests |
| `/api/hcm/requests/:id` | GET, PATCH | Fetch / approve / deny |
| `/api/hcm/anniversary-bonus` | POST | Trigger a +5 day bonus (test harness) |
| `/api/hcm/employees` | GET | List employees |

**Simulated failure modes** (controlled by `X-HCM-Scenario` header or random):

| Scenario | Probability | Behaviour |
|---|---|---|
| `silent_failure` | 5% or forced | Returns 200 but does not deduct balance |
| `conflict` | Forced only | Returns 409 |
| `insufficient` | Balance-driven | Returns 422 with message |

---

## 5. Testing Strategy

### 5.1 Test Pyramid

```
                ┌───────────────────────────────┐
                │   Storybook Interaction Tests  │  ← guards UI states
                │   (Vitest Browser + Playwright)│
                ├───────────────────────────────┤
                │   Component Unit Tests         │  ← guards prop contracts
                │   (Vitest + jsdom + RTL)       │
                ├───────────────────────────────┤
                │   HCM Store Logic Tests        │  ← guards data integrity
                │   (Vitest, pure TypeScript)    │
                └───────────────────────────────┘
```

**Why this split:**

| Layer | What it guards |
|---|---|
| HCM store tests | Pure logic: deduction, rollback, anniversary, limits. No React, fast. |
| Component unit tests | Each component's prop contract, edge cases, accessibility labels |
| Storybook interaction tests | Visual states + user event flows (form submission, approve/deny). Living documentation. |

**What we deliberately do NOT have:**  
Full end-to-end browser tests that spin up Next.js. The Storybook interaction tests run in a real Chromium context and exercise the component tree against mocked data, which gives us 95% of the E2E confidence with much faster CI cycle times.

### 5.2 States Covered by Storybook

`BalanceCard`: Default, LowBalance, Empty, **OptimisticPending**, **Syncing**, **Stale**, **BalanceRefreshedMidSession**  
`TimeOffForm`: Idle, **Submitting**, **HcmRejected**, **HcmConflict**, **ValidationError**, **HappyPath** (interaction)  
`RequestCard`: PendingWithBalance, PendingEmployeeView, Approved, Denied, **OptimisticRolledBack**, **HcmRejected**, **ActionInProgress**  
`StatusBanners`: ErrorBanner, StaleWarning, SuccessBanner, LoadingSkeleton  

### 5.3 Regression Contract

Future contributors break the contract if:
- A component no longer renders `data-testid` attributes used in tests
- The `onMutate` snapshot/restore logic is removed from `useSubmitTimeOff`
- The `refetchOnWindowFocus` option is disabled globally
- The `cancelQueries` call is removed from `onMutate` (silent race condition)
- The `silent_failure` detection branch is removed from the mutation success handler

Each of these is covered by at least one test.

---

## 6. Running Locally

```bash
npm run dev        # Next.js dev server on :3000
npm run storybook  # Storybook on :6006
npm run test       # Vitest (unit + storybook interaction)
```

All mock HCM endpoints are served by Next.js API routes — no separate process needed.
