/**
 * Integration tests — EmployeeClient edge cases.
 *
 * These tests cover scenarios not addressed by the acceptance tests:
 *   - Multiple balance locations
 *   - Pre-existing request history
 *   - Zero-balance state
 *
 * Mock boundary: @/app/actions (Server Action layer).
 * Renders EmployeeClient directly — avoids importing the Server Component page
 * which pulls in next-auth → next/server ESM resolution issues in Vitest.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmployeeClient } from '@/components/employee/EmployeeClient';
import type { Balance, TimeOffRequest } from '@/types';

vi.mock('@/app/actions', () => ({
  submitTimeOff: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ── Seed data ──────────────────────────────────────────────────────────────

const usBalance: Balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

const ukBalance: Balance = {
  employeeId: 'emp-1',
  locationId: 'loc-uk',
  available: 3,
  used: 2,
  total: 5,
  asOf: '2026-01-01T00:00:00.000Z',
};

const approvedRequest: TimeOffRequest = {
  id: 'r-approved',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  days: 3,
  reason: 'Holiday',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

// ── Multiple locations ─────────────────────────────────────────────────────

describe('EmployeeClient: multiple locations', () => {
  it('renders a BalanceCard for each location', async () => {
    render(
      <EmployeeClient
        initialBalances={[usBalance, ukBalance]}
        initialRequests={[]}
      />
    );
    const cards = await screen.findAllByTestId('balance-card');
    expect(cards).toHaveLength(2);
  });

  it('location select lists an option for each balance', async () => {
    render(
      <EmployeeClient
        initialBalances={[usBalance, ukBalance]}
        initialRequests={[]}
      />
    );
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(2);
  });
});

// ── Request history ────────────────────────────────────────────────────────

describe('EmployeeClient: request history', () => {
  it('renders pre-existing request cards', () => {
    render(
      <EmployeeClient
        initialBalances={[usBalance]}
        initialRequests={[approvedRequest]}
      />
    );
    expect(screen.getByTestId('request-card')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-requests')).not.toBeInTheDocument();
  });

  it('shows the empty-requests placeholder when there are no requests', () => {
    render(
      <EmployeeClient
        initialBalances={[usBalance]}
        initialRequests={[]}
      />
    );
    expect(screen.getByTestId('empty-requests')).toBeInTheDocument();
  });
});

// ── Zero-balance edge case ─────────────────────────────────────────────────

describe('EmployeeClient: zero-balance edge case', () => {
  it('renders a BalanceCard even when available days is zero', () => {
    const zeroBalance: Balance = { ...usBalance, available: 0 };
    render(
      <EmployeeClient
        initialBalances={[zeroBalance]}
        initialRequests={[]}
      />
    );
    expect(screen.getByTestId('balance-card')).toBeInTheDocument();
  });
});
