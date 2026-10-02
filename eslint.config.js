import eslint from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/coverage/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
      'no-empty': ['error', { allowEmptyCatch: false }],
      'no-console': 'error',
    },
  },
  // Spikes (throwaway experiments, see docs/spikes/): CLI scripts may print results.
  {
    files: ['spikes/*/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  // Determinism guard for scene code (CLAUDE.md §3.2); the real lint lands in PLAN.md#2.6.
  {
    files: ['spikes/*/src/scene/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'Date',
        'performance',
        'requestAnimationFrame',
        'setTimeout',
        'setInterval',
        'fetch',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded RNG (rng.ts).' },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettierConfig,
);
