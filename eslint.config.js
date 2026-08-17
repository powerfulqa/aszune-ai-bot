/**
 * ESLint flat configuration (ESLint 9+/10).
 * Migrated from .eslintrc.json — preserves the previous rule budget.
 */
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  // Ignored paths (replaces ignorePatterns / .eslintignore)
  {
    ignores: [
      'dashboard/public/**/*.html',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'data/**',
    ],
  },

  // Base recommended rules
  js.configs.recommended,

  // Project-wide settings and rule budget (CommonJS, Node + Jest globals)
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'warn',
      complexity: ['error', { max: 15 }],
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 25],
      // caughtErrors: 'none' preserves the pre-flat-config behaviour (ESLint 8
      // did not check catch bindings; ESLint 9 changed the default to 'all').
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Browser-side dashboard scripts
  {
    files: ['dashboard/public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        io: 'readonly',
        Chart: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      complexity: 'off',
    },
  },

  // Jest setup file
  {
    files: ['jest.setup.js'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_|^code$', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Test files — looser complexity/length budgets
  {
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    rules: {
      'max-lines-per-function': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 100],
      complexity: ['error', { max: 30 }],
      'max-depth': ['error', 6],
      'no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': 'off',
    },
  },
];
