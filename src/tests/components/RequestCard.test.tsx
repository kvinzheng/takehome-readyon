import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { RequestCard } from '@/components/RequestCard';
import type { TimeOffRequest } from '@/types';

const base: TimeOffRequest = {
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

const balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

describe('RequestCard', () => {
  it('renders date range and days', () => {
    render(<RequestCard request={base} />);
    // date-fns formats in local timezone; just verify the year and day count
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.getByText(/3 days/)).toBeInTheDocument();
  });

  it('shows balance context when provided', () => {
    render(<RequestCard request={base} balance={balance} />);
    expect(screen.getByText(/Current balance/)).toBeInTheDocument();
    expect(screen.getByText(/10 \/ 15 days/)).toBeInTheDocument();
  });

  it('shows approve and deny buttons when handlers provided and status is pending', () => {
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(
      <RequestCard
        request={base}
        balance={balance}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    );
    expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
    expect(screen.getByTestId('deny-btn')).toBeInTheDocument();
  });

  it('calls onApprove with request id', async () => {
    const onApprove = vi.fn();
    const user = userEvent.setup();
    render(
      <RequestCard request={base} balance={balance} onApprove={onApprove} />
    );
    await user.click(screen.getByTestId('approve-btn'));
    expect(onApprove).toHaveBeenCalledWith('req-001');
  });

  it('calls onDeny with request id', async () => {
    const onDeny = vi.fn();
    const user = userEvent.setup();
    render(
      <RequestCard request={base} balance={balance} onDeny={onDeny} />
    );
    await user.click(screen.getByTestId('deny-btn'));
    expect(onDeny).toHaveBeenCalledWith('req-001');
  });

  it('does not show action buttons for approved requests', () => {
    const onApprove = vi.fn();
    render(
      <RequestCard
        request={{ ...base, status: 'approved' }}
        onApprove={onApprove}
      />
    );
    expect(screen.queryByTestId('approve-btn')).not.toBeInTheDocument();
  });

  it('shows PTO error when present', () => {
    render(
      <RequestCard
        request={{ ...base, ptoError: 'Silent failure detected' }}
      />
    );
    expect(screen.getByTestId('pto-error')).toBeInTheDocument();
  });

  it('disables buttons when isActing', () => {
    render(
      <RequestCard
        request={base}
        balance={balance}
        onApprove={vi.fn()}
        onDeny={vi.fn()}
        isActing
      />
    );
    expect(screen.getByTestId('approve-btn')).toBeDisabled();
    expect(screen.getByTestId('deny-btn')).toBeDisabled();
  });
});

describe('RequestCard a11y', () => {
  it('employee view (no actions) has no violations', async () => {
    const { container } = render(<RequestCard request={base} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('manager view with approve/deny actions has no violations', async () => {
    const { container } = render(
      <RequestCard
        request={base}
        balance={balance}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('approved request has no violations', async () => {
    const { container } = render(
      <RequestCard request={{ ...base, status: 'approved' }} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('request with hcmError has no violations', async () => {
    const { container } = render(
      <RequestCard request={{ ...base, ptoError: 'Silent failure detected' }} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
