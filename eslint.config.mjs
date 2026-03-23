import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['Folo-dev/**', 'node_modules/**', 'out/**', 'dist/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
      'no-undef': 'off',
      'no-misleading-character-class': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': 'off',
      'no-empty': 'off',
      'no-undef': 'off',
      'no-misleading-character-class': 'off',
      'no-useless-escape': 'off',
      'prefer-const': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
)
