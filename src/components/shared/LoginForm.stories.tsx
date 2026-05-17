import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LoginForm } from './LoginForm';

/**
 * LoginForm hard-wires useActionState(login, null) so it can't accept
 * external state props. Stories here cover the visual idle state only.
 * Error + loading states are validated in the acceptance test suite.
 */
const meta: Meta<typeof LoginForm> = {
  title: 'Components/LoginForm',
  component: LoginForm,
  parameters: {
    // Prevent the form action from navigating during play tests
    nextjs: { appDirectory: true },
  },
};
export default meta;
type Story = StoryObj<typeof LoginForm>;

/** Idle — ready for input */
export const Idle: Story = {};
