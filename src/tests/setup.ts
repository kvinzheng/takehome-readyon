import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';

expect.extend(toHaveNoViolations);

// next/navigation is not mounted in jsdom. Provide stable stubs so components
// that call useRouter() (e.g. for router.refresh() after an SSE event) don't throw.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));
