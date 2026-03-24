export interface LocaleCompletenessReport {
  missingKeys: string[]
  extraKeys: string[]
  completeness: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function flattenLocaleKeys(
  value: Record<string, unknown>,
  prefix = '',
  result: string[] = [],
): string[] {
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (isRecord(nestedValue)) {
      flattenLocaleKeys(nestedValue, nextKey, result)
    } else {
      result.push(nextKey)
    }
  }

  return result.sort()
}

export function compareLocaleCompleteness(
  sourceLocale: Record<string, unknown>,
  targetLocale: Record<string, unknown>,
): LocaleCompletenessReport {
  const sourceKeys = flattenLocaleKeys(sourceLocale)
  const targetKeys = flattenLocaleKeys(targetLocale)
  const sourceKeySet = new Set(sourceKeys)
  const targetKeySet = new Set(targetKeys)

  const missingKeys = sourceKeys.filter((key) => !targetKeySet.has(key))
  const extraKeys = targetKeys.filter((key) => !sourceKeySet.has(key))
  const completeness =
    sourceKeys.length === 0
      ? 100
      : Math.round(
          ((sourceKeys.length - missingKeys.length) / sourceKeys.length) * 100,
        )

  return {
    missingKeys,
    extraKeys,
    completeness,
  }
}
