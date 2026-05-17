import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BalanceCard } from './BalanceCard';

const baseBalance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: new Date().toISOString(),
};

const meta: Meta<typeof BalanceCard> = {
  title: 'Components/BalanceCard',
  component: BalanceCard,
  args: { balance: baseBalance },
};
export default meta;
type Story = StoryObj<typeof BalanceCard>;

/** Default state — fresh data, no optimistic updates */
export const Default: Story = {};

/** Balance is low (below 25% of total) */
export const LowBalance: Story = {
  args: {
    balance: { ...baseBalance, available: 2, used: 13, total: 15 },
  },
};

/** Balance is zero */
export const Empty: Story = {
  args: {
    balance: { ...baseBalance, available: 0, used: 15, total: 15 },
  },
};

/** Optimistic update pending — shown after user submits a request */
export const OptimisticPending: Story = {
  args: {
    balance: { ...baseBalance, available: 7, used: 8 },
    isOptimistic: true,
  },
};

/** Background sync in progress (window focus refetch) */
export const Syncing: Story = {
  args: { isSyncing: true },
};

/** Data is stale — over the staleTime threshold, not yet refetching */
export const Stale: Story = {
  args: {
    balance: {
      ...baseBalance,
      asOf: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    isStale: true,
  },
};

/** Balance refreshed mid-session (e.g. after anniversary bonus) */
export const BalanceRefreshedMidSession: Story = {
  args: {
    balance: { ...baseBalance, available: 15, used: 5, total: 20 },
    isSyncing: false,
    isStale: false,
  },
  name: 'Balance Refreshed (Mid-Session)',
};
