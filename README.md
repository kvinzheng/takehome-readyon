# ReadyOn Time-Off

A time-off request app built to solve the data-integrity problems that appear when **your UI doesn't own the source of truth**. Balances live in an external PTO system (Workday-class); ReadyOn is the front-end that has to stay fast *and* honest about whose data it's showing.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · NextAuth v5 · Tailwind v4 · Zustand · Vitest · Playwright · Storybook 10

See [PRD.md](PRD.md) for product requirements and [TRD.md](TRD.md) for the deeper technical rationale.

### Contents

- [Demo credentials](#demo-credentials)
- [Running locally](#running-locally)
- [Testing](#testing)
- [How to manually verify the real-time SSE behaviour (the cool bit)](#how-to-manually-verify-the-real-time-sse-behaviour-the-cool-bit)
- [How the SSE / anniversary flow works (high-level, with code)](#how-the-sse--anniversary-flow-works-high-level-with-code)
- [Architecture overview](#architecture-overview)
- [**Performance**](#performance) — bundle sizes, LCP/FCP/TTFB, applied optimisations
- [File map](#file-map)
- [Test pyramid](#test-pyramid)

---

## Demo credentials

| Role | Email | Password |
|---|---|---|
| Employee | `alice@readyon.com` | `alice123` |
| Manager  | `carol@readyon.com` | `carol123` |

The login form has one-click **"Sign in as Employee / Manager"** buttons that auto-fill these.

## Running locally

```bash
echo 'AUTH_SECRET=dev-secret-change-in-prod' > .env.local
npm install
npm run dev          # http://localhost:3000
npm run storybook    # http://localhost:6006  (optional)
```

## Testing

```bash
npm test                   # 74 vitest tests: unit + component + integration + acceptance
npm run test:all           # Above + Storybook interaction tests
npm run test:e2e           # 3 Playwright specs (role access, approval flow, anniversary SSE)
node scripts/measure-lcp.mjs   # Capture LCP/FCP/TTFB against a running prod build
```

---

## How to manually verify the real-time SSE behaviour (the cool bit)

The most interesting thing about this app is that **changes propagate across browser tabs in real time** — submit a request in one window, watch the manager's queue update in another, all without polling or page refreshes. To see this you need two independent sessions (one regular window + one incognito):

![Two-window setup: regular Chrome on the left as Carol (manager), incognito on the right as Alice (employee). Submitting a request on the right adds a card on the left instantly.](https://github.com/user-attachments/assets/1a55a65a-82d6-4167-b1b1-02d4acf37e31)



> ⚠️ **Use two different browser sessions, not two tabs.** NextAuth stores the session cookie per browser profile — if you open Alice and Carol in two regular tabs they'll clobber each other's session. Use one regular window + one incognito window (⌘⇧N on macOS / Ctrl⇧N on Windows) so each side has its own cookie jar.

1. **Start the app**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

2. **Window A — regular Chrome window — Alice (employee)**
   - Go to `/login` → click **"Sign in as Employee (Alice)"**.
   - You land on `/employee`. Note her US/UK balances and the empty "My Requests" list.

3. **Window B — incognito window (⌘⇧N on macOS / Ctrl⇧N on Windows)**
   - Go to http://localhost:3000/login → click **"Sign in as Manager (Carol)"**.
   - You land on `/manager` with the pending approvals queue and the anniversary panel.

4. **Test #1 — manager grants anniversary bonus → employee sees +5 days live**
   In Window B click **"Grant +5 days"** on Alice's row.
   → Switch to Window A *without refreshing*. Within ~1 second:
   - The amber **"Balances may be out of date"** banner appears briefly.
   - The US balance bumps up by 5.
   - The banner disappears once the new server data lands.

5. **Test #2 — employee submits → manager queue updates live**
   In Window A fill the form (location US, 1 day, today + 7 days, "Test") and submit.
   → Switch to Window B *without refreshing*. The new request card appears in the pending queue with Alice's live balance.

6. **Test #3 — manager approves → employee's request flips Pending → Approved**
   In Window B click **Approve** on the new card.
   → Switch to Window A. The matching request in "My Requests" flips its status badge from **Pending** to **Approved** automatically.

7. **Test #4 — manager denies → employee gets balance back**
   Submit another request in Window A, then deny it from Window B.
   → Window A: the request flips to **Denied** and the US balance restores (the days come back).

8. **Test #5 — optimistic UI on submit**
   In Window A submit a request and watch the form button: it disables immediately and the new card appears in "My Requests" *before* the server round-trip finishes (powered by `useOptimistic`). If the server later rejects, the optimistic row is rolled back and an inline error banner is shown.

9. **Test #6 — over-balance guard**
   In Window A pick a date range longer than the US balance (e.g. 9 days when 6 are available). The form shows a red **"N days selected — exceeds available balance"** hint and the submit button stays disabled. The check is client-side for instant feedback *and* re-validated server-side in `submitTimeOff()` — so it can't be bypassed via DevTools.

10. **Test #7 — role-based access**
    In Window A (Alice / employee) try to visit http://localhost:3000/manager — you should be redirected to `/employee`. The same redirect happens in reverse if Carol visits `/employee`. Auth checks live in the page Server Components (`src/app/manager/page.tsx`, `src/app/employee/page.tsx`) and are also covered by `src/tests/e2e/role-based-access.spec.ts`.

11. **Test #8 — SSE reconnect (resilience)**
    With both windows open and signed in, kill the dev server (`Ctrl-C` in the terminal) then restart it (`npm run dev`). Within ~3 seconds the browser's `EventSource` reconnects automatically — submit a request in Window A and confirm Window B still updates live without a manual reload. The reconnection logic is built into `EventSource` itself; we just don't fight it.

If any of those steps require a manual refresh, the SSE pipeline is broken — open DevTools → **Network** → filter "events" and confirm `GET /route/pto/events` is open with `type: eventsource` and a never-ending response. In the **Console** you should also see one `[sse] pto-update …` log per cross-window action.

---

## How the SSE / anniversary flow works (high-level, with code)

You don't need to read the whole codebase to understand the pipeline. Here are the five pieces, in order of data flow:

### 1. The bus — `src/lib/sse-bus.ts`

A single in-process `EventEmitter`. Server code emits; the SSE route handler subscribes.

```ts
// src/lib/sse-bus.ts
const sseBus = new EventEmitter();
sseBus.setMaxListeners(200); // one listener per open browser tab

export type PtoUpdateReason = "submit" | "approve" | "deny" | "anniversary";
export interface PtoUpdatePayload {
  employeeId: string;
  locationId?: string;
  bonus?: number;
  reason: PtoUpdateReason;
}

export function emitPtoUpdate(payload: PtoUpdatePayload): void {
  sseBus.emit("pto-update", payload);
}

export function onPtoUpdate(listener: (p: PtoUpdatePayload) => void) {
  sseBus.on("pto-update", listener);
  return () => sseBus.off("pto-update", listener);
}
```

> Single-process only. Multi-replica would swap this for Redis pub/sub — the rest of the pipeline stays the same.

### 2. The trigger — auto-grant on employee dashboard load — `src/lib/pto-dal.ts`

When an employee opens `/employee`, the page Server Component calls `maybeGrantAnniversaryOnLogin(user.id)` *before* it reads balances. If today is the anniversary, the store grants a bonus, the cache tag is bumped, and the bus fires.

```ts
// src/lib/pto-dal.ts
export async function maybeGrantAnniversaryOnLogin(employeeId: string) {
  if (!isWorkAnniversary(employeeId)) return;

  for (const loc of LOCATIONS) {
    const result = storeGrantAnniversaryBonus(employeeId, loc.id);
    if (result.granted) {
      emitPtoUpdate({
        employeeId,
        locationId: loc.id,
        bonus: result.bonus ?? 0,
        reason: "anniversary",
      });
    }
  }
  revalidateTag(ptoTags.balances(employeeId), "max");
}
```

### 3. The trigger — manual grant from the manager — `src/app/actions.ts`

Same emit, but driven from a Server Action wired to the "Grant +5 days" button.

```ts
// src/app/actions.ts
"use server";

export async function grantAnniversaryBonus(employeeId: string) {
  const session = await auth();
  const user = getSessionUser(session!);
  if (user.role !== "manager") throw new Error("Unauthorized");

  const result = await dalGrantAnniversaryBonus(employeeId);

  if (result.granted && result.locationId) {
    updateTag(ptoTags.balances(employeeId));     // invalidate cached read
    emitPtoUpdate({                              // push to all open tabs
      employeeId,
      locationId: result.locationId,
      bonus: result.bonus ?? 0,
      reason: "anniversary",
    });
  }
  return { granted: result.granted };
}
```

The same pattern (mutate → `updateTag` → `emitPtoUpdate`) is used by `submitTimeOff`, `approveTimeOff`, and `denyTimeOff` — that's why **every** state change shows up live everywhere, not just anniversaries.

### 4. The wire — SSE route — `src/app/route/pto/events/route.ts` + `src/route/pto/events.ts`

The route is a plain `text/event-stream` response. The factory subscribes to the bus and writes one frame per emit:

```ts
// src/route/pto/events.ts
export function createEventsStream(signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const enqueue = (s: string) => controller.enqueue(encoder.encode(s));
      enqueue("event: connected\ndata: {}\n\n");

      const unsub = onPtoUpdate((payload) => {
        const data = JSON.stringify(payload);
        enqueue(`event: pto-update\ndata: ${data}\n\n`);
        enqueue(`event: balance-update\ndata: ${data}\n\n`); // legacy alias
      });

      const ping = setInterval(() => enqueue(": ping\n\n"), 20_000);
      signal.addEventListener("abort", () => { clearInterval(ping); unsub(); controller.close(); });
    },
  });
}
```

### 5. The receiver — `src/hooks/use-sse-sync.ts`

Both `EmployeeClient` and `ManagerClient` call `useSSESync()`. It opens one `EventSource`, flips an `isStale` flag, and calls `router.refresh()` to re-run the Server Component with fresh data.

```ts
// src/hooks/use-sse-sync.ts
export function useSSESync() {
  const router = useRouter();
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/route/pto/events");
    const onUpdate = () => { setIsStale(true); router.refresh(); };
    es.addEventListener("pto-update", onUpdate);
    es.addEventListener("balance-update", onUpdate);
    return () => es.close();
  }, [router]);

  return { isStale, clearStale: () => setIsStale(false), refresh: () => router.refresh() };
}
```

### Putting it together

```
Manager clicks "Grant +5 days"          Employee tab (already open)
        │                                        ▲
        ▼                                        │
[Server Action]                                  │ router.refresh()
grantAnniversaryBonus()                          │
   ├─ dalGrantAnniversaryBonus()                 │
   ├─ updateTag("balances:emp-1")                │
   └─ emitPtoUpdate({…})                         │
            │                                    │
            ▼                                    │
     [sse-bus EventEmitter]                      │
            │                                    │
            ▼                                    │
GET /route/pto/events  ──► writes "event: pto-update\ndata: …\n\n" ─► EventSource onmessage
```

---

## Architecture overview

### Rendering model

Pages are async **Server Components** that fetch data via the DAL and pass it as props to a `*Client` component owning all interactivity. No client-side fetching for initial loads.

```
/login     → LoginForm (Client)
/employee  → EmployeePage (Server) → EmployeeClient (Client)
/manager   → ManagerPage  (Server) → ManagerClient  (Client)
/route/pto/events → SSE stream (the only API route — everything else is a Server Action)
```

### Layers

| Layer | File(s) | Responsibility |
|---|---|---|
| Edge proxy | [proxy.ts](proxy.ts) | Auth + role guard before any code runs |
| Server Components | [src/app/*/page.tsx](src/app) | Auth check, parallel DAL reads, render `*Client` |
| Server Actions | [src/app/actions.ts](src/app/actions.ts) | Auth-gated mutations: submit / approve / deny / grant / login / logout |
| DAL | [src/lib/pto-dal.ts](src/lib/pto-dal.ts) | `unstable_cache`-wrapped reads, write helpers, anniversary helpers |
| Store | [src/lib/pto-store.ts](src/lib/pto-store.ts) | In-process singleton; balance deduction, request state, year-keyed anniversary guard |
| SSE bus | [src/lib/sse-bus.ts](src/lib/sse-bus.ts) | `EventEmitter` connecting actions to open tabs |
| SSE route | [src/app/route/pto/events/route.ts](src/app/route/pto/events/route.ts) | Single `text/event-stream` endpoint |
| Client hooks | [src/hooks/](src/hooks) | `useSSESync`, `useTimeOffSubmit`, `useManagerAction`, `useAnniversaryGrant` |
| Client UI | [src/components/](src/components) | Pure components; render props, emit callbacks |

### Caching strategy

Reads in the DAL are wrapped with `unstable_cache(fn, keyParts, { tags })`. Tag taxonomy:

| Tag | Invalidated by |
|---|---|
| `balances:<employeeId>` | submit, deny, grant |
| `requests:<employeeId>` | submit, approve, deny |
| `requests:pending` | submit, approve, deny |

Server Actions call `updateTag(tag)` so the next render sees fresh data. `dalGetAnniversaryEligibility` is **not** cached — it's date-sensitive and recomputes per render.

> **Why not React Query / SWR?** The Server Component delivers fresh data on every navigation and `router.refresh()`. A client cache would only re-introduce the staleness this design is built to avoid.

### Auth (three layers, defense in depth)

1. **Edge proxy** ([proxy.ts](proxy.ts)) — blocks unauthenticated → `/login`; non-managers can't reach `/manager`.
2. **Page** — `await auth()` + role check before any DAL call.
3. **Server Action** — re-validates `session.user.role` before any mutation.

JWT cookie is HttpOnly. The `role` claim is set at sign-in and read on every layer.

---

## Performance

Measured against a production build on macOS, Apple Silicon, localhost, with no network throttling. Same machine running `next start` and a Playwright Chromium driver. **Localhost numbers are best-case** — they remove network as a variable so we can see pure rendering cost.

### Bundle size (after `npm run build`)

| Metric | Size |
|---|---|
| Total static JS (uncompressed) | **702 KB** |
| Total static JS (gzipped) | **206 KB** |
| Largest single chunk (framework + React) | 222 KB raw / ~70 KB gzipped |
| `.next/static` total (JS + CSS + assets) | 852 KB |

Numbers come from `find .next/static -name '*.js'` piped through `gzip -c | wc -c`. Re-run with `npm run build` after changes.

### Core Web Vitals (5-run average against `/login` on a prod build)

| Metric | Value | Target |
|---|---|---|
| TTFB | **18 ms** | ≤ 200 ms |
| FCP  | **40 ms** | ≤ 1.8 s |
| LCP  | **40 ms** (p75 ≈ 50 ms) | ≤ 2.5 s |

Capture them yourself:

```bash
npm run build
AUTH_TRUST_HOST=true PORT=3100 npx next start -p 3100 &
node scripts/measure-lcp.mjs
```

The script uses Playwright + `PerformanceObserver` to record TTFB, FCP, and LCP across N runs (default 5) and prints a JSON summary.

### Optimisations applied

| Change | Effect |
|---|---|
| **Server Components for all reads** | Zero client fetches on first paint; HTML ships with data already embedded |
| **`unstable_cache` + tag invalidation** | DAL reads dedupe within a request and across requests until invalidated; eliminates N+1 store reads |
| **`Promise.all` parallel DAL reads** in `/employee` and `/manager` page handlers | Balances + requests + per-row balances fetch concurrently |
| **`next/link` for in-app nav** ([src/app/layout.tsx](src/app/layout.tsx)) | Client-side transitions + automatic route prefetching; no full document reload between Approvals and My time off |
| **`experimental.optimizePackageImports: ["date-fns"]`** ([next.config.ts](next.config.ts)) | Tree-shakes the `date-fns` barrel; only `format` ships |
| **SSE instead of polling** | Zero idle traffic; updates push within ~100 ms |
| **JWT session (no DB round-trip on `auth()`)** | Auth check is a cookie-parse; sub-millisecond |

### Why these numbers are honest

- Built with Turbopack production mode (`next build`), not `next dev`.
- Measured via the browser's own `PerformanceObserver` (not synthetic), in real Chromium.
- 5 cold-load runs, averaged — not a one-shot best case.
- The biggest caveat: localhost has ~0 ms network. Add ~50–150 ms TTFB for any realistic deployment; LCP would still comfortably clear "Good" (≤ 2.5 s).

---

## File map

```
src/
  app/
    layout.tsx                  # Root layout + nav (uses next/link)
    providers.tsx               # SessionProvider + UserProvider
    actions.ts                  # Server Actions — every mutation lives here
    employee/page.tsx           # Server Component: auto-grant + parallel DAL reads
    manager/page.tsx            # Server Component: pending queue + eligibility
    login/page.tsx              # Login form host
    route/pto/events/route.ts   # SSE endpoint (only HTTP route — everything else is a Server Action)
    api/auth/[...nextauth]/     # NextAuth handler
  route/pto/events.ts           # SSE stream factory (pure, unit-testable)
  lib/
    pto-store.ts                # In-process source of truth
    pto-dal.ts                  # Cached reads + write helpers + anniversary
    sse-bus.ts                  # EventEmitter pub/sub
  hooks/
    use-sse-sync.ts             # EventSource → router.refresh()
    use-time-off-submit.ts      # Optimistic submit + silent-failure handling
    use-manager-action.ts       # Pessimistic approve / deny
    use-anniversary-grant.ts    # Manual grant trigger
    use-auth.ts
  components/
    employee/                   # BalanceCard, TimeOffForm, EmployeeClient
    manager/                    # ManagerClient (queue + anniversary panel)
    shared/                     # RequestCard, StatusBanners, LoginForm
  tests/
    unit/                       # Pure logic (pto-store)
    components/                 # Render states + a11y (jest-axe)
    integration/                # *Client wired against mocked actions + a11y
    acceptance/                 # Given/When/Then per requirement + a11y
    e2e/                        # Playwright: role access, approval, anniversary SSE
scripts/
  measure-lcp.mjs               # Playwright + PerformanceObserver perf harness
```

---

## Test pyramid

| Layer | Files | What it guards |
|---|---|---|
| Unit | `tests/unit/pto-store.test.ts` | Deduction / restore / anniversary idempotency |
| Component | `tests/components/*.test.tsx` | Each component's render states + WCAG via `jest-axe` |
| Integration | `tests/integration/*.test.tsx` | `EmployeeClient` / `ManagerClient` against mocked actions; optimistic + reconcile flow + a11y |
| Acceptance | `tests/acceptance/*.test.tsx` | Brief framed as G/W/T per role |
| E2E | `tests/e2e/*.spec.ts` | Cross-tab SSE, edge auth, full approval flow (Playwright) |

**74 vitest tests + 3 Playwright specs, all green.** Accessibility is asserted at every layer.

---

*Built with Next.js 16 App Router. The unusual choices (Server Components for all reads, in-process SSE bus, pessimistic approvals, silent-failure as a first-class state) are documented in [TRD.md](TRD.md) §"Key design decisions". The product motivation is in [PRD.md](PRD.md).*
