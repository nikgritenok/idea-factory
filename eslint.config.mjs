// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'
import vitest from '@vitest/eslint-plugin'
import promise from 'eslint-plugin-promise'

export default withNuxt(
  {
    ignores: ['.output/**', '.data/**', 'coverage/**', '**/*.generated.ts'],
  },

  {
    plugins: { promise },
  },

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['config/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
      '@typescript-eslint/await-thenable': 'error',

      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',

      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  {
    files: ['**/*.{ts,vue,mjs}'],
    rules: {
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
      'promise/no-multiple-resolved': 'error',
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-alert': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',

      'vue/no-mutating-props': 'error',
      'vue/require-explicit-emits': 'error',
      'vue/no-v-html': 'error',
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/prefer-true-attribute-shorthand': 'error',
    },
  },

  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', 'server/queue/worker-cli.ts', 'config/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', { max: 4 }],
    },
  },
  {
    files: ['app/**/*.vue'],
    rules: {
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    files: ['app/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['postgres', 'pg'], message: 'Драйверы БД — только в server/.' },
          { group: ['**/server/**'], message: 'Серверный код не импортируется на клиент.' },
          { group: ['node:*', 'fs', 'path', 'crypto'], message: 'Node builtins нельзя в app/.' },
        ],
      }],
      'no-restricted-properties': ['error',
        { object: 'process', property: 'env', message: 'Используй useRuntimeConfig().' },
      ],
      'no-restricted-syntax': ['error', {
        selector: 'VariableDeclarator[id.type=\'ObjectPattern\'] CallExpression[callee.name=/Store$/]',
        message: 'Не деструктурируй store — теряется реактивность. Используй storeToRefs().',
      }],
    },
  },

  {
    files: ['server/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['pinia', '~/stores', 'app/**'], message: 'Клиентский стейт недоступен в server/.' },
        ],
      }],
      'no-restricted-globals': ['error', 'window', 'document'],
      'no-restricted-properties': ['error',
        { object: 'process', property: 'env', message: 'Env — через Zod-валидацию.' },
        { object: 'sql', property: 'raw', message: 'sql.raw() — только параметризация sql`...`.' },
      ],
    },
  },

  {
    files: ['server/queue/worker-cli.ts', 'config/**/*.ts', 'server/utils/db.ts', 'server/utils/stt.ts', 'server/db/helpers.ts', 'server/queue/checkpointer.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
    },
  },

  {
    files: ['server/plugins/**/*.ts', 'server/db/migrate-cli.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-properties': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  {
    files: ['**/*.test.ts', 'test/**/*.ts'],
    plugins: { vitest },
    rules: {
      'vitest/no-focused-tests': 'error',
      'vitest/no-disabled-tests': 'warn',
      'vitest/expect-expect': 'error',
      'no-console': 'off',
      'no-restricted-properties': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-promise-executor-return': 'off',
    },
  },
)
