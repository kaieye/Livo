import { ipcMain, BrowserWindow } from "electron"
import OpenAI from "openai"
import { IPC, type AIConfig } from "../../shared/types"
import { getSettings } from "./settings-handlers"

function createOpenAIClient(config: AIConfig): OpenAI {
  const baseURL =
    config.baseUrl ||
    (config.provider === "openai"
      ? "https://api.openai.com/v1"
      : config.provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : config.provider === "deepseek"
          ? "https://api.deepseek.com/v1"
          : config.provider === "glm"
            ? "https://open.bigmodel.cn/api/paas/v4"
            : config.provider === "ollama"
              ? "http://localhost:11434/v1"
              : "https://api.openai.com/v1")

  return new OpenAI({
    apiKey: config.apiKey || "ollama", // ollama doesn't require key
    baseURL,
  })
}

function validateAIConfig(config: AIConfig): string | null {
  const apiKey = (config.apiKey || "").trim()
  const model = (config.model || "").trim()
  const baseUrl = (config.baseUrl || "").trim()

  if (config.provider !== "ollama" && !apiKey) {
    return "璇峰厛鍦ㄨ缃腑閰嶇疆 AI API Key"
  }
  if (!model) {
    return "璇峰厛閰嶇疆 AI 妯″瀷"
  }
  if (config.provider === "custom") {
    if (!baseUrl) return "Custom provider requires API base URL"
    if (!apiKey) return "Custom provider requires API Key"
    if (!model) return "Custom provider requires model"
  }
  return null
}

export function registerAIHandlers(): void {
  // Summarize content
  ipcMain.handle(IPC.AI_SUMMARIZE, async (_event, content: string, language?: string) => {
    const settings = getSettings()
    const aiConfig = settings.ai

    const configError = validateAIConfig(aiConfig)
    if (configError) return { success: false, error: configError }

    try {
      const client = createOpenAIClient(aiConfig)
      const lang = language || settings.general.language || "zh-CN"

      const response = await client.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that summarizes articles. Provide a concise summary in ${lang}. Keep it under 200 words. Focus on key points and main ideas.`,
          },
          {
            role: "user",
            content: `Please summarize the following article:\n\n${content.slice(0, 8000)}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      })

      return {
        success: true,
        summary: response.choices[0]?.message?.content || "",
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Translate content
  ipcMain.handle(IPC.AI_TRANSLATE, async (_event, content: string, targetLanguage: string) => {
    const settings = getSettings()
    const aiConfig = settings.ai

    const configError = validateAIConfig(aiConfig)
    if (configError) return { success: false, error: configError }

    try {
      const client = createOpenAIClient(aiConfig)

      const response = await client.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following content to ${targetLanguage}.
Rules:
- Preserve original HTML formatting and tags
- Only output the translation, no explanations or commentary
- Keep proper nouns, code, URLs, and technical terms as-is
- Translate naturally, not word-by-word
- If the content is already in the target language, output it unchanged`,
          },
          {
            role: "user",
            content: content.slice(0, 6000),
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      })

      return {
        success: true,
        translation: response.choices[0]?.message?.content || "",
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // AI Chat (non-streaming)
  ipcMain.handle(IPC.AI_CHAT, async (_event, messages: Array<{ role: string; content: string }>) => {
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
        message: response.choices[0]?.message?.content || "",
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // AI Chat (streaming via IPC events)
  ipcMain.handle(
    IPC.AI_CHAT_STREAM,
    async (_event, messages: Array<{ role: string; content: string }>, requestId: string) => {
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
          const content = chunk.choices[0]?.delta?.content || ""
          if (content) {
            for (const win of windows) {
              win.webContents.send("ai:chat-stream-chunk", { requestId, content })
            }
          }
        }

        for (const win of windows) {
          win.webContents.send("ai:chat-stream-done", { requestId })
        }

        return { success: true }
      } catch (error) {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send("ai:chat-stream-error", { requestId, error: String(error) })
        }
        return { success: false, error: String(error) }
      }
    }
  )
}



