import * as Sentry from '@sentry/nuxt'

Sentry.init({
  dsn: useRuntimeConfig().sentryDsn || useRuntimeConfig().public.sentryDsn,

  environment: useRuntimeConfig().public.appEnv || 'development',

  tracesSampleRate: 0.1,

  enabled:
    process.env.NODE_ENV === 'production'
    || process.env.SENTRY_ENABLED === 'true',
})
