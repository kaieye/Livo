import { ipcMain, BrowserWindow } from 'electron'
import OpenAI from 'openai'
import { IPC } from '../../shared/types'
import { getSettings } from './settings-handlers'
import { createOpenAIClient, validateAIConfig } from '../services/ai-client'
import { judgeSemanticFilter } from '../services/ai-filter'
import { normalizeAIError } from '../services/provider-protocol'
import { runWithRetry } from '../services/ai-retry'
import { ConnectionTestService } from '../services/connection-test'
import {
  buildSummaryPrompt,
  buildTranslatePrompt,
  clampContentToBudget,
} from '../services/ai-prompts'
import type { AISemanticFilterInput } from '../../shared/types'

function sendToAllWindows(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerAIHandlers(): void {
  // Summarize content
  ipcMain.handle(
    IPC.AI_SUMMARIZE,
    async (_event, content: string, language?: string, requestId?: string) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)
        const lang = language || settings.general.language || 'zh-CN'
        const messages: OpenAI.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: buildSummaryPrompt(lang, aiConfig.summaryPrompt),
          },
          {
            role: 'user',
            content: `Please summarize the following article:\n\n${clampContentToBudget(content, 8000)}`,
          },
        ]

        if (requestId) {
          const stream = await client.chat.completions.create({
            model: aiConfig.model,
            messages,
            temperature: 0.3,
            max_tokens: 500,
            stream: true,
          })

          let summary = ''
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            if (!delta) continue
            summary += delta
            sendToAllWindows('ai:summary-stream-chunk', {
              requestId,
              content: delta,
            })
          }
          sendToAllWindows('ai:summary-stream-done', { requestId })

          return { success: true, summary }
        }

        const summary = await runWithRetry(
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

        return { success: true, summary }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        if (requestId) {
          sendToAllWindows('ai:summary-stream-error', {
            requestId,
            error: normalized,
          })
        }
        return { success: false, error: normalized }
      }
    },
  )

  // Translate content
  ipcMain.handle(
    IPC.AI_TRANSLATE,
    async (
      _event,
      content: string,
      targetLanguage: string,
      requestId?: string,
    ) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)
        const systemPrompt = buildTranslatePrompt(
          targetLanguage,
          aiConfig.translationPrompt,
        )

        if (requestId) {
          const stream = await client.chat.completions.create({
            model: aiConfig.model,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: clampContentToBudget(content, 6000),
              },
            ],
            temperature: 0.2,
            max_tokens: 4000,
            stream: true,
          })

          let translation = ''
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || ''
            if (!delta) continue
            translation += delta
            sendToAllWindows('ai:translate-stream-chunk', {
              requestId,
              content: delta,
            })
          }
          sendToAllWindows('ai:translate-stream-done', { requestId })

          return { success: true, translation }
        }

        // Each retry trims the context further so an over-long request that
        // returned empty can still succeed on a shorter one.
        const contentBudgets = [6000, 4000, 2500]

        const translation = await runWithRetry(
          async (attempt) => {
            const budget =
              contentBudgets[Math.min(attempt, contentBudgets.length - 1)]
            const response = await client.chat.completions.create({
              model: aiConfig.model,
              messages: [
                {
                  role: 'system',
                  content: systemPrompt,
                },
                {
                  role: 'user',
                  content: clampContentToBudget(content, budget),
                },
              ],
              temperature: 0.2,
              max_tokens: 4000,
            })
            return response.choices[0]?.message?.content || ''
          },
          { isEmpty: (text) => !text.trim() },
        )

        return { success: true, translation }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        if (requestId) {
          sendToAllWindows('ai:translate-stream-error', {
            requestId,
            error: normalized,
          })
        }
        return { success: false, error: normalized }
      }
    },
  )

  // AI Chat (non-streaming)
  ipcMain.handle(
    IPC.AI_CHAT,
    async (_event, messages: Array<{ role: string; content: string }>) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)

        const response = await client.chat.completions.create({
          model: aiConfig.model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          max_tokens: 2000,
        })

        return {
          success: true,
          message: response.choices[0]?.message?.content || '',
        }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  // AI Chat (streaming via IPC events)
  ipcMain.handle(
    IPC.AI_CHAT_STREAM,
    async (
      _event,
      messages: Array<{ role: string; content: string }>,
      requestId: string,
    ) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)

        const stream = await client.chat.completions.create({
          model: aiConfig.model,
          messages: messages as OpenAI.ChatCompletionMessageParam[],
          temperature: 0.7,
          max_tokens: 4000,
          stream: true,
        })

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            sendToAllWindows('ai:chat-stream-chunk', {
              requestId,
              content,
            })
          }
        }

        sendToAllWindows('ai:chat-stream-done', { requestId })

        return { success: true }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        sendToAllWindows('ai:chat-stream-error', {
          requestId,
          error: normalized,
        })
        return { success: false, error: normalized }
      }
    },
  )

  ipcMain.handle(
    IPC.AI_FILTER_JUDGE,
    async (_event, input: AISemanticFilterInput) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      try {
        const decision = await judgeSemanticFilter(input, aiConfig)
        return { success: true, decision }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  // Connection test
  ipcMain.handle(IPC.AI_TEST_CONNECTION, async () => {
    const settings = getSettings()
    const aiConfig = settings.ai

    return ConnectionTestService.run({
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl || '',
      provider: aiConfig.provider,
    })
  })
}
