import React from 'react';
import type { Preview } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '../src/app/globals.css';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
}

const preview: Preview = {
  decorators: [
    (Story) => {
      const qc = makeQueryClient();
      return (
        <QueryClientProvider client={qc}>
          <div className="bg-gray-50 min-h-screen p-6">
            <Story />
          </div>
        </QueryClientProvider>
      );
    },
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
  },
};

export default preview;