import { BrowserWindow, Notification } from 'electron'
import { createHash } from 'crypto'
import { getEventBus } from '../system/event-bus'
import type { ActionEffectType } from '../../../shared/actions'
import type { Entry, Feed } from '../../../shared/types/index'
import { dispatchAgentNavigation } from '../../agent/navigation-bridge'
import { getDb } from '../../database'
import { settingsProvider } from '../system/settings-provider'
import { validateAIConfig } from '../ai/ai-client'
import { runAISummarizeTask } from '../ai/ai-pipeline'
import { logWarnQuiet } from '../system/logger'
import { normalizeAIError } from '../ai/provider-protocol'
import { fetchReadableContent, resolveRelativeUrls } from './readability'
import { getLocalTaskRunner } from '../system/task-runner-service'
import { ENTRY_ACTION_EFFECT_TASK } from '../system/task-contracts'

export interface EntryActionEffectJob {
  entry: Entry
  feed: Feed
  effects: ActionEffectType[]
}

const SUPPORTED_EFFECTS = new Set<ActionEffectType>([
  'notify',
  'readability',
  'summarize',
])

function runnableEffects(effects: ActionEffectType[]): ActionEffectType[] {
  return effects.filter((effect) => SUPPORTED_EFFECTS.has(effect))
}

function plainText(value: string | undefined): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function notifyRenderer(): void {
  getEventBus().send('entries:enriched')
}

function updateEntryAndNotify(entryId: string, updates: Partial<Entry>): void {
  getDb().entries.updateEntry(entryId, updates)
  notifyRenderer()
}

function focusFirstWindow(): void {
  const win = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function showEntryNotification(entry: Entry, feed: Feed): void {
  if (entry.notifiedAt || !Notification.isSupported()) return

  const title = entry.title?.trim() || feed.title || 'Livo'
  const body =
    plainText(entry.summary || entry.content).slice(0, 180) || feed.title
  const notification = new Notification({ title, body })

  notification.on('click', () => {
    focusFirstWindow()
    dispatchAgentNavigation({
      type: 'open-entry-detail',
      entryId: entry.id,
    })
  })

  notification.show()
  updateEntryAndNotify(entry.id, { notifiedAt: Date.now() })
}

async function fetchReadability(entry: Entry): Promise<string> {
  if (entry.readabilityContent) return entry.readabilityContent
  if (!entry.url?.trim()) throw new Error('缺少文章 URL')

  const result = await fetchReadableContent(entry.url)
  const content = resolveRelativeUrls(result.content, entry.url)
  updateEntryAndNotify(entry.id, {
    readabilityContent: content,
    readabilityTitle: result.title,
    readabilityExcerpt: result.excerpt,
    readabilitySiteName: result.siteName,
    readabilityLength: result.length,
    readabilityFetchedAt: Date.now(),
    readabilityError: undefined,
  })
  return content
}

async function summarizeEntry(
  entry: Entry,
  contentOverride?: string,
): Promise<void> {
  if (entry.aiSummary?.trim()) return

  const settings = settingsProvider.get()
  const aiConfig = settings.ai
  const configError = validateAIConfig(aiConfig)
  if (configError) throw new Error(configError)

  const content =
    contentOverride ||
    entry.readabilityContent ||
    entry.content ||
    entry.summary ||
    entry.title
  if (!plainText(content).trim()) throw new Error('缺少可用于摘要的内容')

  // Route through the AI Summary pipeline so this auto-summarize path persists
  // an EntryAISummarySession (visible in the AI Summary UI) and inherits the
  // streaming-event / DeepSeek thinking-mode quirk / retry handling that the
  // user-initiated summarize already gets. Keeps a single AI Summary
  // implementation behind one seam.
  const sourceHash = createHash('sha256').update(content).digest('hex')
  const session = getDb().aiSummarySessions.createSession({
    entryId: entry.id,
    status: 'queued',
    draftText: '',
    model: aiConfig.model,
    sourceHash,
  })

  const language =
    settings.summary?.language || settings.general.language || 'zh-CN'
  await runAISummarizeTask({
    content,
    language,
    entryId: entry.id,
    sessionId: session.id,
    sourceHash,
  })
}

async function runJob(job: EntryActionEffectJob): Promise<void> {
  const effects = runnableEffects(job.effects)
  if (effects.length === 0) return

  if (effects.includes('notify')) {
    try {
      showEntryNotification(job.entry, job.feed)
    } catch (error) {
      logWarnQuiet('[action-effects] notify failed', {
        entryId: job.entry.id,
        feedId: job.feed.id,
        error: String(error),
      })
    }
  }

  let readableContent = job.entry.readabilityContent
  if (effects.includes('readability')) {
    try {
      readableContent = await fetchReadability(job.entry)
    } catch (error) {
      const message = String(error)
      updateEntryAndNotify(job.entry.id, { readabilityError: message })
      logWarnQuiet('[action-effects] readability failed', {
        entryId: job.entry.id,
        feedId: job.feed.id,
        error: message,
      })
    }
  }

  if (effects.includes('summarize')) {
    try {
      // runAISummarizeTask persists aiSummary + aiSummaryError on success/error
      // hooks; we just need to surface a renderer notification.
      await summarizeEntry(job.entry, readableContent)
      notifyRenderer()
    } catch (error) {
      const message = normalizeAIError(error, settingsProvider.get().ai)
      updateEntryAndNotify(job.entry.id, { aiSummaryError: message })
      logWarnQuiet('[action-effects] summarize failed', {
        entryId: job.entry.id,
        feedId: job.feed.id,
        error: message,
      })
    }
  }
}

export function enqueueEntryActionEffects(jobs: EntryActionEffectJob[]): void {
  const runner = getLocalTaskRunner()
  for (const job of jobs) {
    const effects = runnableEffects(job.effects)
    if (effects.length === 0) continue

    const task = runner.enqueue(
      ENTRY_ACTION_EFFECT_TASK,
      { ...job, effects },
      async (payload) => runJob(payload),
    )
    task.promise.catch((error) => {
      logWarnQuiet('[action-effects] task failed', {
        runId: task.runId,
        entryId: job.entry.id,
        feedId: job.feed.id,
        error: String(error),
      })
    })
  }
}
