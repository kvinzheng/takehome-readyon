/**
 * Integration tests — EmployeeView with all hooks wired up.
 *
 * We mock only the HCM API module (the network boundary) so that every layer
 * above it — useEmployeeBalances, useRequests, useSubmitTimeOff, and the page
 * itself — runs exactly as it does in production.
 *
 * Covered scenarios:
 *  1. Silent failure: HCM returns status:"silent_failure" → warning shown, no success banner.
 *  2. Rollback: HCM throws → balance restored, Pending badge cleared.
 *  3. Happy path: HCM accepts → success banner shown.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EmployeeView from '@/app/employee/page';

vi.mock('@/lib/pto-api', () => ({
  fetchBatchBalances: vi.fn(),
  fetchBalance: vi.fn(),
  fetchRequests: vi.fn(),
  submitTimeOffRequest: vi.fn(),
}));

import * as leaveApi from '@/lib/pto-api';

// ── Seed data ──────────────────────────────────────────────────────────────

const seedBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

const seedBatch = {
  balances: [seedBalance],
  generatedAt: '2026-01-01T00:00:00.000Z',
};

// ── Helpers ────────────────────────────────────────────────────────────────

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByTestId('time-off-form')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Start date'), '2026-08-01');
  await user.type(screen.getByLabelText('End date'), '2026-08-03'); // 3 days
  await user.click(screen.getByTestId('submit-button'));
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(leaveApi.fetchBatchBalances).mockResolvedValue(seedBatch);
  vi.mocked(leaveApi.fetchBalance).mockResolvedValue(seedBalance);
  vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EmployeeView integration: silent failure path', () => {
  it('shows HCM-unconfirmed warning when submit returns silent_failure', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-001',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'HCM has not confirmed'
      );
    });

    // No success banner on silent failure
    expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
  });

  it('still calls refresh() after silent failure to reconcile with HCM', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-001',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // fetchBatchBalances is called once on mount, and again via refresh() in finally
    await waitFor(() => {
      expect(vi.mocked(leaveApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
    });
  });
});

describe('EmployeeView integration: rollback on HCM error', () => {
  it('displays the error message when HCM throws', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM refused the request')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'HCM refused the request'
      );
    });
  });

  it('clears the Pending badge after rollback', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM refused')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });
  });

  it('calls refresh() after error to reconcile balance with HCM', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM refused')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // fetchBatchBalances: once on mount, once in the finally block
    await waitFor(() => {
      expect(vi.mocked(leaveApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
    });
  });
});

describe('EmployeeView integration: happy path', () => {
  it('shows success banner after accepted submission', async () => {
    vi.mocked(leaveApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-002',
      status: 'accepted',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByTestId('success-banner')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('EmployeeView a11y', () => {
  it('loaded page has no axe violations', async () => {
    const { container } = render(<EmployeeView />);
    await waitFor(() => screen.getByTestId('time-off-form'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
