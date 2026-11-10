import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Next.js's recommended rules. Rules that catch real bugs (hooks rules,
 * missing keys, unsafe links) are errors and fail CI. Style rules that the
 * existing code breaks in many places are warnings for now, so they're
 * visible without blocking deploys; tighten them as the code is cleaned up.
 */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts', 'tsconfig.tsbuildinfo'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
      'prefer-const': 'warn',
    },
  },
  // Config files use require() for plugins, which is the documented pattern.
  { files: ['*.config.{js,ts,mjs,cjs}'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
];

export default config;
