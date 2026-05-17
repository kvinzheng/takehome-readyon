/**
 * Acceptance tests — /login route
 *
 * Written from the user's perspective (Given / When / Then in the test names).
 * Renders LoginForm with a mocked login server action.
 *
 * Suites:
 *  AC-1: Form Render
 *  AC-2: Authentication Error
 *  Accessibility — WCAG + keyboard focus
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { LoginForm } from '@/components/shared/LoginForm';

vi.mock('@/app/actions', () => ({
  login: vi.fn(),
}));

import { login } from '@/app/actions';

afterEach(() => {
  vi.clearAllMocks();
});

// ── AC-1: Form Render ──────────────────────────────────────────────────────

describe('AC-1: Form Render — /login', () => {
  it('Given the user is unauthenticated, When the login page loads, Then email, password, and submit are visible', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});

// ── AC-2: Authentication Error ─────────────────────────────────────────────

describe('AC-2: Authentication Error — /login', () => {
  it('Given invalid credentials, When form is submitted, Then an error message is shown', async () => {
    vi.mocked(login).mockResolvedValue('Invalid email or password.');

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    );
  });

  it('Given a login error, When shown to the user, Then it has role="alert" for immediate screen reader announcement', async () => {
    vi.mocked(login).mockResolvedValue('Invalid email or password.');

    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
  });
});

// ── Accessibility ──────────────────────────────────────────────────────────

describe('Accessibility — /login', () => {
  it('idle state has no WCAG violations', async () => {
    const { container } = render(<LoginForm />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('error state has no WCAG violations', async () => {
    vi.mocked(login).mockResolvedValue('Invalid email or password.');
    const user = userEvent.setup();
    const { container } = render(<LoginForm />);
    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('Fields and submit are reachable by keyboard in document order', async () => {
    render(<LoginForm />);
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
  });
});
