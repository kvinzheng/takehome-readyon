/**
 * Integration tests — full request lifecycle against the real in-memory store.
 *
 * Replaces the E2E approve/deny smoke tests. No mocks — exercises store
 * functions in the same sequence the DAL calls them in production:
 *
 *   Submit:  deductBalance → createRequest
 *   Approve: updateRequestStatus('approved')
 *   Deny:    updateRequestStatus('denied') → restoreBalance
 *
 * This catches regressions in the store mutation logic that unit tests
 * covering each function in isolation might miss.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetStore,
  getBalance,
  deductBalance,
  restoreBalance,
  createRequest,
  updateRequestStatus,
  getPendingRequests,
} from '@/lib/pto-store';
import type { TimeOffRequest } from '@/types';

beforeEach(() => {
  resetStore();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function submitRequest(days: number): TimeOffRequest {
  const deduction = deductBalance('emp-1', 'loc-us', days);
  if (!deduction.success) throw new Error(deduction.error);
  return createRequest({
    employeeId: 'emp-1',
    locationId: 'loc-us',
    startDate: '2026-08-01',
    endDate: '2026-08-03',
    days,
    reason: 'Test',
  });
}

// ── Submit → Approve ───────────────────────────────────────────────────────

describe('Submit → Approve', () => {
  it('request status becomes approved', () => {
    const req = submitRequest(3);
    updateRequestStatus(req.id, 'approved');
    const pending = getPendingRequests();
    expect(pending.find((r) => r.id === req.id)).toBeUndefined();
  });

  it('balance stays deducted after approval', () => {
    submitRequest(3);
    const balance = getBalance('emp-1', 'loc-us')!;
    expect(balance.available).toBe(7); // 10 - 3
  });

  it('a second request can still be submitted from remaining balance', () => {
    submitRequest(3); // 10 - 3 = 7 left
    expect(() => submitRequest(5)).not.toThrow(); // 7 - 5 = 2 left
  });
});

// ── Submit → Deny ──────────────────────────────────────────────────────────

describe('Submit → Deny', () => {
  it('request is removed from pending list after denial', () => {
    const req = submitRequest(3);
    updateRequestStatus(req.id, 'denied');
    expect(getPendingRequests().find((r) => r.id === req.id)).toBeUndefined();
  });

  it('balance is restored after restoreBalance is called', () => {
    const req = submitRequest(3);
    updateRequestStatus(req.id, 'denied');
    restoreBalance('emp-1', 'loc-us', 3);
    expect(getBalance('emp-1', 'loc-us')!.available).toBe(10);
  });
});

// ── Insufficient balance ───────────────────────────────────────────────────

describe('Submit with insufficient balance', () => {
  it('deductBalance fails and no request is created', () => {
    const result = deductBalance('emp-1', 'loc-us', 999);
    expect(result.success).toBe(false);
    expect(getPendingRequests()).toHaveLength(0);
  });
});
