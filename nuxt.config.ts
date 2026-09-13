// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', 'evlog/nuxt', '@nuxt/icon', 'motion-v/nuxt'],
  // На стенде wide event пишется и в stdout (его собирает Dokploy), и в файл
  // (.evlog/logs/, см. server/plugins/evlog-drain.ts). Чтобы файл не разрастался,
  // info-события сэмплируются, а error/warn остаются 100% и медленные/ошибочные
  // запросы force-keep'ятся.
  $production: {
    evlog: {
      sampling: {
        keep: [{ duration: 1000 }, { status: 400 }],
        rates: { debug: 0, info: 10 },
      },
    },
  },
  devtools: { enabled: true },
  app: {
    head: {
      // Язык документа обязателен: без него скринридер читает русскую разметку
      // латинской раскладкой (требование доступности в TZ.md §6).
      htmlAttrs: { lang: 'ru' },
      link: [
        {
          rel: 'icon',
          type: 'image/svg+xml',
          href: '/favicon.svg',
        },
        {
          crossorigin: '',
          href: 'https://fonts.gstatic.com',
          rel: 'preconnect',
        },
        {
          href: 'https://fonts.googleapis.com',
          rel: 'preconnect',
        },
        {
          href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;700&display=swap',
          rel: 'stylesheet',
        },
      ],
    },
  },
  css: ['~/assets/css/tailwind.css'],
  runtimeConfig: {
    // server-only
    openaiApiKey: '',
    // public
    public: {
      appName: 'Фабрика идей',
      appEnv: process.env.APP_ENV ?? 'development',
    },
  },
  compatibilityDate: '2025-07-15',
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
  evlog: {
    env: {
      environment: process.env.APP_ENV ?? 'development',
      service: 'idea-factory',
    },
    // Паттерн включает НЕ создание логгера (он в Nuxt-интеграции создаётся на любой
    // запрос), а emit широкого события. Без `/docs/**` роут server/routes/docs/[name].get.ts
    // копил контекст и молча его терял.
    include: ['/api/**', '/docs/**'],
    transport: {
      enabled: true,
    },
  },
})
