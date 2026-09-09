import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-no-target-blank': 'off',
      // This is a plain-JS React app that documents props in JSDoc/comments
      // rather than PropTypes; the rule would fire on every component.
      'react/prop-types': 'off',
      // Apostrophes and quotes in JSX copy are intentional and readable as
      // written; escaping them would only make the source harder to edit.
      'react/no-unescaped-entities': 'off',
      // `catch (err) {}` where the error is deliberately swallowed is a
      // pattern used throughout the app; unused *variables* still error.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      // TODO(lint-backlog): the react-hooks v7 compiler rules flag real issues
      // across the app (state set inside effects, ref access during render).
      // Warn for now so CI blocks *new* problems, and burn the backlog down
      // file by file before restoring these to 'error'.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Vitest injects describe/it/expect/vi as globals (test.globals in
    // vite.config.js), and tests reach for node globals when stubbing.
    files: ['src/test/**/*.{js,jsx}', '**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
]
