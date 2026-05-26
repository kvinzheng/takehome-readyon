/**
 * Integration tests — ManagerClient approve / deny scenarios.
 *
 * Mock boundary: @/app/actions (Server Action layer).
 * Renders ManagerClient directly — avoids importing the Server Component page
 * which pulls in next-auth → next/server ESM resolution issues in Vitest.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ManagerClient } from '@/components/manager/ManagerClient';
import type { Balance, TimeOffRequest } from '@/types';

vi.mock('@/app/actions', () => ({
  approveTimeOff: vi.fn(),
  denyTimeOff: vi.fn(),
}));

import { approveTimeOff, denyTimeOff } from '@/app/actions';

afterEach(() => {
  vi.clearAllMocks();
});

// ── Seed data ──────────────────────────────────────────────────────────────

const balance: Balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

const pendingRequest: TimeOffRequest = {
  id: 'req-001',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  days: 3,
  reason: 'Vacation',
  status: 'pending_approval',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── Empty state ────────────────────────────────────────────────────────────

describe('ManagerClient: empty state', () => {
  it('shows the empty-pending placeholder when there are no requests', () => {
    render(<ManagerClient requestsWithBalances={[]} anniversaryEligibility={[]} />);
    expect(screen.getByTestId('empty-pending')).toBeInTheDocument();
  });
});

// ── Request list ───────────────────────────────────────────────────────────

describe('ManagerClient: request list', () => {
  it('renders a request card for each pending request', () => {
    render(
      <ManagerClient anniversaryEligibility={[]}
        requestsWithBalances={[{ request: pendingRequest, balance }]}
      />
    );
    expect(screen.getByTestId('request-card')).toBeInTheDocument();
  });

  it('approve button calls approveTimeOff with the request id', async () => {
    vi.mocked(approveTimeOff).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ManagerClient anniversaryEligibility={[]}
        requestsWithBalances={[{ request: pendingRequest, balance }]}
      />
    );
    await user.click(screen.getByTestId('approve-btn'));
    await waitFor(() =>
      expect(approveTimeOff).toHaveBeenCalledWith('req-001')
    );
  });

  it('deny button calls denyTimeOff with the request id', async () => {
    vi.mocked(denyTimeOff).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <ManagerClient anniversaryEligibility={[]}
        requestsWithBalances={[{ request: pendingRequest, balance }]}
      />
    );
    await user.click(screen.getByTestId('deny-btn'));
    await waitFor(() =>
      expect(denyTimeOff).toHaveBeenCalledWith('req-001')
    );
  });

  it('surfaces an action-error banner when approveTimeOff rejects', async () => {
    vi.mocked(approveTimeOff).mockRejectedValue(new Error('HCM unreachable'));
    const user = userEvent.setup();
    render(
      <ManagerClient anniversaryEligibility={[]}
        requestsWithBalances={[{ request: pendingRequest, balance }]}
      />
    );
    await user.click(screen.getByTestId('approve-btn'));
    await waitFor(() => {
      const alert = screen.getByTestId('action-error');
      expect(alert).toHaveTextContent('HCM unreachable');
    });
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('ManagerClient: accessibility', () => {
  it('empty state has no WCAG violations', async () => {
    const { container } = render(<ManagerClient requestsWithBalances={[]} anniversaryEligibility={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('request list has no WCAG violations', async () => {
    const { container } = render(
      <ManagerClient anniversaryEligibility={[]}
        requestsWithBalances={[{ request: pendingRequest, balance }]}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
