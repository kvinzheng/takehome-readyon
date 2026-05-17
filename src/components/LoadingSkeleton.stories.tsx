import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from '@storybook/test';
import { LoadingSkeleton } from '@/components/StatusBanners';

const meta: Meta<typeof LoadingSkeleton> = {
  title: 'Components/StatusBanners/LoadingSkeleton',
  component: LoadingSkeleton,
};
export default meta;
type Story = StoryObj<typeof LoadingSkeleton>;

/** Default — 3 skeleton rows */
export const Default: Story = {};

/** Single row (e.g. loading one balance card) */
export const SingleRow: Story = {
  args: { rows: 1 },
};

/** Many rows */
export const ManyRows: Story = {
  args: { rows: 6 },
};

/** Verifies the accessible loading label is present */
export const AccessibleLabel: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const skeleton = canvas.getByTestId('loading-skeleton');
    await expect(skeleton).toHaveAttribute('aria-label', 'Loading');
    await expect(skeleton).toHaveAttribute('role', 'status');
  },
};
