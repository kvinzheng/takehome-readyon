import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import React from 'react';

expect.extend(toHaveNoViolations);

// next-auth/react is not available in jsdom. Stub useSession with a realistic
// employee session so components that call useAuth() don't throw.
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'emp-1', name: 'Test Employee', email: 'emp@test.com', role: 'employee' } },
    status: 'authenticated',
  }),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// next/navigation is not mounted in jsdom. Provide stable stubs so components
// that call useRouter() (e.g. for router.refresh() after an SSE event) don't throw.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
