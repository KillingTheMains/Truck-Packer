import globals from 'globals';

// Flat ESLint config. Catches the class of bug we keep hitting —
// undefined setters in the show-load reset block (setHistory / setCases) —
// via no-undef. Keep the rule set tight; this is a defensive net, not a
// style enforcer.
export default [
  {
    files: ['src/**/*.{js,jsx,mjs}', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        // CDN-loaded globals we use throughout main.jsx
        React: 'readonly',
        ReactDOM: 'readonly',
        firebase: 'readonly',
        db: 'readonly',
        jspdf: 'readonly',
        html2canvas: 'readonly',
        LZString: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
    },
  },
];
