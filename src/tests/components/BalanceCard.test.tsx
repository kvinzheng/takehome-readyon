import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { BalanceCard } from '@/components/BalanceCard';

const balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: '2026-01-01T00:00:00.000Z',
};

describe('BalanceCard', () => {
  it('renders available and total days', () => {
    render(<BalanceCard balance={balance} />);
    const card = screen.getByTestId('balance-card');
    expect(card).toHaveTextContent('10');
    expect(card).toHaveTextContent('15 days');
  });

  it('shows "Pending" badge when isOptimistic', () => {
    render(<BalanceCard balance={balance} isOptimistic />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows "Syncing…" badge when isSyncing', () => {
    render(<BalanceCard balance={balance} isSyncing />);
    expect(screen.getByText('Syncing…')).toBeInTheDocument();
  });

  it('shows "Stale" badge when isStale and not syncing', () => {
    render(<BalanceCard balance={balance} isStale />);
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('does not show "Stale" badge when isSyncing', () => {
    render(<BalanceCard balance={balance} isStale isSyncing />);
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
  });

});

describe('BalanceCard a11y', () => {
  it('default state has no violations', async () => {
    const { container } = render(<BalanceCard balance={balance} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('optimistic (Pending) state has no violations', async () => {
    const { container } = render(<BalanceCard balance={balance} isOptimistic />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('stale state has no violations', async () => {
    const { container } = render(<BalanceCard balance={balance} isStale />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
