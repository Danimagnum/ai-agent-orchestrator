import * as Sentry from '@sentry/nestjs';
Sentry.init({ dsn: process.env.SENTRY_DSN || undefined, enabled: Boolean(process.env.SENTRY_DSN), environment: process.env.NODE_ENV ?? 'development', tracesSampleRate: 0.1, sendDefaultPii: false });
export { Sentry };
