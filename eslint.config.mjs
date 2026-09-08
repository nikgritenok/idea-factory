// @ts-check
import unicorn from 'eslint-plugin-unicorn'
import withNuxt from './.nuxt/eslint.config.mjs'
import vitest from '@vitest/eslint-plugin'
import promise from 'eslint-plugin-promise'
import slop from 'eslint-plugin-slop'
import sonarjs from 'eslint-plugin-sonarjs'
import aiGuard from 'eslint-plugin-ai-guard'
import security from 'eslint-plugin-security'
import noSecrets from 'eslint-plugin-no-secrets'
import regexp from 'eslint-plugin-regexp'
import eslintComments from '@eslint-community/eslint-plugin-eslint-comments'
import perfectionist from 'eslint-plugin-perfectionist'
import vuejsAccessibility from 'eslint-plugin-vuejs-accessibility'

export default withNuxt(
  {
    ignores: ['.output/**', '.data/**', 'coverage/**', '**/*.generated.ts'],
  },

  // @ts-expect-error eslint-plugin-promise types incompatible with flat config
  {
    plugins: { promise },
    rules: {
      'promise/prefer-await-to-then': 'error',
      'promise/prefer-await-to-callbacks': 'error',
      'promise/no-nesting': 'error',
      'promise/no-return-wrap': 'error',
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { unicorn },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      // === Anti-slop: защитный избыточный код ===
      'unicorn/no-unnecessary-await': 'error',
      'unicorn/no-useless-undefined': 'error',
      'unicorn/no-useless-fallback-in-spread': 'error',
      'unicorn/no-useless-length-check': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/no-useless-switch-case': 'error',
      'unicorn/no-unnecessary-boolean-comparison': 'error',
      'unicorn/no-impossible-length-comparison': 'error',
      'unicorn/no-duplicate-if-branches': 'error',
      'unicorn/no-constant-zero-expression': 'error',

      // === Устаревшие API (автофиксы) ===
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/prefer-string-starts-ends-with': 'error',
      'unicorn/prefer-string-replace-all': 'error',
      'unicorn/prefer-regexp-test': 'error',
      'unicorn/no-typeof-undefined': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-structured-clone': 'error',
      'unicorn/prefer-group-by': 'error',
      'unicorn/prefer-date-now': 'error',
      'unicorn/prefer-modern-math-apis': 'error',
      'unicorn/prefer-queue-microtask': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-new-buffer': 'error',

      // === Async-slop ===
      'unicorn/no-await-in-promise-methods': 'error',
      'unicorn/no-single-promise-in-promise-methods': 'error',
      'unicorn/no-async-promise-finally': 'error',
      'unicorn/no-multiple-promise-resolver-calls': 'error',
      'unicorn/prefer-promise-with-resolvers': 'error',
      'unicorn/no-unsafe-promise-all-settled-values': 'error',

      // === Структурный slop ===
      'unicorn/no-nested-ternary': 'error',
      'unicorn/consistent-function-scoping': 'error',
      'unicorn/no-lonely-if': 'error',
      'unicorn/prefer-early-return': 'error',

      // === Против самого агента ===
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/expiring-todo-comments': 'error',
      'unicorn/no-barrel-files': 'error',

      // === Массивы и коллекции ===
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-array-flat-map': 'error',
      'unicorn/prefer-array-some': 'error',
      'unicorn/prefer-set-has': 'error',
      'unicorn/prefer-native-coercion-functions': 'error',
      'unicorn/prefer-string-raw': 'error',

      // === Тернари и операторы ===
      'unicorn/prefer-ternary': 'error',
      'unicorn/prefer-logical-operator-over-ternary': 'error',

      // --- Отключённые opiniated (плодят disable-комментарии) ---
      'unicorn/no-null': 'off',
      'unicorn/no-negated-condition': 'off',
      'unicorn/name-replacements': 'off',
      'unicorn/single-line-block-comment-style': 'off',
      'unicorn/template-indent': 'off',
      'unicorn/prefer-export-from': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/catch-error-name': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/custom-error-definition': 'off',
      'unicorn/no-top-level-side-effects': 'off',
      'unicorn/no-immediate-mutation': 'off',
      'unicorn/no-top-level-assignment-in-function': 'off',
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { slop },
    rules: {
      'slop/no-trivial-functions': 'error',
      'slop/no-trivial-type-aliases': 'error',
      'slop/no-chained-type-assertions': 'error',
      'slop/no-static-only-class': 'error',
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { sonarjs },
    rules: {
      // Дублирование и избыточный код
      'sonarjs/no-duplicate-string': 'error',
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-redundant-boolean': 'error',
      'sonarjs/no-redundant-parentheses': 'error',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-redundant-assignments': 'error',
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-useless-increment': 'error',
      'sonarjs/no-dead-store': 'error',
      'sonarjs/no-empty-collection': 'error',
      'sonarjs/no-same-line-conditional': 'error',

      // Структура
      'sonarjs/prefer-single-boolean-return': 'error',
      'sonarjs/prefer-immediate-return': 'error',
      'sonarjs/no-nested-switch': 'error',
      'sonarjs/no-nested-conditional': 'error',
      'sonarjs/cognitive-complexity': ['error', 20],
      'sonarjs/no-element-overwrite': 'error',
      'sonarjs/no-extra-arguments': 'error',
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-inverted-boolean-check': 'error',
      'sonarjs/no-small-switch': 'error',
      'sonarjs/prefer-object-literal': 'error',
      'sonarjs/prefer-while': 'error',

      // Промисы и async
      'sonarjs/no-try-promise': 'error',
      'sonarjs/prefer-promise-shorthand': 'error',

      // Отключённые:too noisy / не релевантны
      'sonarjs/no-commented-code': 'off',
      'sonarjs/no-unused-function-argument': 'off',
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { 'ai-guard': aiGuard },
    rules: {
      'ai-guard/no-empty-catch': 'error',
      'ai-guard/no-broad-exception': 'error',
      'ai-guard/no-catch-log-rethrow': 'error',
      'ai-guard/no-catch-without-use': 'error',
      'ai-guard/no-async-array-callback': 'error',
      'ai-guard/no-await-in-loop': 'error',
      'ai-guard/no-async-without-await': 'error',
      'ai-guard/no-hardcoded-secret': 'error',
      'ai-guard/no-eval-dynamic': 'error',
      'ai-guard/no-sql-string-concat': 'error',
      'ai-guard/no-unsafe-deserialize': 'error',
      'ai-guard/no-console-in-handler': 'error',
      'ai-guard/no-duplicate-logic-block': 'error',
      'ai-guard/no-dead-branch': 'error',

      // Конфликтует с @typescript-eslint/return-await: 'always'
      'ai-guard/no-redundant-await': 'off',
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { security },
    rules: {
      'security/detect-unsafe-regex': 'error',
      'security/detect-non-literal-regexp': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'error',
      'security/detect-non-literal-fs-filename': 'error',
      'security/detect-object-injection': 'off',
      'security/detect-possible-timing-attacks': 'warn',
    },
  },

  {
    files: ['**/*.{ts,vue,mjs}'],
    plugins: { 'no-secrets': noSecrets },
    rules: {
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],
    },
  },

  {
    files: ['**/*.ts'],
    plugins: { regexp },
    rules: {
      'regexp/no-dupe-characters-character-class': 'error',
      'regexp/no-useless-quantifier': 'error',
      'regexp/no-useless-flag': 'error',
      'regexp/optimal-quantifier-concatenation': 'error',
      'regexp/prefer-d': 'error',
      'regexp/prefer-w': 'error',
      'regexp/strict': 'error',
    },
  },

  // @ts-expect-error eslint-comments types incompatible with flat config
  {
    plugins: { 'eslint-comments': eslintComments },
    rules: {
      'eslint-comments/no-unused-disable': 'error',
      'eslint-comments/no-unlimited-disable': 'error',
      'eslint-comments/disable-enable-pair': 'error',
      'eslint-comments/require-description': ['error', { ignore: ['eslint-enable'] }],
    },
  },

  {
    files: ['**/*.{ts,vue}'],
    ignores: ['nuxt.config.ts'],
    plugins: { perfectionist },
    rules: {
      'perfectionist/sort-imports': ['error', {
        type: 'natural',
        order: 'asc',
      }],
      'perfectionist/sort-named-imports': 'error',
      'perfectionist/sort-objects': ['error', { type: 'natural', order: 'asc' }],
      'perfectionist/sort-interfaces': 'error',
      'perfectionist/sort-union-types': 'error',
    },
  },

  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['config/*.ts', 'playwright.config.ts', 'e2e/*.ts'],
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

      // === Type-aware: качество типов ===
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/return-await': ['error', 'always'],
      '@typescript-eslint/no-confusing-void-expression': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/promise-function-async': 'error',
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
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/define-macros-order': ['error', { order: ['defineProps', 'defineEmits'] }],
      'vue/no-ref-as-operand': 'error',
      'vue/no-setup-props-reactivity-loss': 'error',
    },
  },

  // @ts-expect-error vuejs-accessibility types incompatible with flat config
  ...vuejsAccessibility.configs['flat/recommended'].map(config => ({
    ...config,
    files: ['**/*.vue'],
  })),

  {
    files: ['**/*.ts'],
    ignores: ['**/*.test.ts', 'server/queue/worker-cli.ts', 'config/**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', { max: 4 }],
    },
  },
  {
    files: ['server/**/*.ts'],
    rules: {
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
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
      'unicorn/expiring-todo-comments': 'off',
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
      'unicorn/prefer-promise-with-resolvers': 'off',
      'slop/no-chained-type-assertions': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
)
