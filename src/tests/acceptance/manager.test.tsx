/**
 * Acceptance tests — /manager route
 *
 * Written from the user's perspective (Given / When / Then in the test names).
 * Renders ManagerClient with mocked server actions and realistic seed data.
 *
 * Suites:
 *  AC-1: Pending Requests List
 *  AC-2: Approve Action
 *  AC-3: Deny Action
 *  Accessibility — WCAG + keyboard focus
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { ManagerClient } from '@/components/ManagerClient';
import type { Balance, TimeOffRequest } from '@/types';

vi.mock('@/app/actions', () => ({
  approveTimeOff: vi.fn(),
  denyTimeOff: vi.fn(),
}));

import { approveTimeOff, denyTimeOff } from '@/app/actions';

// ── Seed data ──────────────────────────────────────────────────────────────

const seedRequest: TimeOffRequest = {
  id: 'req-001',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  days: 3,
  reason: 'Vacation',
  status: 'pending_approval',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

const seedBalance: Balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

const defaultProps = {
  requestsWithBalances: [{ request: seedRequest, balance: seedBalance }],
};

beforeEach(() => {
  vi.mocked(approveTimeOff).mockResolvedValue(undefined);
  vi.mocked(denyTimeOff).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── AC-1: Pending Requests List ────────────────────────────────────────────

describe('AC-1: Pending Requests List — /manager', () => {
  it('Given pending requests exist, When the manager views the page, Then a request card is shown for each', () => {
    render(<ManagerClient {...defaultProps} />);
    expect(screen.getByTestId('request-card')).toBeInTheDocument();
  });

  it('Given no pending requests, When the manager views the page, Then an empty state is shown', () => {
    render(<ManagerClient requestsWithBalances={[]} />);
    expect(screen.getByTestId('empty-pending')).toBeInTheDocument();
    expect(screen.queryByTestId('request-card')).not.toBeInTheDocument();
  });
});

// ── AC-2: Approve Action ───────────────────────────────────────────────────

describe('AC-2: Approve Action — /manager', () => {
  it('Given a pending request, When Approve is clicked, Then approveTimeOff is called with the correct id', async () => {
    const user = userEvent.setup();
    render(<ManagerClient {...defaultProps} />);
    await user.click(screen.getByTestId('approve-btn'));

    await waitFor(() =>
      expect(vi.mocked(approveTimeOff)).toHaveBeenCalledWith('req-001')
    );
  });
});

// ── AC-3: Deny Action ─────────────────────────────────────────────────────

describe('AC-3: Deny Action — /manager', () => {
  it('Given a pending request, When Deny is clicked, Then denyTimeOff is called with the correct id', async () => {
    const user = userEvent.setup();
    render(<ManagerClient {...defaultProps} />);
    await user.click(screen.getByTestId('deny-btn'));

    await waitFor(() =>
      expect(vi.mocked(denyTimeOff)).toHaveBeenCalledWith('req-001')
    );
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('Accessibility — /manager', () => {
  it('pending-requests state has no WCAG violations', async () => {
    const { container } = render(<ManagerClient {...defaultProps} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('empty state has no WCAG violations', async () => {
    const { container } = render(<ManagerClient requestsWithBalances={[]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Approve and Deny buttons are reachable by keyboard in document order', async () => {
    render(<ManagerClient {...defaultProps} />);
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByTestId('approve-btn')).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('deny-btn')).toHaveFocus();
  });
});
