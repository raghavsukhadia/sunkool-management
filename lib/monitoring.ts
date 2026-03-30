import * as Sentry from "@sentry/nextjs"

type MonitoringContext = Record<string, unknown>

export function reportError(error: unknown, context?: MonitoringContext) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return
  }

  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, {
          value,
        })
      })
    }
    Sentry.captureException(error)
  })
}
