import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type {
  AIDigestCandidate,
  AIDigestPreset,
  AIDigestRun,
  Entry,
} from '../../../shared/types'
import { AIChatMarkdown } from '../components/ai/AIChatMarkdown'

function formatDateTime(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatWindow(run: AIDigestRun): string {
  return `${formatDateTime(run.windowStartAt)} - ${formatDateTime(run.windowEndAt)}`
}

function statusLabel(status: AIDigestRun['status']): string {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return '生成中'
}

export default function DigestPage() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<AIDigestPreset>('today')
  const [runs, setRuns] = useState<AIDigestRun[]>([])
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [sources, setSources] = useState<Array<Entry | AIDigestCandidate>>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRun = useMemo(
    () => runs.find((run) => run.id === activeRunId) ?? runs[0] ?? null,
    [activeRunId, runs],
  )

  const loadRuns = useCallback(async () => {
    setIsLoadingRuns(true)
    try {
      const nextRuns = await window.api.ai.digest.listRuns(30)
      setRuns(nextRuns)
      setActiveRunId((current) => current ?? nextRuns[0]?.id ?? null)
    } finally {
      setIsLoadingRuns(false)
    }
  }, [])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!activeRun) {
      setSources([])
      return
    }

    let cancelled = false
    void Promise.all(
      activeRun.sourceEntryIds.map((entryId) =>
        window.api.entries.get(entryId),
      ),
    ).then((entries) => {
      if (cancelled) return
      setSources(entries.filter((entry): entry is Entry => Boolean(entry)))
    })

    return () => {
      cancelled = true
    }
  }, [activeRun])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const result = await window.api.ai.digest.generate({ preset })
      if (!result.success) {
        setError(result.error)
        if (result.run) {
          setRuns((current) => [
            result.run!,
            ...current.filter((run) => run.id !== result.run!.id),
          ])
          setActiveRunId(result.run.id)
        }
        return
      }
      setRuns((current) => [
        result.run,
        ...current.filter((run) => run.id !== result.run.id),
      ])
      setActiveRunId(result.run.id)
      setSources(result.candidates)
    } finally {
      setIsGenerating(false)
      void loadRuns()
    }
  }, [loadRuns, preset])

  return (
    <div className="bg-surface text-text dark:bg-surface-dark dark:text-text-dark-primary flex h-screen w-screen overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="border-border dark:border-border-dark flex h-14 items-center gap-3 border-b px-4">
          <button
            onClick={() => navigate('/')}
            className="text-text-secondary hover:bg-surface-secondary hover:text-text dark:text-text-dark-secondary dark:hover:bg-surface-dark-secondary dark:hover:text-text-dark-primary rounded-md p-2 transition"
            title="返回阅读"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Sparkles size={19} className="text-accent" />
            <h1 className="truncate text-base font-semibold">AI 简报</h1>
          </div>
          <div className="bg-surface-secondary dark:bg-surface-dark-secondary flex rounded-lg p-1">
            {(['today', 'week'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setPreset(item)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  preset === item
                    ? 'text-accent dark:bg-surface-dark bg-white shadow-sm'
                    : 'text-text-secondary hover:text-text dark:text-text-dark-secondary dark:hover:text-text-dark-primary'
                }`}
              >
                {item === 'today' ? '今日简报' : '本周趋势'}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-accent hover:bg-accent-hover inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            生成
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {isLoadingRuns ? (
              <div className="text-text-secondary dark:text-text-dark-secondary flex h-full items-center justify-center">
                <Loader2 size={18} className="mr-2 animate-spin" />
                加载简报
              </div>
            ) : activeRun ? (
              <article className="mx-auto max-w-3xl">
                <div className="text-text-secondary dark:text-text-dark-secondary mb-5 flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} />
                    {formatWindow(activeRun)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <FileText size={15} />
                    候选 {activeRun.candidateCount} / 来源{' '}
                    {activeRun.sourceEntryIds.length}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      activeRun.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                        : activeRun.status === 'failed'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-300'
                          : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
                    }`}
                  >
                    {statusLabel(activeRun.status)}
                  </span>
                </div>

                {activeRun.content ? (
                  <div className="border-border dark:border-border-dark dark:bg-surface-dark-secondary rounded-lg border bg-white p-5 shadow-sm">
                    <AIChatMarkdown content={activeRun.content} />
                  </div>
                ) : (
                  <div className="border-border text-text-secondary dark:border-border-dark dark:text-text-dark-secondary rounded-lg border border-dashed px-5 py-16 text-center text-sm">
                    {activeRun.error || '暂无可展示的简报内容'}
                  </div>
                )}
              </article>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Sparkles size={28} className="text-accent mb-3" />
                <p className="text-text-secondary dark:text-text-dark-secondary text-sm">
                  选择时间窗后生成第一份 AI 简报
                </p>
              </div>
            )}
          </section>

          <aside className="border-border bg-surface-secondary/70 dark:border-border-dark dark:bg-surface-dark-secondary/70 flex min-h-0 flex-col border-l">
            <div className="border-border dark:border-border-dark border-b p-4">
              <h2 className="text-sm font-semibold">来源文章</h2>
              <p className="text-text-secondary dark:text-text-dark-secondary mt-1 text-xs">
                {sources.length} 篇
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {sources.length === 0 ? (
                <p className="text-text-secondary dark:text-text-dark-secondary px-1 py-3 text-sm">
                  当前简报没有来源记录
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => navigate(`/entry/${source.id}`)}
                      className="border-border hover:border-accent/50 hover:bg-accent/5 dark:border-border-dark dark:bg-surface-dark dark:hover:border-accent/50 w-full rounded-lg border bg-white px-3 py-2 text-left transition"
                    >
                      <div className="line-clamp-2 text-sm font-medium">
                        {source.title}
                      </div>
                      <div className="text-text-tertiary mt-1 flex items-center gap-2 text-xs">
                        <span className="truncate">
                          {'feedTitle' in source ? source.feedTitle : ''}
                        </span>
                        <span>{formatDateTime(source.publishedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-border dark:border-border-dark max-h-[38vh] overflow-y-auto border-t p-3">
              <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold">
                <Clock3 size={15} />
                历史记录
              </div>
              <div className="space-y-2">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setActiveRunId(run.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeRun?.id === run.id
                        ? 'bg-accent/10 text-accent ring-accent/30 ring-1'
                        : 'dark:hover:bg-surface-dark hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{run.title}</span>
                      <span className="text-xs">{statusLabel(run.status)}</span>
                    </div>
                    <div className="text-text-tertiary mt-1 text-xs">
                      {formatDateTime(run.updatedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
