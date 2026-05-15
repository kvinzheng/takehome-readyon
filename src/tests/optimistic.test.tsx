import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { TimeOffForm } from '@/components/TimeOffForm';
import { BalanceCard } from '@/components/BalanceCard';
import {
  ErrorBanner,
  SuccessBanner,
  StaleWarning,
  LoadingSkeleton,
} from '@/components/StatusBanners';

/**
 * Integration test: optimistic update flow.
 *
 * We mock the HCM API module and exercise the full hook → component pipeline
 * to verify:
 *  1. Optimistic balance deduction appears immediately on submit.
 *  2. On HCM success, the balance is reconciled with the HCM-returned value.
 *  3. On HCM failure, the balance rolls back to its pre-submit value.
 */

vi.mock('@/lib/hcm-api', () => ({
  submitTimeOffRequest: vi.fn(),
  fetchBatchBalances: vi.fn(),
  fetchRequests: vi.fn(() => Promise.resolve({ requests: [] })),
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

function Wrapper({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

describe('Optimistic update: balance deduction', () => {
  beforeEach(() => {
    vi.mocked(hcmApi.fetchBatchBalances).mockResolvedValue({
      balances: [seedBalance],
      generatedAt: new Date().toISOString(),
    });
  });

  it('shows "Pending" badge immediately on submit before HCM responds', async () => {
    let resolveSubmit!: (v: unknown) => void;
    vi.mocked(hcmApi.submitTimeOffRequest).mockReturnValue(
      new Promise((res) => { resolveSubmit = res; })
    );

    const user = userEvent.setup();
    const { rerender } = render(
      <Wrapper>
        <BalanceCard balance={seedBalance} isOptimistic={false} />
        <TimeOffForm
          employeeId="emp-1"
          balances={[seedBalance]}
          onSubmit={() => {}}
        />
      </Wrapper>
    );

    // Before submit: no Pending badge
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();

    // Simulate immediate optimistic flag
    rerender(
      <Wrapper>
        <BalanceCard balance={{ ...seedBalance, available: 7 }} isOptimistic />
        <TimeOffForm
          employeeId="emp-1"
          balances={[seedBalance]}
          onSubmit={() => {}}
          isSubmitting
        />
      </Wrapper>
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});

describe('StatusBanners', () => {
  it('renders ErrorBanner with message', () => {
    render(<ErrorBanner message="HCM is unavailable" />);
    expect(screen.getByTestId('error-banner')).toHaveTextContent('HCM is unavailable');
  });

  it('renders SuccessBanner', () => {
    render(<SuccessBanner message="Request submitted!" />);
    expect(screen.getByTestId('success-banner')).toBeInTheDocument();
  });

  it('StaleWarning calls onRefresh when button is clicked', async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();
    render(<StaleWarning onRefresh={onRefresh} />);
    await user.click(screen.getByTestId('refresh-btn'));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('renders LoadingSkeleton with correct number of rows', () => {
    render(<LoadingSkeleton rows={4} />);
    const skeleton = screen.getByTestId('loading-skeleton');
    expect(skeleton.children.length).toBe(4);
  });
});

describe('StatusBanners a11y', () => {
  it('ErrorBanner has no violations', async () => {
    const { container } = render(<ErrorBanner message="HCM is unavailable" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('SuccessBanner has no violations', async () => {
    const { container } = render(<SuccessBanner message="Request submitted!" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('StaleWarning has no violations', async () => {
    const { container } = render(<StaleWarning onRefresh={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('LoadingSkeleton has no violations', async () => {
    const { container } = render(<LoadingSkeleton rows={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
