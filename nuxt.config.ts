// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/a11y', '@sentry/nuxt/module', 'evlog/nuxt'],
  devtools: { enabled: true },
  app: {
    head: {
      link: [
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
    sentryDsn: '',
    // public
    public: {
      appName: 'Фабрика идей',
      appEnv: process.env.APP_ENV ?? 'development',
      sentryDsn: '',
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
      service: 'idea-factory',
    },
    include: ['/api/**'],
    transport: {
      enabled: true,
    },
  },
})
