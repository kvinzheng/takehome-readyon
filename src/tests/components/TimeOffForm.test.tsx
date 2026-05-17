import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { TimeOffForm } from '@/components/employee/TimeOffForm';

const balances = [
  {
    employeeId: 'emp-1',
    locationId: 'loc-us',
    available: 10,
    used: 5,
    total: 15,
    asOf: '2026-01-01T00:00:00.000Z',
  },
  {
    employeeId: 'emp-1',
    locationId: 'loc-eu',
    available: 2,
    used: 3,
    total: 5,
    asOf: '2026-01-01T00:00:00.000Z',
  },
];

describe('TimeOffForm', () => {
  const onSubmit = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    onSubmit.mockReset();
  });

  it('renders location options from balances', () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
      />
    );
    expect(screen.getByText(/US/i)).toBeInTheDocument();
    expect(screen.getByText(/EU/i)).toBeInTheDocument();
  });

  it('shows validation error when submitted without dates', async () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
      />
    );
    await user.click(screen.getByTestId('submit-button'));
    expect(screen.getByTestId('form-error')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows insufficient balance error when days exceed available', async () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
      />
    );
    // Select EU location (only 2 days available)
    await user.selectOptions(screen.getByLabelText('Location'), 'loc-eu');
    await user.type(screen.getByLabelText('Start date'), '2026-08-01');
    await user.type(screen.getByLabelText('End date'), '2026-08-05'); // 5 days

    // The submit button is disabled when balance is insufficient — the UI
    // shows an inline status message instead of a form-error alert.
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('exceeds available balance');
      expect(screen.getByTestId('submit-button')).toBeDisabled();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct payload for valid request', async () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
      />
    );
    await user.selectOptions(screen.getByLabelText('Location'), 'loc-us');
    await user.type(screen.getByLabelText('Start date'), '2026-08-01');
    await user.type(screen.getByLabelText('End date'), '2026-08-03');
    await user.type(screen.getByLabelText(/reason/i), 'Vacation');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          locationId: 'loc-us',
          days: 3,
          reason: 'Vacation',
        })
      );
    });
  });

  it('disables submit button while submitting', () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
        isSubmitting
      />
    );
    expect(screen.getByTestId('submit-button')).toBeDisabled();
  });

  it('renders external error from HCM', () => {
    render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={onSubmit}
        error="HCM rejected: insufficient balance"
      />
    );
    expect(screen.getByTestId('form-error')).toHaveTextContent('HCM rejected');
  });
});

describe('TimeOffForm a11y', () => {
  it('idle state has no violations', async () => {
    const { container } = render(
      <TimeOffForm employeeId="emp-1" balances={balances} onSubmit={() => {}} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('error state has no violations', async () => {
    const { container } = render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={() => {}}
        error="HCM is unavailable"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('submitting (disabled) state has no violations', async () => {
    const { container } = render(
      <TimeOffForm
        employeeId="emp-1"
        balances={balances}
        onSubmit={() => {}}
        isSubmitting
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
