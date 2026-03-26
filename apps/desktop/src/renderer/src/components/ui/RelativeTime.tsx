/**
 * RelativeTime — Enhanced timestamp component matching Folo-dev's RelativeTime.
 *
 * Features:
 * - Auto-refreshing relative time display
 * - Tooltip showing full formatted date on hover
 * - Switches to absolute date after 29 days
 * - Dynamic refresh intervals: 1s (< 1min), 1min (< 1hr), 1hr (< 1day), 1day (< threshold)
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { format } from "date-fns"
import { getDateLocale } from "../../lib/date-locale"

const ABSOLUTE_THRESHOLD_DAYS = 29

function formatRelative(date: Date, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (diffMs < 0) return t("time.justNow")

  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return t("time.justNow")
  if (diffMin < 60) return t("time.minutesAgo", { minutes: diffMin })
  if (diffHr < 24) return t("time.hoursAgo", { hours: diffHr })
  if (diffDay < ABSOLUTE_THRESHOLD_DAYS) return t("time.daysAgo", { days: diffDay })

  // Absolute date after threshold
  return format(date, "PPp", { locale: getDateLocale() })
}

function getRefreshInterval(date: Date): number | null {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 1000         // every 1s
  if (diffMin < 60) return 60_000        // every 1min
  if (diffHr < 24) return 3_600_000      // every 1hr
  if (diffDay < ABSOLUTE_THRESHOLD_DAYS) return 86_400_000 // every 1day
  return null // no refresh needed for absolute dates
}

export function RelativeTime({
  date,
  className,
}: {
  date: Date | number
  className?: string
}) {
  const { t } = useTranslation()
  const dateObj = useMemo(() => (date instanceof Date ? date : new Date(date)), [date])
  const [text, setText] = useState(() => formatRelative(dateObj, t))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fullDate = format(dateObj, "PPpp", { locale: getDateLocale() })

  const refresh = useCallback(() => {
    setText(formatRelative(dateObj, t))

    // Schedule next refresh
    const interval = getRefreshInterval(dateObj)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (interval !== null) {
      timerRef.current = setTimeout(refresh, interval)
    }
  }, [dateObj, t])

  useEffect(() => {
    refresh()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [refresh])

  return (
    <time
      dateTime={dateObj.toISOString()}
      title={fullDate}
      className={className}
    >
      {text}
    </time>
  )
}
