/**
 * Integration tests — ManagerView with all hooks wired up.
 *
 * We mock only the HCM API module (the network boundary) so that every layer
 * above it — useRequests, useManagerActions, and the page itself — runs exactly
 * as it does in production.
 *
 * Covered scenarios:
 *  1. Pending requests list — request cards shown when requests exist.
 *  2. Empty state — empty-pending shown when no requests.
 *  3. Approve action — calls approveRequest with the correct id.
 *  4. Deny action — calls denyRequest with the correct id.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import ManagerView from '@/app/manager/page';

vi.mock('@/lib/pto-api', () => ({
  fetchBalance: vi.fn(),
  fetchRequests: vi.fn(),
  approveRequest: vi.fn(),
  denyRequest: vi.fn(),
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

const pendingRequest = {
  id: 'req-manager-001',
  employeeId: 'emp-1',
  locationId: 'loc-us',
  startDate: '2026-08-01',
  endDate: '2026-08-03',
  days: 3,
  reason: 'Vacation',
  status: 'pending_approval' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(leaveApi.fetchBalance).mockResolvedValue(seedBalance);
  vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(leaveApi.approveTimeOffRequest).mockResolvedValue({ success: true } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(leaveApi.denyTimeOffRequest).mockResolvedValue({ success: true } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ManagerView integration: pending requests list', () => {
  it('shows a request card when there are pending requests', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [pendingRequest] });

    render(<ManagerView />);

    await waitFor(() => {
      expect(screen.getByTestId('request-card')).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no pending requests', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [] });

    render(<ManagerView />);

    await waitFor(() => {
      expect(screen.getByTestId('empty-pending')).toBeInTheDocument();
    });
  });

  it('approve button calls approveRequest with the correct id', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [pendingRequest] });
    const user = userEvent.setup();
    render(<ManagerView />);

    const approveBtn = await screen.findByTestId('approve-btn');
    await user.click(approveBtn);

    await waitFor(() => {
      expect(vi.mocked(leaveApi.approveTimeOffRequest)).toHaveBeenCalledWith(pendingRequest.id);
    });
  });

  it('deny button calls denyRequest with the correct id', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [pendingRequest] });
    const user = userEvent.setup();
    render(<ManagerView />);

    const denyBtn = await screen.findByTestId('deny-btn');
    await user.click(denyBtn);

    await waitFor(() => {
      expect(vi.mocked(leaveApi.denyTimeOffRequest)).toHaveBeenCalledWith(pendingRequest.id);
    });
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('ManagerView a11y', () => {
  it('empty pending page has no axe violations', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [] });
    const { container } = render(<ManagerView />);
    await waitFor(() => screen.getByTestId('empty-pending'));
    expect(await axe(container)).toHaveNoViolations();
  });

  it('page with pending requests has no axe violations', async () => {
    vi.mocked(leaveApi.fetchTimeOffRequests).mockResolvedValue({ requests: [pendingRequest] });
    const { container } = render(<ManagerView />);
    await waitFor(() => screen.getByTestId('request-card'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
