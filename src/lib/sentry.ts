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

    // H-2 / M-2: Strip the X-Auth-Token header and any 'token' query param from
    // outgoing Sentry events so credentials never appear in breadcrumbs or requests.
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers['X-Auth-Token'];
        delete event.request.headers['x-auth-token'];
      }
      if (event.request?.url) {
        try {
          const u = new URL(event.request.url);
          u.searchParams.delete('token');
          event.request.url = u.toString();
        } catch {
          // URL parse failed — leave as-is
        }
      }
      return event;
    },
  });
}

// L-1: Capture unexpected exceptions (e.g. store hydration failures) via Sentry
// rather than console.error so they appear in the error dashboard.
export function captureException(error: unknown): void {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error);
  } else {
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
