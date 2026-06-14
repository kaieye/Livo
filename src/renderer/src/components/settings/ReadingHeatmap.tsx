import { useMemo, useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import { getReadingActivity, toDayKey } from '../../lib/reading-activity'

const WEEKS = 39 // 9个月（约39周）
const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['', '一', '', '三', '', '五', '']
const MONTH_LABELS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
]
// Accent-hued ramp: empty cell stays faint, intensity grows toward solid accent.
const LEVEL_ALPHA = [0.08, 0.3, 0.52, 0.74, 1]

interface DayCell {
  date: Date
  key: string
  count: number
  inRange: boolean
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function levelFor(count: number, max: number): number {
  if (count <= 0) return 0
  const ratio = count / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

export function ReadingHeatmap() {
  const [activityData, setActivityData] = useState(getReadingActivity)

  useEffect(() => {
    const handleUpdate = () => {
      setActivityData(getReadingActivity())
    }
    window.addEventListener('reading-activity-updated', handleUpdate)
    return () =>
      window.removeEventListener('reading-activity-updated', handleUpdate)
  }, [])

  const { columns, total, max } = useMemo(() => {
    const activity = activityData
    const today = startOfDay(new Date())
    // Align the rightmost column to the current week (column starts on Sunday).
    const gridStart = new Date(
      today.getTime() - (today.getDay() + (WEEKS - 1) * 7) * DAY_MS,
    )

    const cols: DayCell[][] = []
    let totalReads = 0
    let maxReads = 0
    for (let week = 0; week < WEEKS; week++) {
      const days: DayCell[] = []
      for (let dow = 0; dow < 7; dow++) {
        const date = new Date(gridStart.getTime() + (week * 7 + dow) * DAY_MS)
        const inRange = date.getTime() <= today.getTime()
        const key = toDayKey(date)
        const count = inRange ? (activity[key] ?? 0) : 0
        if (inRange) {
          totalReads += count
          if (count > maxReads) maxReads = count
        }
        days.push({ date, key, count, inRange })
      }
      cols.push(days)
    }
    return { columns: cols, total: totalReads, max: Math.max(1, maxReads) }
  }, [activityData])

  const monthLabels = useMemo(() => {
    let prevMonth = -1
    return columns.map((week) => {
      const firstInRange = week.find((d) => d.inRange) ?? week[0]
      const month = firstInRange.date.getMonth()
      if (month !== prevMonth) {
        prevMonth = month
        return MONTH_LABELS[month]
      }
      return ''
    })
  }, [columns])

  return (
    <div className="space-y-2">
      <style>{`
        .heatmap-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .heatmap-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .heatmap-scroll::-webkit-scrollbar-thumb {
          background: rgb(209 213 219);
          border-radius: 9999px;
        }
        .heatmap-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(156 163 175);
        }
        .dark .heatmap-scroll::-webkit-scrollbar-thumb {
          background: rgb(75 85 99);
        }
        .dark .heatmap-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(107 114 128);
        }
      `}</style>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <BookOpen size={15} className="text-accent" />
          <span>阅读热力图</span>
        </div>
        <span className="text-text-secondary dark:text-text-dark-secondary text-xs">
          过去9个月共阅读 {total} 篇
        </span>
      </div>

      <div
        className="heatmap-scroll -mx-4 overflow-x-auto px-4 py-2 sm:mx-0 sm:px-0"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgb(209 213 219) transparent',
          direction: 'rtl',
        }}
      >
        <div className="inline-flex gap-[3px]" style={{ direction: 'ltr' }}>
          {/* Weekday labels */}
          <div className="mr-1 flex w-3 shrink-0 flex-col gap-[3px]">
            <div className="mb-1 h-[14px]" /> {/* Spacer for month labels */}
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="text-text-tertiary dark:text-text-dark-secondary/70 flex h-[11px] w-full items-center justify-end text-[9px] leading-none"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid columns with month labels */}
          {columns.map((week, wi) => {
            const monthLabel = monthLabels[wi]
            return (
              <div
                key={wi}
                className="flex w-[11px] shrink-0 flex-col gap-[3px]"
              >
                {/* Month label positioned above each column */}
                <div className="text-text-tertiary dark:text-text-dark-secondary/70 mb-1 h-[14px] overflow-visible whitespace-nowrap text-[9px] leading-none">
                  {monthLabel}
                </div>
                {/* Day cells */}
                {week.map((day) => {
                  if (!day.inRange) {
                    return <div key={day.key} className="h-[11px] w-[11px]" />
                  }
                  const level = levelFor(day.count, max)
                  return (
                    <div
                      key={day.key}
                      title={`${day.key} · ${day.count} 篇`}
                      className="h-[11px] w-[11px] rounded-[2px]"
                      style={{
                        backgroundColor: `rgb(var(--color-accent-rgb) / ${LEVEL_ALPHA[level]})`,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <div className="text-text-tertiary dark:text-text-dark-secondary/70 flex items-center justify-end gap-1.5 text-[10px]">
        <span>少</span>
        {LEVEL_ALPHA.map((alpha, i) => (
          <div
            key={i}
            className="h-[11px] w-[11px] rounded-[2px]"
            style={{
              backgroundColor: `rgb(var(--color-accent-rgb) / ${alpha})`,
            }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  )
}
