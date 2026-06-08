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

export function getAllMetrics(): AppPerformanceMetric[] {
  return Array.from(metricStore.values())
}

export function clearMetrics(): void {
  metricStore.clear()
}

/**
 * Calculate performance improvement percentage
 */
export function calculateImprovement(
  before: number,
  after: number,
): { improved: boolean; percentage: number } {
  const diff = before - after
  const percentage = (diff / before) * 100
  return {
    improved: diff > 0,
    percentage: Math.abs(percentage),
  }
}

/**
 * Generate performance report comparing metrics
 */
export interface PerformanceReport {
  metric: string
  current: number
  target: number
  achieved: boolean
  improvement: number
  status: 'excellent' | 'good' | 'needs-improvement'
}

export function generatePerformanceReport(targets: Record<string, number>): PerformanceReport[] {
  const reports: PerformanceReport[] = []

  for (const [metricName, targetValue] of Object.entries(targets)) {
    const metric = readAppMetric(metricName)
    if (!metric) continue

    const achieved = metric.value <= targetValue
    const improvement = calculateImprovement(targetValue, metric.value).percentage

    let status: 'excellent' | 'good' | 'needs-improvement'
    if (metric.value <= targetValue * 0.8) {
      status = 'excellent'
    } else if (achieved) {
      status = 'good'
    } else {
      status = 'needs-improvement'
    }

    reports.push({
      metric: metricName,
      current: metric.value,
      target: targetValue,
      achieved,
      improvement,
      status,
    })
  }

  return reports
}

/**
 * Print performance summary to console
 */
export function printPerformanceSummary(): void {
  const targets = {
    'app.reactMounted': 600,
    'app.dataHydrated': 700,
    'app.ready': 700,
    'paint.lcp': 2000,
  }

  const reports = generatePerformanceReport(targets)

  console.group('[Livo Performance Summary]')
  for (const report of reports) {
    const emoji = report.status === 'excellent' ? '🎉' : report.status === 'good' ? '✅' : '⚠️'
    const statusText = report.achieved ? 'ACHIEVED' : 'NEEDS WORK'
    console.log(
      `${emoji} ${report.metric}: ${report.current.toFixed(0)}ms / ${report.target}ms - ${statusText}`,
    )
  }
  console.groupEnd()
}
