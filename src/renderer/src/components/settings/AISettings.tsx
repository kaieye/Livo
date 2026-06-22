import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import {
  AI_PROVIDERS,
  DEFAULT_AGENT_MAX_ROUNDS,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_TEMPERATURE,
  DEFAULT_SETTINGS,
  MAX_AGENT_MAX_ROUNDS,
  MAX_AGENT_MAX_TOKENS,
  MAX_AGENT_RUN_TIMEOUT_SECONDS,
  MAX_AGENT_TEMPERATURE,
  type AIConfig,
  type AIProvider,
} from '../../../../shared/types'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Cpu,
  MessageSquareText,
  FileText,
  Wifi,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Link2,
  Trash2,
  Settings as SettingsIcon,
  Timer,
} from 'lucide-react'

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-surface dark:bg-surface-dark-secondary rounded-xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-accent" />
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      {description && (
        <p className="text-text-secondary dark:text-text-dark-secondary mb-3 text-xs">
          {description}
        </p>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Fields that require explicit save via the bottom save button. */
type PromptFields = Pick<
  AIConfig,
  | 'enableSystemPrompt'
  | 'systemPromptTemplate'
  | 'chatPersonaPrompt'
  | 'summaryPrompt'
  | 'translationPrompt'
>

function pickConnectionFields(config: AIConfig): Partial<AIConfig> {
  return {
    provider: config.provider,
    apiKey: config.apiKey,
    apiKeys: config.apiKeys,
    baseUrl: config.baseUrl,
    baseUrls: config.baseUrls,
    model: config.model,
    models: config.models,
  }
}

function rememberCurrentProviderConnection(
  config: AIConfig,
): Partial<AIConfig> {
  return {
    apiKeys: { ...(config.apiKeys || {}), [config.provider]: config.apiKey },
    baseUrls: {
      ...(config.baseUrls || {}),
      [config.provider]: config.baseUrl || '',
    },
    models: { ...(config.models || {}), [config.provider]: config.model },
  }
}

function pickPromptFields(config: AIConfig): PromptFields {
  return {
    enableSystemPrompt: config.enableSystemPrompt,
    systemPromptTemplate: config.systemPromptTemplate,
    chatPersonaPrompt: config.chatPersonaPrompt,
    summaryPrompt: config.summaryPrompt,
    translationPrompt: config.translationPrompt,
  }
}

function isPromptDirtyFn(draft: AIConfig, saved: AIConfig): boolean {
  return (
    draft.enableSystemPrompt !== saved.enableSystemPrompt ||
    draft.systemPromptTemplate !== saved.systemPromptTemplate ||
    draft.chatPersonaPrompt !== saved.chatPersonaPrompt ||
    draft.summaryPrompt !== saved.summaryPrompt ||
    draft.translationPrompt !== saved.translationPrompt
  )
}

export function AISettings() {
  const ai = useSettingSection('ai')
  const agent = useSettingSection('agent') || DEFAULT_SETTINGS.agent
  const permissions = useSettingSection('agentPermissions')
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()
  const [draftAi, setDraftAi] = useState<AIConfig>(ai)
  const [isSaving, setIsSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isCustomModel, setIsCustomModel] = useState(false)

  // Only prompt fields are "dirty" — connection fields auto-save.
  const isPromptDirty = isPromptDirtyFn(draftAi, ai)

  // Debounced auto-save for connection fields.
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const autoSave = useCallback(
    (updates: Partial<AIConfig>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        updateSettingsSection('ai', updates)
      }, 600)
    },
    [updateSettingsSection],
  )

  // Sync draft when saved config changes externally.  Only sync when prompts
  // are clean — otherwise the user is mid-edit on prompts and we don't want to
  // clobber their work.
  useEffect(() => {
    if (!isPromptDirty) setDraftAi(ai)
  }, [ai, isPromptDirty])

  // Cleanup debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const providerConfig = AI_PROVIDERS[draftAi.provider]
  const isCustomProvider = draftAi.provider === 'custom'
  const isApiKeyMissing = !draftAi.apiKey.trim()
  const isBaseUrlMissing = isCustomProvider && !(draftAi.baseUrl || '').trim()
  const isModelMissing = isCustomProvider && !draftAi.model.trim()
  const baseUrlHint = isCustomProvider
    ? t('settings.customBaseUrlHint')
    : `${t('settings.baseUrlHint')}${providerConfig.defaultBaseUrl || 'N/A'}`
  const draftValidationMessage = isBaseUrlMissing
    ? t('settings.aiValidationBaseUrlRequired')
    : isModelMissing
      ? t('settings.aiValidationModelRequired')
      : null
  const disableTestConnection =
    isTesting || isApiKeyMissing || isBaseUrlMissing || isModelMissing
  const disableSave = isSaving || !isPromptDirty || !!draftValidationMessage

  const clearFeedback = () => {
    setTestResult(null)
    setActionMessage(null)
  }

  // ── Connection field handlers (auto-save) ──

  const handleProviderChange = (provider: AIProvider) => {
    const config = AI_PROVIDERS[provider]
    const remembered = rememberCurrentProviderConnection(draftAi)
    const rememberedKeys = remembered.apiKeys || {}
    const rememberedBaseUrls = remembered.baseUrls || {}
    const rememberedModels = remembered.models || {}
    const nextModel = rememberedModels[provider] ?? (config.models[0] || '')
    const next = {
      ...draftAi,
      ...remembered,
      provider,
      baseUrl: rememberedBaseUrls[provider] ?? '',
      model: nextModel,
      apiKey: rememberedKeys[provider] ?? '',
    }
    setDraftAi(next)
    setIsCustomModel(
      provider !== 'custom' &&
        !!nextModel &&
        !config.models.some((model) => model === nextModel),
    )
    autoSave(pickConnectionFields(next))
    clearFeedback()
  }

  const handleApiKeyChange = (value: string) => {
    setDraftAi((current) => {
      const next = {
        ...current,
        apiKey: value,
        apiKeys: { ...(current.apiKeys || {}), [current.provider]: value },
      }
      autoSave({ apiKey: value, apiKeys: next.apiKeys })
      return next
    })
    clearFeedback()
  }

  const handleBaseUrlChange = (value: string) => {
    setDraftAi((current) => {
      const next = {
        ...current,
        baseUrl: value,
        baseUrls: { ...(current.baseUrls || {}), [current.provider]: value },
      }
      autoSave({ baseUrl: value, baseUrls: next.baseUrls })
      return next
    })
    clearFeedback()
  }

  const handleModelChange = (value: string) => {
    setDraftAi((current) => {
      const next = {
        ...current,
        model: value,
        models: { ...(current.models || {}), [current.provider]: value },
      }
      autoSave({ model: value, models: next.models })
      return next
    })
    clearFeedback()
  }

  // ── Prompt field handlers (mark dirty, no auto-save) ──

  const updatePromptDraft = (updates: Partial<AIConfig>) => {
    setDraftAi((current) => ({ ...current, ...updates }))
    clearFeedback()
  }

  // ── Actions ──

  const handleReset = () => {
    setDraftAi((current) => {
      const next = {
        ...current,
        ...pickPromptFields(DEFAULT_SETTINGS.ai),
      }
      return next
    })
    clearFeedback()
    setActionMessage(t('settings.aiResetDraftDone'))
  }

  const handleCancelDraft = () => {
    setDraftAi((current) => ({
      ...current,
      ...pickPromptFields(ai),
    }))
    clearFeedback()
    setActionMessage(t('settings.aiDraftDiscarded'))
  }

  const handleSaveDraft = async () => {
    if (draftValidationMessage) {
      setActionMessage(draftValidationMessage)
      return
    }

    setIsSaving(true)
    try {
      await updateSettingsSection('ai', pickPromptFields(draftAi))
      setTestResult(null)
      setActionMessage(t('settings.aiDraftSaved'))
    } catch (err) {
      setActionMessage(`${t('settings.aiDraftSaveFailed')}: ${String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.ai.testConnection()
      if (result.success) {
        setTestResult({ success: true, message: result.message })
      } else {
        setTestResult({ success: false, message: result.message })
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: String(err) || t('settings.testFailed'),
      })
    }
    setIsTesting(false)
  }

  const handleAgentRunTimeoutChange = (value: string) => {
    const seconds = Number(value)
    void updateSettingsSection('agent', {
      runTimeoutSeconds: Number.isFinite(seconds)
        ? seconds
        : DEFAULT_SETTINGS.agent.runTimeoutSeconds,
    })
  }

  const handleAgentMaxRoundsChange = (value: string) => {
    const maxRounds = Number(value)
    void updateSettingsSection('agent', {
      maxRounds: Number.isFinite(maxRounds)
        ? maxRounds
        : DEFAULT_SETTINGS.agent.maxRounds,
    })
  }

  const handleAgentTemperatureChange = (value: string) => {
    const temperature = Number(value)
    void updateSettingsSection('ai', {
      agentTemperature: Number.isFinite(temperature)
        ? temperature
        : DEFAULT_AGENT_TEMPERATURE,
    })
  }

  const handleAgentMaxTokensChange = (value: string) => {
    const maxTokens = Number(value)
    void updateSettingsSection('ai', {
      agentMaxTokens: Number.isFinite(maxTokens)
        ? maxTokens
        : DEFAULT_AGENT_MAX_TOKENS,
    })
  }

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50'

  return (
    <div className="space-y-5">
      {/* Notice */}
      <div className="border-accent/20 bg-accent/5 rounded-lg border p-3 text-sm">
        <p className="text-accent mb-1 font-medium">{t('settings.aiNotice')}</p>
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t('settings.aiNoticeDesc')}
        </p>
      </div>

      {/* Model configuration (auto-saved) */}
      <SectionCard
        icon={Cpu}
        title={t('settings.aiModelConfig')}
        description={t('settings.aiModelConfigDesc')}
      >
        {/* Provider selection */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            {t('settings.aiProvider')}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(AI_PROVIDERS) as AIProvider[]).map((key) => (
              <button
                key={key}
                onClick={() => handleProviderChange(key)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  draftAi.provider === key
                    ? 'border-accent bg-accent/5 text-accent font-medium'
                    : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                }`}
              >
                {AI_PROVIDERS[key].name}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.apiKey')}
            {isCustomProvider ? ' *' : ''}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={draftAi.apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={t('settings.apiKeyPlaceholder', {
                provider: providerConfig.name,
              })}
              required={isCustomProvider}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="text-text-tertiary absolute right-3 top-1/2 -translate-y-1/2"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-text-tertiary mt-1 text-xs">
            {t('settings.apiKeyPerProviderHint')}
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {isCustomProvider
              ? t('settings.baseUrl').replace(/\s*\([^)]*\)/g, '')
              : t('settings.baseUrl')}
            {isCustomProvider ? ' *' : ''}
          </label>
          <input
            type="text"
            value={draftAi.baseUrl || ''}
            onChange={(e) => handleBaseUrlChange(e.target.value)}
            placeholder={
              providerConfig.defaultBaseUrl || t('settings.baseUrlPlaceholder')
            }
            required={isCustomProvider}
            className={inputClass}
          />
          <p className="text-text-tertiary mt-1 text-xs">{baseUrlHint}</p>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.model')}
            {isCustomProvider ? ' *' : ''}
          </label>
          {isCustomProvider || isCustomModel ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draftAi.model}
                onChange={(e) => handleModelChange(e.target.value)}
                placeholder={t('settings.modelPlaceholder')}
                required={isCustomProvider}
                className={`${inputClass} flex-1`}
              />
              {!isCustomProvider && (
                <button
                  type="button"
                  onClick={() => setIsCustomModel(false)}
                  className="text-accent hover:text-accent-hover flex-shrink-0 text-xs transition-colors"
                >
                  {t('settings.aiChoosePreset', { defaultValue: '选择预设' })}
                </button>
              )}
            </div>
          ) : (
            <select
              value={draftAi.model}
              onChange={(e) => {
                const val = e.target.value
                if (val === '__custom__') {
                  setIsCustomModel(true)
                  handleModelChange('')
                } else {
                  handleModelChange(val)
                }
              }}
              className={inputClass}
            >
              {providerConfig.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="__custom__">
                {t('settings.aiCustomModel', { defaultValue: '自定义…' })}
              </option>
            </select>
          )}
        </div>
      </SectionCard>

      {/* Connection test */}
      <SectionCard icon={Wifi} title={t('settings.aiConnectionTest')}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={disableTestConnection}
            className="bg-accent hover:bg-accent-hover rounded-lg px-4 py-2 text-sm text-white transition-colors disabled:opacity-50"
          >
            {isTesting ? t('settings.testing') : t('settings.testConnection')}
          </button>
          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              {testResult.message}
            </div>
          )}
        </div>
      </SectionCard>

      {/* System prompt (manual save) */}
      <SectionCard
        icon={MessageSquareText}
        title={t('settings.aiSystemPromptSection')}
      >
        {/* Enable system prompt */}
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-4">
            <label className="text-sm font-medium">
              {t('settings.enableSystemPrompt', {
                defaultValue: '启用系统提示词',
              })}
            </label>
            <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
              {t('settings.enableSystemPromptDesc', {
                defaultValue:
                  '开启后会向模型注入系统身份与上下文提示；关闭则直接调用原模型。',
              })}
            </p>
          </div>
          <button
            onClick={() =>
              updatePromptDraft({
                enableSystemPrompt: !draftAi.enableSystemPrompt,
              })
            }
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              draftAi.enableSystemPrompt
                ? 'bg-accent'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                draftAi.enableSystemPrompt ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>

        {/* System prompt template */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.systemPromptTemplate', {
              defaultValue: '系统提示词模板',
            })}
          </label>
          <textarea
            value={draftAi.systemPromptTemplate || ''}
            onChange={(e) =>
              updatePromptDraft({
                systemPromptTemplate: e.target.value,
              })
            }
            placeholder={t('settings.systemPromptTemplatePlaceholder', {
              defaultValue: '可使用 {{context}} 和 {{persona}} 两个占位符',
            })}
            rows={7}
            disabled={!draftAi.enableSystemPrompt}
            className={`${inputClass} resize-y disabled:opacity-60`}
          />
          <p className="text-text-tertiary mt-1 text-xs">
            {t('settings.systemPromptTemplateDesc', {
              defaultValue:
                '用于 AI 对话的 system prompt 模板。{{context}} 会替换为当前文章上下文，{{persona}} 会替换为「AI 个性化 Prompt」。',
            })}
          </p>
        </div>

        {/* Chat persona prompt */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.aiPersonaPrompt', {
              defaultValue: 'AI 个性化 Prompt',
            })}
          </label>
          <textarea
            value={draftAi.chatPersonaPrompt || ''}
            onChange={(e) =>
              updatePromptDraft({
                chatPersonaPrompt: e.target.value,
              })
            }
            placeholder={t('settings.aiPersonaPromptPlaceholder', {
              defaultValue:
                '例如：请用简洁、专业、带步骤的方式回答；优先给结论再给解释。',
            })}
            rows={5}
            disabled={!draftAi.enableSystemPrompt}
            className={`${inputClass} resize-y disabled:opacity-60`}
          />
          <p className="text-text-tertiary mt-1 text-xs">
            {t('settings.aiPersonaPromptDesc', {
              defaultValue:
                '用于 AI 对话的预设系统提示词。保存后每次对话都会自动附加。',
            })}
          </p>
        </div>
      </SectionCard>

      {/* Task prompts: summary & translation (manual save) */}
      <SectionCard
        icon={FileText}
        title={t('settings.aiTaskPromptSection', {
          defaultValue: 'AI 任务提示词',
        })}
        description={t('settings.aiTaskPromptSectionDesc', {
          defaultValue: '自定义摘要与翻译的提示词；留空则使用内置默认模板。',
        })}
      >
        {/* Summary prompt */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.aiSummaryPrompt', { defaultValue: '摘要提示词' })}
          </label>
          <textarea
            value={draftAi.summaryPrompt || ''}
            onChange={(e) =>
              updatePromptDraft({
                summaryPrompt: e.target.value,
              })
            }
            placeholder={t('settings.aiSummaryPromptPlaceholder', {
              defaultValue:
                '留空使用默认。可使用 {{lang}} 占位符表示目标语言。',
            })}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>

        {/* Translation prompt */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.aiTranslationPrompt', { defaultValue: '翻译提示词' })}
          </label>
          <textarea
            value={draftAi.translationPrompt || ''}
            onChange={(e) =>
              updatePromptDraft({
                translationPrompt: e.target.value,
              })
            }
            placeholder={t('settings.aiTranslationPromptPlaceholder', {
              defaultValue:
                '留空使用默认。可使用 {{targetLanguage}} 占位符表示目标语言。',
            })}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        </div>
      </SectionCard>

      {/* 底部操作：仅针对提示词的保存 / 取消 / 重置 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-text-tertiary text-xs">
          {isPromptDirty
            ? t('settings.aiDraftUnsavedHint')
            : t('settings.aiDraftSavedHint')}
        </p>
        <div className="flex items-center gap-3">
          {(draftValidationMessage || actionMessage) && (
            <span
              className={`text-xs ${
                draftValidationMessage
                  ? 'text-red-500'
                  : 'text-text-secondary dark:text-text-dark-secondary'
              }`}
            >
              {draftValidationMessage || actionMessage}
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <RotateCcw size={14} />
            {t('settings.aiResetDefaults')}
          </button>
          <button
            onClick={handleCancelDraft}
            disabled={!isPromptDirty || isSaving}
            className="border-border hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={disableSave}
            className="bg-accent hover:bg-accent-hover rounded-lg px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {isSaving ? t('settings.aiSaving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Agent runtime */}
      <SectionCard
        icon={Timer}
        title={t('settings.agentRuntime')}
        description={t('settings.agentRuntimeDesc')}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.agentRunTimeout')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={MAX_AGENT_RUN_TIMEOUT_SECONDS}
                step={1}
                value={agent.runTimeoutSeconds}
                onChange={(e) => handleAgentRunTimeoutChange(e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <span className="text-text-secondary dark:text-text-dark-secondary text-sm">
                {t('settings.agentRunTimeoutUnit')}
              </span>
            </div>
            <p className="text-text-tertiary mt-1 text-xs">
              {t('settings.agentRunTimeoutDesc')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.agentMaxRounds')}
            </label>
            <input
              type="number"
              min={1}
              max={MAX_AGENT_MAX_ROUNDS}
              step={1}
              value={agent.maxRounds ?? DEFAULT_AGENT_MAX_ROUNDS}
              onChange={(e) => handleAgentMaxRoundsChange(e.target.value)}
              className={inputClass}
            />
            <p className="text-text-tertiary mt-1 text-xs">
              {t('settings.agentMaxRoundsDesc')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.agentTemperature')}
            </label>
            <input
              type="number"
              min={0}
              max={MAX_AGENT_TEMPERATURE}
              step={0.1}
              value={ai.agentTemperature ?? DEFAULT_AGENT_TEMPERATURE}
              onChange={(e) => handleAgentTemperatureChange(e.target.value)}
              className={inputClass}
            />
            <p className="text-text-tertiary mt-1 text-xs">
              {t('settings.agentTemperatureDesc')}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.agentMaxTokens')}
            </label>
            <input
              type="number"
              min={1}
              max={MAX_AGENT_MAX_TOKENS}
              step={256}
              value={ai.agentMaxTokens ?? DEFAULT_AGENT_MAX_TOKENS}
              onChange={(e) => handleAgentMaxTokensChange(e.target.value)}
              className={inputClass}
            />
            <p className="text-text-tertiary mt-1 text-xs">
              {t('settings.agentMaxTokensDesc')}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* --- Agent permissions --- */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" />
          <h4 className="text-sm font-medium">
            {t('settings.agentPermissions')}
          </h4>
        </div>
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t('settings.agentPermissionsDesc')}
        </p>
      </section>

      <div className="divide-border border-border bg-surface dark:bg-surface-dark-secondary divide-y overflow-hidden rounded-xl border">
        {[
          {
            key: 'allowRead' as const,
            icon: FileText,
            title: t('settings.agentPermAllowRead'),
            subtitle: t('settings.agentPermAllowReadDesc'),
          },
          {
            key: 'allowNavigate' as const,
            icon: ChevronRight,
            title: t('settings.agentPermAllowNavigate'),
            subtitle: t('settings.agentPermAllowNavigateDesc'),
          },
          {
            key: 'allowMutate' as const,
            icon: SettingsIcon,
            title: t('settings.agentPermAllowMutate'),
            subtitle: t('settings.agentPermAllowMutateDesc'),
          },
          {
            key: 'allowExternal' as const,
            icon: Link2,
            title: t('settings.agentPermAllowExternal'),
            subtitle: t('settings.agentPermAllowExternalDesc'),
          },
          {
            key: 'allowDestructive' as const,
            icon: Trash2,
            title: t('settings.agentPermAllowDestructive'),
            subtitle: t('settings.agentPermAllowDestructiveDesc'),
          },
        ].map((row) => (
          <div key={row.key} className="flex items-center gap-3 px-4 py-3.5">
            <row.icon size={18} className="text-accent flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-text-primary dark:text-text-dark-primary text-sm font-medium">
                {row.title}
              </p>
              <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
                {row.subtitle}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={permissions[row.key]}
              onClick={() =>
                updateSettingsSection('agentPermissions', {
                  [row.key]: !permissions[row.key],
                })
              }
              className={`inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
                permissions[row.key]
                  ? 'bg-accent'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  permissions[row.key] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="dark:text-text-dark-tertiary text-text-tertiary text-xs">
        {t('settings.agentPermissionsConfirmHint')}
      </p>
    </div>
  )
}
