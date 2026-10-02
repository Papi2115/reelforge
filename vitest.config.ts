import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['{apps,packages,tools,spikes}/*/src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
