import { BrowserWindow, Notification } from 'electron'
import { getEventBus } from '../system/event-bus'
import type OpenAI from 'openai'
import type { ActionEffectType } from '../../../shared/actions'
import type { Entry, Feed } from '../../../shared/types/index'
import { dispatchAgentNavigation } from '../../agent/navigation-bridge'
import { updateEntry } from '../../database'
import { getSettings } from '../../handlers/settings-handlers'
import { createOpenAIClient, validateAIConfig } from '../ai/ai-client'
import { buildSummaryPrompt, clampContentToBudget } from '../ai/ai-prompts'
import { runWithRetry } from '../ai/ai-retry'
import { logWarnQuiet } from '../system/logger'
import { normalizeAIError } from '../ai/provider-protocol'
import { fetchReadableContent, resolveRelativeUrls } from './readability'

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
const MAX_CONCURRENT_JOBS = 2

const queue: EntryActionEffectJob[] = []
const queuedKeys = new Set<string>()
let activeJobs = 0

function runnableEffects(effects: ActionEffectType[]): ActionEffectType[] {
  return effects.filter((effect) => SUPPORTED_EFFECTS.has(effect))
}

function jobKey(job: EntryActionEffectJob): string {
  return `${job.entry.id}:${runnableEffects(job.effects).join(',')}`
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
  updateEntry(entryId, updates)
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
): Promise<string> {
  if (entry.aiSummary?.trim()) return entry.aiSummary

  const settings = getSettings()
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

  const client = createOpenAIClient(aiConfig)
  const language =
    settings.summary?.language || settings.general.language || 'zh-CN'
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: buildSummaryPrompt(language, aiConfig.summaryPrompt),
    },
    {
      role: 'user',
      content: `Please summarize the following article:\n\n${clampContentToBudget(content, 8000)}`,
    },
  ]

  return runWithRetry(
    async () => {
      const response = await client.chat.completions.create({
        model: aiConfig.model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      })
      return response.choices[0]?.message?.content || ''
    },
    { isEmpty: (text) => !text.trim() },
  )
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
      const summary = await summarizeEntry(job.entry, readableContent)
      updateEntryAndNotify(job.entry.id, {
        aiSummary: summary,
        aiSummaryGeneratedAt: Date.now(),
        aiSummaryError: undefined,
      })
    } catch (error) {
      const message = normalizeAIError(error, getSettings().ai)
      updateEntryAndNotify(job.entry.id, { aiSummaryError: message })
      logWarnQuiet('[action-effects] summarize failed', {
        entryId: job.entry.id,
        feedId: job.feed.id,
        error: message,
      })
    }
  }
}

function drainQueue(): void {
  while (activeJobs < MAX_CONCURRENT_JOBS && queue.length > 0) {
    const job = queue.shift()
    if (!job) return
    const key = jobKey(job)
    activeJobs += 1
    void runJob(job).finally(() => {
      activeJobs -= 1
      queuedKeys.delete(key)
      drainQueue()
    })
  }
}

export function enqueueEntryActionEffects(jobs: EntryActionEffectJob[]): void {
  for (const job of jobs) {
    if (runnableEffects(job.effects).length === 0) continue
    const key = jobKey(job)
    if (queuedKeys.has(key)) continue
    queuedKeys.add(key)
    queue.push(job)
  }
  drainQueue()
}
