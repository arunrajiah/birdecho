import * as Sentry from '@sentry/react-native';

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const rawRate = parseFloat(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '');
  const tracesSampleRate = Number.isNaN(rawRate) ? 0.2 : Math.min(1, Math.max(0, rawRate));

  Sentry.init({
    dsn,
    tracesSampleRate,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
