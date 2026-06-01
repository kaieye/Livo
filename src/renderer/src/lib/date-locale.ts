/**
 * Returns the correct date-fns locale based on current i18next language.
 */
import type { Locale } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { enUS } from 'date-fns/locale'
import i18next from 'i18next'

const LOCALE_MAP: Record<string, Locale> = {
  'zh-CN': zhCN,
  en: enUS,
}

export function getDateLocale(): Locale {
  return LOCALE_MAP[i18next.language] || enUS
}
