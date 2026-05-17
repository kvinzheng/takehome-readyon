import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from '@storybook/test';
import { StaleWarning } from '@/components/StatusBanners';

const meta: Meta<typeof StaleWarning> = {
  title: 'Components/StatusBanners/StaleWarning',
  component: StaleWarning,
};
export default meta;
type Story = StoryObj<typeof StaleWarning>;

/** With a refresh button — user can manually re-fetch */
export const WithRefresh: Story = {
  args: { onRefresh: fn() },
};

/** Without a refresh button — informational only */
export const ReadOnly: Story = {
  args: { onRefresh: undefined },
};
