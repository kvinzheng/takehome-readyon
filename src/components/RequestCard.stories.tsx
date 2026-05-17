import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from '@storybook/test';
import { RequestCard } from '@/components/RequestCard';
import type { TimeOffRequest } from '@/types';

const baseRequest: TimeOffRequest = {
  id: 'req-001',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  days: 3,
  reason: 'Summer vacation',
  status: 'pending_approval',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const balance = {
  employeeId: 'emp-1',
  locationId: 'loc-us',
  available: 10,
  used: 5,
  total: 15,
  asOf: new Date().toISOString(),
};

const meta: Meta<typeof RequestCard> = {
  title: 'Components/RequestCard',
  component: RequestCard,
  args: {
    request: baseRequest,
    onApprove: fn(),
    onDeny: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof RequestCard>;

/** Manager decision view — balance context visible */
export const PendingWithBalance: Story = {
  args: { balance },
};

/** No balance context (employee view) */
export const PendingEmployeeView: Story = {
  args: { balance: undefined, onApprove: undefined, onDeny: undefined },
};

/** Approved */
export const Approved: Story = {
  args: {
    request: { ...baseRequest, status: 'approved' },
    balance: undefined,
    onApprove: undefined,
    onDeny: undefined,
  },
};

/** Denied */
export const Denied: Story = {
  args: {
    request: { ...baseRequest, status: 'denied' },
    balance: undefined,
    onApprove: undefined,
    onDeny: undefined,
  },
};

/** Optimistic rolled back — PTO system silently failed */
export const OptimisticRolledBack: Story = {
  args: {
    request: {
      ...baseRequest,
      status: 'rolled_back',
      ptoError: 'PTO system did not confirm this request. Balance has been restored.',
    },
    onApprove: undefined,
    onDeny: undefined,
  },
};

/** PTO system rejected with error */
export const PtoRejected: Story = {
  args: {
    request: {
      ...baseRequest,
      status: 'denied',
      ptoError: 'Insufficient balance: 3 days available, 5 requested.',
    },
    onApprove: undefined,
    onDeny: undefined,
  },
};

/** Action in progress (approve/deny API call pending) */
export const ActionInProgress: Story = {
  args: { balance, isActing: true },
};
