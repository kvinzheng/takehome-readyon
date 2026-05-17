import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, expect, userEvent, within } from '@storybook/test';
import { TimeOffForm } from './TimeOffForm';

const balances = [
  {
    employeeId: 'emp-1',
    locationId: 'loc-us',
    available: 10,
    used: 5,
    total: 15,
    asOf: new Date().toISOString(),
  },
  {
    employeeId: 'emp-1',
    locationId: 'loc-eu',
    available: 3,
    used: 2,
    total: 5,
    asOf: new Date().toISOString(),
  },
];

const meta: Meta<typeof TimeOffForm> = {
  title: 'Components/TimeOffForm',
  component: TimeOffForm,
  args: {
    balances,
    onSubmit: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof TimeOffForm>;

/** Idle — ready for input */
export const Idle: Story = {};

/** Submission in progress */
export const Submitting: Story = {
  args: { isSubmitting: true },
};

/** HCM rejected the request */
export const HcmRejected: Story = {
  args: {
    error: 'Insufficient balance: 3 days available, 5 requested.',
  },
};

/** HCM conflict response */
export const HcmConflict: Story = {
  args: {
    error: 'Request conflicts with an existing approved leave block.',
  },
};

/** Validation error — no dates selected */
export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const submitBtn = canvas.getByTestId('submit-button');
    await userEvent.click(submitBtn);
    await expect(canvas.getByTestId('form-error')).toBeInTheDocument();
  },
};

/** Interaction: happy path — fills and submits the form */
export const HappyPath: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await userEvent.selectOptions(
      canvas.getByLabelText('Location'),
      'loc-us'
    );
    await userEvent.type(canvas.getByLabelText('Start date'), '2026-08-01');
    await userEvent.type(canvas.getByLabelText('End date'), '2026-08-03');
    await userEvent.type(
      canvas.getByLabelText(/reason/i),
      'Summer vacation'
    );
    await userEvent.click(canvas.getByTestId('submit-button'));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ days: 3, locationId: 'loc-us' })
    );
  },
};
