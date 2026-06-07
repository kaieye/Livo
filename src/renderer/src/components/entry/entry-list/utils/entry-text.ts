/**
 * Text processing utilities for entry content
 */
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '../../../../lib/date-locale'
import { isRedundantRichText } from '../../../../lib/entry-text'

/**
 * Check if the plain-text summary adds no information beyond the title.
 */
export function isSummaryRedundant(title: string, summary: string): boolean {
  return isRedundantRichText(title, summary)
}

/**
 * Clean relative time by stripping verbose locale prefixes like the English "about" prefix.
 */
export function cleanRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date)
  const result = formatDistanceToNow(d, {
    addSuffix: true,
    locale: getDateLocale(),
  })
  // Remove verbose prefixes for cleaner display.
  return result.replace(/^about\s*/gi, '').replace(/^大约\s*/g, '')
}
