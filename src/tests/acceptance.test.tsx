/**
 * Acceptance tests — verify the four core product challenges from README.md.
 *
 * Written from the user's perspective (Given / When / Then in the test names).
 * Each describe maps to one acceptance criterion. These tests intentionally
 * read like a product spec, not an implementation spec.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeView from '@/app/employee/page';

vi.mock('@/lib/hcm-api', () => ({
  fetchBatchBalances: vi.fn(),
  fetchRequests: vi.fn(),
  submitTimeOffRequest: vi.fn(),
}));

import * as hcmApi from '@/lib/hcm-api';

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

beforeEach(() => {
  vi.mocked(hcmApi.fetchBatchBalances).mockResolvedValue(seedBatch);
  vi.mocked(hcmApi.fetchRequests).mockResolvedValue({ requests: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function waitForForm() {
  await waitFor(() =>
    expect(screen.getByTestId('time-off-form')).toBeInTheDocument()
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await waitForForm();
  await user.type(screen.getByLabelText('Start date'), '2026-08-01');
  await user.type(screen.getByLabelText('End date'), '2026-08-03'); // 3 days
  await user.click(screen.getByTestId('submit-button'));
}

// ── AC-1: Optimistic Updates ───────────────────────────────────────────────

describe('AC-1: Optimistic Updates', () => {
  it('Given a pending HCM call, When form is submitted, Then a Pending badge appears immediately', async () => {
    // Never-resolving — simulates real HCM latency
    vi.mocked(hcmApi.submitTimeOffRequest).mockReturnValue(new Promise(() => {}));

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText('Pending')).toBeInTheDocument()
    );
  });

  it('Given an optimistic deduction, When HCM rejects, Then the Pending badge is cleared', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockRejectedValue(
      new Error('HCM rejected')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    );
  });
});

// ── AC-2: Stale Data Reconciliation ───────────────────────────────────────

describe('AC-2: Stale Data Reconciliation', () => {
  it('Given the page is open, When the window regains focus, Then balances are re-fetched', async () => {
    render(<EmployeeView />);
    await waitForForm();

    const callsBefore = vi.mocked(hcmApi.fetchBatchBalances).mock.calls.length;

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(vi.mocked(hcmApi.fetchBatchBalances).mock.calls.length).toBeGreaterThan(
        callsBefore
      )
    );
  });

  it('Given updated data from HCM, When balances are re-fetched, Then the new values are shown', async () => {
    render(<EmployeeView />);
    await waitForForm();

    const updatedBatch = {
      balances: [{ ...seedBalance, available: 15 }],
      generatedAt: new Date().toISOString(),
    };
    vi.mocked(hcmApi.fetchBatchBalances).mockResolvedValue(updatedBatch);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    await waitFor(() =>
      expect(screen.getByText(/15/)).toBeInTheDocument()
    );
  });
});

// ── AC-3: Silent Failures ─────────────────────────────────────────────────

describe('AC-3: Silent Failures', () => {
  it('Given HCM returns silent_failure, When submitted, Then a warning is shown — not a success banner', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-001',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toHaveTextContent(
        'HCM has not confirmed'
      )
    );
    expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
  });

  it('Given a silent failure, When the page reconciles, Then a fresh fetch is triggered', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-001',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // Initial fetch + reconciliation fetch in finally block
    await waitFor(() =>
      expect(vi.mocked(hcmApi.fetchBatchBalances)).toHaveBeenCalledTimes(2)
    );
  });
});

// ── AC-4: Cache Invalidation ──────────────────────────────────────────────

describe('AC-4: Cache Invalidation', () => {
  it('Given any submission, When it settles, Then both balances and requests are re-fetched', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockResolvedValue({
      requestId: 'req-002',
      status: 'accepted',
    });

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(vi.mocked(hcmApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(hcmApi.fetchRequests)).toHaveBeenCalledTimes(2);
    });
  });

  it('Given a failed submission, When HCM throws, Then both caches are still refreshed', async () => {
    vi.mocked(hcmApi.submitTimeOffRequest).mockRejectedValue(
      new Error('Network error')
    );

    const user = userEvent.setup();
    render(<EmployeeView />);
    await fillAndSubmit(user);

    // finally block always runs — both must be re-fetched even on error
    await waitFor(() => {
      expect(vi.mocked(hcmApi.fetchBatchBalances)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(hcmApi.fetchRequests)).toHaveBeenCalledTimes(2);
    });
  });
});
