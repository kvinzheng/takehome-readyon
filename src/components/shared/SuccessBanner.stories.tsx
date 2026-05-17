import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SuccessBanner } from './StatusBanners';

const meta: Meta<typeof SuccessBanner> = {
  title: 'Components/StatusBanners/SuccessBanner',
  component: SuccessBanner,
};
export default meta;
type Story = StoryObj<typeof SuccessBanner>;

/** Request accepted by the PTO system */
export const RequestAccepted: Story = {
  args: { message: 'Your time-off request has been submitted successfully.' },
};

/** Anniversary bonus applied */
export const BonusApplied: Story = {
  args: { message: 'Work-anniversary bonus of +5 days has been added to your balance.' },
};
