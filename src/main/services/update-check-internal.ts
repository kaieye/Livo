function normalizeVersion(value: string | undefined): string {
  return (value || '').trim().replace(/^v/i, '')
}

function compareVersions(a: string, b: string): number {
  const left = normalizeVersion(a)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
  const right = normalizeVersion(b)
    .split(/[.-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

export const __internal = {
  normalizeVersion,
  compareVersions,
}
