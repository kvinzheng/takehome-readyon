/**
 * Acceptance tests — /employee route
 *
 * Written from the user's perspective (Given / When / Then in the test names).
 * Renders EmployeeClient with mocked server actions and realistic seed data.
 *
 * Suites:
 *  AC-1: Optimistic Updates
 *  AC-2: Silent Failures
 *  AC-3: Successful Submission
 *  Accessibility — WCAG + keyboard focus
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { EmployeeClient } from '@/components/EmployeeClient';
import type { Balance, TimeOffRequest } from '@/types';

vi.mock('@/app/actions', () => ({
  submitTimeOff: vi.fn(),
}));

import { submitTimeOff } from '@/app/actions';

// ── Seed data ──────────────────────────────────────────────────────────────

const seedBalance: Balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

const defaultProps = {
  employeeId: 'emp-1',
  initialBalances: [seedBalance],
  initialRequests: [] as TimeOffRequest[],
};

afterEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() =>
    expect(screen.getByTestId('time-off-form')).toBeInTheDocument()
  );
  await user.type(screen.getByLabelText('Start date'), '2026-08-01');
  await user.type(screen.getByLabelText('End date'), '2026-08-03'); // 3 days
  await user.click(screen.getByTestId('submit-button'));
}

// ── AC-1: Optimistic Updates ───────────────────────────────────────────────

describe('AC-1: Optimistic Updates — /employee', () => {
  it('Given a pending submission, When form is submitted, Then a Pending badge appears immediately', async () => {
    vi.mocked(submitTimeOff).mockReturnValue(new Promise(() => {})); // never resolves

    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByText('Pending')).toBeInTheDocument()
    );
  });

  it('Given an in-flight optimistic deduction, When submission fails, Then the Pending badge is cleared', async () => {
    vi.mocked(submitTimeOff).mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.queryByText('Pending')).not.toBeInTheDocument()
    );
  });
});

// ── AC-2: Silent Failures ─────────────────────────────────────────────────

describe('AC-2: Silent Failures — /employee', () => {
  it('Given PTO system returns silent_failure, When submitted, Then a warning is shown — not a success banner', async () => {
    vi.mocked(submitTimeOff).mockResolvedValue({
      requestId: 'r-1',
      status: 'silent_failure',
    });

    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toHaveTextContent('PTO system has not confirmed')
    );
    expect(screen.queryByTestId('success-banner')).not.toBeInTheDocument();
  });
});

// ── AC-3: Successful Submission ───────────────────────────────────────────

describe('AC-3: Successful Submission — /employee', () => {
  it('Given PTO system accepts, When submitted, Then a success banner appears and no error is shown', async () => {
    vi.mocked(submitTimeOff).mockResolvedValue({
      requestId: 'r-2',
      status: 'accepted',
    });

    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);

    await waitFor(() =>
      expect(screen.getByTestId('success-banner')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('form-error')).not.toBeInTheDocument();
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('Accessibility — /employee', () => {
  it('idle state has no WCAG violations', async () => {
    const { container } = render(<EmployeeClient {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('time-off-form')).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('error state has no WCAG violations', async () => {
    vi.mocked(submitTimeOff).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    const { container } = render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('success state has no WCAG violations', async () => {
    vi.mocked(submitTimeOff).mockResolvedValue({ requestId: 'r-3', status: 'accepted' });
    const user = userEvent.setup();
    const { container } = render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(screen.getByTestId('success-banner')).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('All form controls are reachable by keyboard in document order', async () => {
    render(<EmployeeClient {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('time-off-form')).toBeInTheDocument()
    );

    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByLabelText('Location')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Start date')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('End date')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/reason/i)).toHaveFocus();
    await user.tab();
    expect(screen.getByTestId('submit-button')).toHaveFocus();
  });

  it('Error notification has role="alert" so screen readers announce it immediately', async () => {
    vi.mocked(submitTimeOff).mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(screen.getByTestId('form-error')).toBeInTheDocument()
    );
    expect(screen.getByTestId('form-error')).toHaveAttribute('role', 'alert');
  });

  it('Success notification has role="status" so screen readers announce it politely', async () => {
    vi.mocked(submitTimeOff).mockResolvedValue({ requestId: 'r-4', status: 'accepted' });
    const user = userEvent.setup();
    render(<EmployeeClient {...defaultProps} />);
    await fillAndSubmit(user);
    await waitFor(() =>
      expect(screen.getByTestId('success-banner')).toBeInTheDocument()
    );
    expect(screen.getByTestId('success-banner')).toHaveAttribute('role', 'status');
  });
});
