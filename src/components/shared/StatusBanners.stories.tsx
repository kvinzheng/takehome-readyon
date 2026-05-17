import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from '@storybook/test';
import {
  ErrorBanner,
  StaleWarning,
  SuccessBanner,
  LoadingSkeleton,
} from './StatusBanners';

// ── ErrorBanner ───────────────────────────────────────────────────────────────

const errorMeta: Meta<typeof ErrorBanner> = {
  title: 'Components/StatusBanners/ErrorBanner',
  component: ErrorBanner,
};
export default errorMeta;
type ErrorStory = StoryObj<typeof ErrorBanner>;

export const WithMessage: ErrorStory = {
  args: { message: 'Unable to load balances. Please refresh.' },
};

export const Hidden: ErrorStory = {
  args: { message: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByTestId('error-banner')).not.toBeInTheDocument();
  },
};
