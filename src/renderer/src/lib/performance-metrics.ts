export interface AppPerformanceMetric {
  name: string
  value: number
  timestamp: number
  detail?: string
}

const metricStore = new Map<string, AppPerformanceMetric>()

export function recordAppMetric(
  name: string,
  value: number,
  detail?: string,
): void {
  const metric: AppPerformanceMetric = {
    name,
    value,
    timestamp: Date.now(),
    detail,
  }
  metricStore.set(name, metric)
  window.dispatchEvent(new CustomEvent('livo:perf', { detail: metric }))
  console.info(
    `[Livo Perf] ${name}: ${value.toFixed(1)}ms${detail ? ` (${detail})` : ''}`,
  )
}

export function readAppMetric(name: string): AppPerformanceMetric | undefined {
  return metricStore.get(name)
}
