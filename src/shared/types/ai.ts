// AI configuration and semantic filter types

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'glm' | 'ollama' | 'custom'
  apiKey: string
  apiKeys?: Record<string, string>
  baseUrl?: string
  model: string
  enableSystemPrompt?: boolean
  systemPromptTemplate?: string
  chatPersonaPrompt?: string
  summaryPrompt?: string
  translationPrompt?: string
}

export interface AISemanticFilterInput {
  condition: string
  title: string
  summary?: string
  feedTitle?: string
  author?: string
  url?: string
}

export interface AISemanticFilterDecision {
  matched: boolean
  confidence: number
  reason: string
}

export type AISemanticFilterResult =
  | { success: true; decision: AISemanticFilterDecision }
  | { success: false; error: string }

export type AIDigestPreset = 'today' | 'week'

export type AIDigestRunStatus = 'running' | 'completed' | 'failed'

export interface AIDigestCandidate {
  id: string
  title: string
  summary?: string
  content?: string
  feedTitle?: string
  url?: string
  publishedAt: number
}

export interface AIDigestRun {
  id: string
  preset: AIDigestPreset
  feedId?: string
  title: string
  status: AIDigestRunStatus
  windowStartAt: number
  windowEndAt: number
  sourceEntryIds: string[]
  candidateCount: number
  content?: string
  error?: string
  createdAt: number
  updatedAt: number
}

export type AIDigestGenerateResult =
  | { success: true; run: AIDigestRun; candidates: AIDigestCandidate[] }
  | { success: false; error: string; run?: AIDigestRun }

export type EntryAISummarySessionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'

export interface EntryAISummarySession {
  id: string
  entryId: string
  status: EntryAISummarySessionStatus
  draftText: string
  finalText?: string
  errorCode?: string
  errorMessage?: string
  rawErrorMessage?: string
  model?: string
  sourceHash?: string
  runId?: string
  createdAt: number
  updatedAt: number
  finishedAt?: number
}

export type EntryAITranslationSessionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'config_changed'

export type EntryAITranslationSegmentStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'

export interface EntryAITranslationSegment {
  index: number
  sourceText: string
  translatedText: string
  status: EntryAITranslationSegmentStatus
  errorMessage?: string
}

export interface EntryAITranslationSession {
  id: string
  entryId: string
  targetLanguage: string
  status: EntryAITranslationSessionStatus
  segments: EntryAITranslationSegment[]
  errorCode?: string
  errorMessage?: string
  model?: string
  configFingerprint?: string
  runId?: string
  createdAt: number
  updatedAt: number
  finishedAt?: number
}

export type AISummaryEntryResult =
  | {
      success: true
      summary: string
      session: EntryAISummarySession
      runId: string
    }
  | {
      success: false
      error: string
      session?: EntryAISummarySession
      runId?: string
    }

export const DEFAULT_AI_SYSTEM_PROMPT_TEMPLATE =
  'You are Livo AI assistant. Answer in concise Chinese. Context: {{context}}. Persona: {{persona}}.'

export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'o1-mini',
      'o1-preview',
    ],
  },
  anthropic: {
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    models: [
      'claude-sonnet-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  },
  glm: {
    name: 'GLM',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      'glm-4-plus',
      'glm-4-long',
      'glm-4-flash',
      'glm-4',
      'glm-4v-plus',
      'glm-4v',
    ],
  },
  ollama: {
    name: 'MiniMax',
    defaultBaseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'gemma2'],
  },
  custom: {
    name: 'Custom',
    defaultBaseUrl: '',
    models: [],
  },
} as const

export type AIProvider = keyof typeof AI_PROVIDERS
