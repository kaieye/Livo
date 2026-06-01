export interface LocaleCompletenessReport {
  missingKeys: string[]
  extraKeys: string[]
  totalReferenceKeys: number
  coverage: number
  completeness: number
}

export function flattenLocaleKeys(
  value: unknown,
  prefix = '',
  output: string[] = [],
): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) output.push(prefix)
    return output.sort()
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      flattenLocaleKeys(nested, nextPrefix, output)
    } else {
      output.push(nextPrefix)
    }
  }

  return output.sort()
}

export function compareLocaleCompleteness(
  referenceLocale: unknown,
  candidateLocale: unknown,
): LocaleCompletenessReport {
  const referenceKeys = flattenLocaleKeys(referenceLocale)
  const candidateKeys = flattenLocaleKeys(candidateLocale)
  const candidateKeySet = new Set(candidateKeys)
  const referenceKeySet = new Set(referenceKeys)
  const missingKeys = referenceKeys.filter((key) => !candidateKeySet.has(key))
  const extraKeys = candidateKeys.filter((key) => !referenceKeySet.has(key))
  const totalReferenceKeys = referenceKeys.length
  const coverage =
    totalReferenceKeys === 0
      ? 1
      : (totalReferenceKeys - missingKeys.length) / totalReferenceKeys

  return {
    missingKeys,
    extraKeys,
    totalReferenceKeys,
    coverage,
    completeness: Math.round(coverage * 100),
  }
}
