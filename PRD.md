# Product Requirements Document
## ReadyOn Time-Off

**Status:** Implemented (May 2026)
**Owner:** ReadyOn HR Apps
**Related:** [TRD.md](TRD.md) · [README.md](README.md)

---

## 1. Summary

A self-service time-off app for ReadyOn employees and their managers. Balances are owned by an external PTO system (Workday-class); ReadyOn is a UI that must stay **fast** *and* **honest** about whose data it's showing.

## 2. Goals

| # | Goal | Success criterion |
|---|---|---|
| G1 | Employees can see balances and submit requests with no perceived latency | Optimistic deduction visible in < 100 ms of submit click |
| G2 | Managers approve/deny against the *current* balance, never a cached snapshot | Approval screen reads balance live, not from cache |
| G3 | Background changes (anniversary bonus) appear in open tabs without manual refresh | New value visible in other tabs within 1 s of grant |
| G4 | The system never silently lies about state | "Silent failure" responses surface a distinct warning, not a success or an error |
| G5 | Role-based access is enforced at three layers (edge, page, action) | Forging the role claim fails every layer |

## 3. Non-Goals

- Real Workday integration (mock store with simulated latency stands in)
- Calendar UI, team coverage view, accrual policies — out of scope
- Mobile-native app
- Multi-region replica deployment (in-process pub/sub is fine for single instance)

## 4. Users & Roles

| Role | Capabilities |
|------|--------------|
| **Employee** | View own balances; submit a request; see own request history |
| **Manager**  | All employee abilities (on self) + view pending approvals queue + approve/deny + grant anniversary bonuses |

## 5. User Stories

### Employee
- *As an employee, when I submit a 3-day request, I want the balance to drop immediately so I know my action registered.*
- *As an employee, when the PTO system silently fails to commit, I want a warning instead of false confidence.*
- *As an employee, when my work anniversary triggers a bonus in another tab, I want my open dashboard to update without a manual refresh.*

### Manager
- *As a manager, when I open the approvals queue, I want each row to show the employee's **current** balance — not a stale read.*
- *As a manager, when I approve a request, I want the queue to remove it and the employee's tab to flip Pending → Approved automatically.*
- *As a manager, on an employee's hire-date anniversary, I want a one-click "Grant +5 days" button that's idempotent per year.*

## 6. Functional Requirements

### F1 — Authentication
- NextAuth v5 JWT strategy with a `role` claim.
- Demo accounts: `alice@readyon.com / alice123` (employee), `carol@readyon.com / carol123` (manager).
- Login form auto-fills the demo creds via two "Sign in as…" buttons.

### F2 — Employee Dashboard (`/employee`)
- Lists every balance (one card per location).
- Submit form: location, days, dates, reason.
- Optimistic deduction on submit; rollback on `error`; amber "silent failure" banner on `silent_failure`.
- Request history below the form.
- Managers may also visit `/employee` (their personal view).

### F3 — Manager Dashboard (`/manager`)
- Pending approvals queue; each card shows a *live* balance at the moment of render.
- Approve / Deny actions are **pessimistic** (no optimistic update — stakes too high).
- Anniversary panel listing every employee whose hire-date matches today; "Grant +5 days" button per row, disabled after grant succeeds.

### F4 — Anniversary Bonus
- Auto-grants on employee dashboard load when `today.MM-DD === hireDate.MM-DD`.
- Idempotent per `(employeeId, locationId, year)` — no double-grant.
- Manager can also grant from the approvals page (admin override / off-day catch-up).
- Bonus = +5 days to **every** balance the employee owns.

### F5 — Real-time Propagation (SSE)
- Single SSE endpoint: `GET /route/pto/events`.
- One event taxonomy: `pto-update` (with legacy alias `balance-update`).
- Emitted from every mutating Server Action: submit, approve, deny, anniversary grant.
- Both `EmployeeClient` and `ManagerClient` subscribe via `useSSESync()`; on any frame they flip an `isStale` flag and call `router.refresh()`.
- Stale banner stays visible until fresh server props land.

### F6 — Silent-failure Handling
- `submitTimeOff` action returns a discriminated union `{ status: "accepted" | "silent_failure" | "error", ... }`.
- ~5% of submissions randomly trigger `silent_failure`; UI shows a yellow banner and a Refresh button.
- Tests force the path deterministically through the action's internal seed.

### F7 — Access Control
- `proxy.ts` (edge middleware): blocks unauthenticated → `/login`; blocks non-managers from `/manager`.
- Each page: secondary `auth()` guard + role check.
- Each Server Action: re-validates `session.user.role` before any mutation.

## 7. Non-Functional Requirements

| # | Requirement | Measured |
|---|---|---|
| N1 | LCP ≤ 200 ms on local production build | **~40 ms avg** (5-run sample, localhost) |
| N2 | First-load JS ≤ 250 KB gzipped | **~206 KB gzipped** total static JS |
| N3 | Time-to-interactive feels instant after submit | Optimistic UI fires before network round-trip |
| N4 | SSE update latency in same process | < 100 ms in-process, observed |
| N5 | WCAG 2.1 AA — zero violations across all UI states | Verified via `jest-axe` (unit/integration) + `@axe-core/playwright` (e2e) |
| N6 | No data leaks across users | Per-request cache, no `localStorage`, JWT cookie HttpOnly |
| N7 | Tests gate every commit | 74 vitest tests + 3 Playwright specs, all green |

## 8. Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Submit with `days > available` | Server Action returns `error`, UI rolls back optimistic deduction, shows `InsufficientBalanceError` message |
| PTO system silent-fails on submit | UI shows amber banner with "Refresh to verify" link; no balance change |
| Anniversary day for an employee with `alreadyGrantedThisYear === true` | Grant is a no-op (returns existing state); button disabled in manager UI |
| Manager visits `/employee` | Sees own balances (read-only behavior — submit form still works for their own PTO) |
| Employee tries to GET `/manager` | Edge middleware redirects to `/login` |
| SSE connection drops | Browser's `EventSource` reconnects automatically; no manual retry logic |
| Two tabs submit the same request simultaneously | Server Action de-dupes via store-level lock; second submit returns the existing request |

## 9. Out of Scope

- Multi-region pub/sub (would replace in-process `EventEmitter` with Redis pub/sub)
- Real Workday/HCM integration
- Accrual rules, carry-over policies, blackout dates
- Team-coverage / calendar overlays
- Email notifications on approval/denial

## 10. Open Questions

- Should the anniversary bonus be configurable per location (US +5, UK +3)? — *Currently flat +5.*
- Should approvals also be optimistic with a "Pending sync" badge? — *Decision: no, stakes too high.*
- Push notifications for managers on new requests? — *Out of scope for v1.*

## 11. Acceptance Tests

Each requirement above maps to at least one test in `src/tests/`. See [README.md → Testing](README.md#testing) for the full pyramid. Highlights:

- `acceptance/employee.test.tsx` — covers F2, F4 (auto-grant), F6
- `acceptance/manager.test.tsx` — covers F3, F4 (manual grant), F7
- `acceptance/login.test.tsx` — covers F1, F7
- `integration/request-lifecycle.test.ts` — full submit → approve flow against the real store
- `e2e/anniversary-bonus.spec.ts` — cross-tab SSE propagation (G3)
- `e2e/role-based-access.spec.ts` — F7 at the edge
- `e2e/time-off-approval.spec.ts` — F3 + F5

---

*This PRD describes what was built and why. For the engineering shape, see [TRD.md](TRD.md). For run/test instructions, see [README.md](README.md).*
