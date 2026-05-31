import { ipcMain, BrowserWindow } from 'electron'
import OpenAI from 'openai'
import { IPC } from '../../shared/types'
import { getSettings } from './settings-handlers'
import { createOpenAIClient, validateAIConfig } from '../services/ai-client'
import { normalizeAIError } from '../services/provider-protocol'
import { runWithRetry } from '../services/ai-retry'

export function registerAIHandlers(): void {
  // Summarize content
  ipcMain.handle(
    IPC.AI_SUMMARIZE,
    async (_event, content: string, language?: string) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)
        const lang = language || settings.general.language || 'zh-CN'

        const summary = await runWithRetry(
          async () => {
            const response = await client.chat.completions.create({
              model: aiConfig.model,
              messages: [
                {
                  role: 'system',
                  content: `You are a helpful assistant that summarizes articles. Provide a concise summary in ${lang}. Keep it under 200 words. Focus on key points and main ideas.`,
                },
                {
                  role: 'user',
                  content: `Please summarize the following article:\n\n${content.slice(0, 8000)}`,
                },
              ],
              temperature: 0.3,
              max_tokens: 500,
            })
            return response.choices[0]?.message?.content || ''
          },
          { isEmpty: (text) => !text.trim() },
        )

        return { success: true, summary }
      } catch (error) {
        return { success: false, error: normalizeAIError(error, aiConfig) }
      }
    },
  )

  // Translate content
  ipcMain.handle(
    IPC.AI_TRANSLATE,
    async (_event, content: string, targetLanguage: string) => {
      const settings = getSettings()
      const aiConfig = settings.ai

      const configError = validateAIConfig(aiConfig)
      if (configError) return { success: false, error: configError }

      try {
        const client = createOpenAIClient(aiConfig)

        // Multi-tier degrade (TranslationPipeline equivalent): each retry trims
        // the context so an over-long request that returned empty can succeed
        // on a shorter one.
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
                  content: `You are a professional translator. Translate the following content to ${targetLanguage}.
Rules:
- Preserve original HTML formatting and tags
- Only output the translation, no explanations or commentary
- Keep proper nouns, code, URLs, and technical terms as-is
- Translate naturally, not word-by-word
- If the content is already in the target language, output it unchanged`,
                },
                {
                  role: 'user',
                  content: content.slice(0, budget),
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
        return { success: false, error: normalizeAIError(error, aiConfig) }
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
        const windows = BrowserWindow.getAllWindows()

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
            for (const win of windows) {
              win.webContents.send('ai:chat-stream-chunk', {
                requestId,
                content,
              })
            }
          }
        }

        for (const win of windows) {
          win.webContents.send('ai:chat-stream-done', { requestId })
        }

        return { success: true }
      } catch (error) {
        const normalized = normalizeAIError(error, aiConfig)
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('ai:chat-stream-error', {
            requestId,
            error: normalized,
          })
        }
        return { success: false, error: normalized }
      }
    },
  )
}
