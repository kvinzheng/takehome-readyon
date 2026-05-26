import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBalance,
  getAllBalances,
  deductBalance,
  restoreBalance,
  grantAnniversaryBonus,
  createRequest,
  updateRequestStatus,
  getPendingRequests,
  resetStore,
} from '@/lib/pto-store';

beforeEach(() => {
  resetStore();
});

describe('pto-store: balance reads', () => {
  it('returns seeded balance for emp-1 / loc-us', () => {
    const b = getBalance('emp-1', 'loc-us');
    expect(b).toBeDefined();
    expect(b!.available).toBe(10);
    expect(b!.used).toBe(5);
    expect(b!.total).toBe(15);
  });

  it('returns undefined for unknown combination', () => {
    expect(getBalance('emp-1', 'loc-apac')).toBeUndefined();
  });

  it('returns all seeded balances', () => {
    expect(getAllBalances().length).toBeGreaterThanOrEqual(6);
  });
});

describe('pto-store: deductBalance', () => {
  it('successfully deducts when balance is sufficient', () => {
    const result = deductBalance('emp-1', 'loc-us', 3);
    expect(result.success).toBe(true);
    expect(result.balance!.available).toBe(7);
    expect(result.balance!.used).toBe(8);
  });

  it('fails with error when balance is insufficient', () => {
    const result = deductBalance('emp-1', 'loc-us', 100);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/insufficient/i);
  });

  it('fails for unknown employee/location', () => {
    const result = deductBalance('emp-1', 'loc-apac', 1);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('persists the deduction in the store', () => {
    deductBalance('emp-1', 'loc-us', 4);
    expect(getBalance('emp-1', 'loc-us')!.available).toBe(6);
  });
});

describe('pto-store: restoreBalance', () => {
  it('restores balance after a deny', () => {
    deductBalance('emp-1', 'loc-us', 3);
    restoreBalance('emp-1', 'loc-us', 3);
    expect(getBalance('emp-1', 'loc-us')!.available).toBe(10);
  });
});

describe('pto-store: anniversary bonus', () => {
  it('grants +5 days once', () => {
    const { granted, balance } = grantAnniversaryBonus('emp-1', 'loc-us');
    expect(granted).toBe(true);
    expect(balance!.available).toBe(15); // 10 + 5
  });

  it('does not grant twice in the same session', () => {
    grantAnniversaryBonus('emp-1', 'loc-us');
    const second = grantAnniversaryBonus('emp-1', 'loc-us');
    expect(second.granted).toBe(false);
  });

  it('grants can be reset with resetStore', () => {
    grantAnniversaryBonus('emp-1', 'loc-us');
    resetStore();
    const { granted } = grantAnniversaryBonus('emp-1', 'loc-us');
    expect(granted).toBe(true);
  });
});

describe('pto-store: request lifecycle', () => {
  it('creates a pending request', () => {
    const req = createRequest({
      employeeId: 'emp-1',
      locationId: 'loc-us',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      days: 3,
      reason: 'Test',
    });
    expect(req.status).toBe('pending_approval');
    expect(req.id).toMatch(/^req-/);
  });

  it('lists pending requests', () => {
    createRequest({
      employeeId: 'emp-1',
      locationId: 'loc-us',
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      days: 3,
      reason: '',
    });
    expect(getPendingRequests().length).toBe(1);
  });

  it('updates request status to approved', () => {
    const req = createRequest({
      employeeId: 'emp-1',
      locationId: 'loc-us',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      days: 1,
      reason: '',
    });
    const updated = updateRequestStatus(req.id, 'approved');
    expect(updated!.status).toBe('approved');
    expect(getPendingRequests().length).toBe(0);
  });

  it('updates request status to denied with HCM error', () => {
    const req = createRequest({
      employeeId: 'emp-1',
      locationId: 'loc-us',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      days: 1,
      reason: '',
    });
    const updated = updateRequestStatus(req.id, 'denied', 'Balance exhausted');
    expect(updated!.ptoError).toBe('Balance exhausted');
  });
});
