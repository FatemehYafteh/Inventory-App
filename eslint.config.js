import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['server/**/*.js', 'shared/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['shared/schemas/**/*.js'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Property[key.name=/^(message|required_error|invalid_type_error)$/] > :matches(Literal[raw=/^[\'"]/], TemplateLiteral).value',
          message: 'Use a message from shared/errorCodes.js',
        },
        {
          selector:
            'CallExpression[callee.property.name=/^(min|max|length|regex|email|url|int|positive|nonnegative|uuid|finite|strict)$/] > :matches(Literal[raw=/^[\'"]/], TemplateLiteral).arguments',
          message: 'Use a message from shared/errorCodes.js',
        },
      ],
    },
  },
  {
    files: ['client/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, 'react/jsx-uses-vars': 'error' },
  },
];
