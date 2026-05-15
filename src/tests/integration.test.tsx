/**
 * Integration tests — render the real EmployeeView page with hooks wired up.
 *
 * We mock only the HCM API module (the network boundary) so that every layer
 * above it — useEmployeeBalances, useRequests, useSubmitTimeOff, and the page
 * itself — runs exactly as it does in production.
 *
 * Covered scenarios:
 *  1. Silent failure: HCM returns status:"silent_failure" → warning message shown,
 *     no success banner, balance eventually reconciled via the refresh() call.
 *  2. Rollback: HCM throws → balance snapshotted before submit is restored,
 *     error message displayed, Pending badge cleared.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, act } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import EmployeeView from '@/app/employee/page';
import ManagerView from '@/app/manager/page';

// ── Mock the network boundary ──────────────────────────────────────────────

vi.mock('@/lib/hcm-api', () => ({
  fetchBatchBalances: vi.fn(),
  fetchBalance: vi.fn(),
  fetchRequests: vi.fn(),
  submitTimeOffRequest: vi.fn(),
  approveRequest: vi.fn(),
  denyRequest: vi.fn(),
}));

import * as hcmApi from '@/lib/hcm-api';

// ── Seed data ──────────────────────────────────────────────────────────────

const seedBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: new Date().toISOString(),
};

const seedBatch = {
  balances: [seedBalance],
  generatedAt: new Date().toISOString(),
};

const pendingRequest = {
  id: 'req-manager-001',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  days: 3,
  reason: 'Vacation',
  status: 'pending_approval' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fill in the form with a valid 3-day US request and submit. */
async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByTestId('time-off-form')).toBeInTheDocument());
  await user.type(screen.getByLabelText('Start date'), '2026-08-01');
  await user.type(screen.getByLabelText('End date'), '2026-08-03'); // 3 days
  await user.click(screen.getByTestId('submit-button'));
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(hcmApi.fetchBatchBalances).mockResolvedValue(seedBatch);
  vi.mocked(hcmApi.fetchBalance).mockResolvedValue(seedBalance);
  vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hcmApi.approveRequest).mockResolvedValue({ success: true } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(hcmApi.denyRequest).mockResolvedValue({ success: true } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('EmployeeView integration: silent failure path', () => {
  it('shows HCM-unconfirmed warning when submit returns silent_failure', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
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
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-001',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // fetchBatchBalances is called once on mount, and again via refresh() in finally
    await waitFor(() => {
      expect(vi.mocked(hcmApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
    });
  });
});

describe('EmployeeView integration: rollback on HCM error', () => {
  it('displays the error message when HCM throws', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockRejectedValue(
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
    vi.mocked(hcmApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM refused')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // After error + rollback, the optimistic Pending badge must be gone
    await waitFor(() => {
      expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    });
  });

  it('calls refresh() after error to reconcile balance with HCM', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM refused')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // fetchBatchBalances: once on mount, once in the finally block
    await waitFor(() => {
      expect(vi.mocked(hcmApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
    });
  });
});

describe('EmployeeView integration: happy path', () => {
  it('shows success banner after accepted submission', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
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

// ── ManagerView integration ────────────────────────────────────────────────

describe('ManagerView integration: pending requests list', () => {
  it('shows a request card when there are pending requests', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [pendingRequest] });

    render(<ManagerView />);

    await waitFor(() => {
      expect(screen.getByTestId('request-card')).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no pending requests', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [] });

    render(<ManagerView />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-pending')).toBeInTheDocument();
    });
  });

  it('approve button calls approveRequest', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [pendingRequest] });
    const user = userEvent.setup();
    render(<ManagerView />);

    const approveBtn = await screen.findByTestId('approve-btn');
    await user.click(approveBtn);

    await waitFor(() => {
      expect(vi.mocked(hcmApi.approveRequest)).toHaveBeenCalledWith(pendingRequest.id);
    });
  });

  it('deny button calls denyRequest', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [pendingRequest] });
    const user = userEvent.setup();
    render(<ManagerView />);

    const denyBtn = await screen.findByTestId('deny-btn');
    await user.click(denyBtn);

    await waitFor(() => {
      expect(vi.mocked(hcmApi.denyRequest)).toHaveBeenCalledWith(pendingRequest.id);
    });
  });
});

// ── Page-level accessibility ───────────────────────────────────────────────

describe('EmployeeView a11y', () => {
  it('loaded page has no axe violations', async () => {
    const { container } = render(<EmployeeView />);
    await waitFor(() => screen.getByTestId('time-off-form'));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ManagerView a11y', () => {
  it('empty pending page has no axe violations', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [] });
    const { container } = render(<ManagerView />);
    await waitFor(() => screen.getByTestId('empty-pending'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('page with pending requests has no axe violations', async () => {
    vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [pendingRequest] });
    const { container } = render(<ManagerView />);
    await waitFor(() => screen.getByTestId('request-card'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
