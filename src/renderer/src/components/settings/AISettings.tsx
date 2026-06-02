import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import {
  AI_PROVIDERS,
  DEFAULT_SETTINGS,
  type AIConfig,
  type AIProvider,
} from '../../../../shared/types'
import { useEffect, useState } from 'react'
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

export function AISettings() {
  const ai = useSettingSection('ai')
  const { updateSettingsSection, setActiveTab } = useSettingsActions()
  const { t } = useTranslation()
  const [draftAi, setDraftAi] = useState<AIConfig>(ai)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isDirty) setDraftAi(ai)
  }, [ai, isDirty])

  const providerConfig = AI_PROVIDERS[draftAi.provider]
  const isCustomProvider = draftAi.provider === 'custom'
  const isApiKeyMissing =
    draftAi.provider !== 'ollama' && !draftAi.apiKey.trim()
  const isBaseUrlMissing = isCustomProvider && !(draftAi.baseUrl || '').trim()
  const isModelMissing = isCustomProvider && !draftAi.model.trim()
  const draftValidationMessage = isBaseUrlMissing
    ? t('settings.aiValidationBaseUrlRequired')
    : isModelMissing
      ? t('settings.aiValidationModelRequired')
      : null
  const disableTestConnection =
    isTesting ||
    isDirty ||
    isApiKeyMissing ||
    isBaseUrlMissing ||
    isModelMissing
  const disableSave = isSaving || !isDirty || !!draftValidationMessage

  const markDraftChanged = () => {
    setIsDirty(true)
    setTestResult(null)
    setActionMessage(null)
  }

  const updateDraftAi = (updates: Partial<AIConfig>) => {
    setDraftAi((current) => ({ ...current, ...updates }))
    markDraftChanged()
  }

  const handleProviderChange = (provider: AIProvider) => {
    const config = AI_PROVIDERS[provider]
    setDraftAi((current) => {
      const rememberedKeys = {
        ...(current.apiKeys || {}),
        [current.provider]: current.apiKey,
      }
      const nextKey =
        provider === 'ollama' ? 'ollama' : (rememberedKeys[provider] ?? '')
      return {
        ...current,
        provider,
        baseUrl: '',
        model: config.models[0] || '',
        apiKey: nextKey,
        apiKeys: rememberedKeys,
      }
    })
    markDraftChanged()
  }

  const handleApiKeyChange = (value: string) => {
    setDraftAi((current) => {
      return {
        ...current,
        apiKey: value,
        apiKeys: { ...(current.apiKeys || {}), [current.provider]: value },
      }
    })
    markDraftChanged()
  }

  const handleReset = () => {
    setDraftAi({
      ...DEFAULT_SETTINGS.ai,
      apiKeys: {},
    })
    setIsDirty(true)
    setTestResult(null)
    setActionMessage(t('settings.aiResetDraftDone'))
  }

  const handleCancelDraft = () => {
    setDraftAi(ai)
    setIsDirty(false)
    setTestResult(null)
    setActionMessage(t('settings.aiDraftDiscarded'))
  }

  const handleSaveDraft = async () => {
    if (draftValidationMessage) {
      setActionMessage(draftValidationMessage)
      return
    }

    setIsSaving(true)
    try {
      await updateSettingsSection('ai', draftAi)
      setIsDirty(false)
      setTestResult(null)
      setActionMessage(t('settings.aiDraftSaved'))
    } catch (err) {
      setActionMessage(`${t('settings.aiDraftSaveFailed')}: ${String(err)}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (isDirty) {
      setActionMessage(t('settings.aiTestSaveFirst'))
      return
    }
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

      {/* Model configuration */}
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
        {draftAi.provider !== 'ollama' && (
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
        )}

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
            onChange={(e) => updateDraftAi({ baseUrl: e.target.value })}
            placeholder={
              providerConfig.defaultBaseUrl || t('settings.baseUrlPlaceholder')
            }
            required={isCustomProvider}
            className={inputClass}
          />
          <p className="text-text-tertiary mt-1 text-xs">
            {t('settings.baseUrlHint')}
            {providerConfig.defaultBaseUrl || 'N/A'}
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {t('settings.model')}
            {isCustomProvider ? ' *' : ''}
          </label>
          {providerConfig.models.length > 0 ? (
            <select
              value={draftAi.model}
              onChange={(e) => updateDraftAi({ model: e.target.value })}
              required={isCustomProvider}
              className={inputClass}
            >
              {providerConfig.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={draftAi.model}
              onChange={(e) => updateDraftAi({ model: e.target.value })}
              placeholder={t('settings.modelPlaceholder')}
              required={isCustomProvider}
              className={inputClass}
            />
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
          {isDirty && (
            <span className="text-text-tertiary text-xs">
              {t('settings.aiTestSaveFirst')}
            </span>
          )}
        </div>
      </SectionCard>

      {/* System prompt */}
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
              updateDraftAi({
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
              updateDraftAi({
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
              updateDraftAi({
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

      {/* Task prompts: summary & translation */}
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
              updateDraftAi({
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
              updateDraftAi({
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

      {/* Agent permissions cross-link */}
      <button
        onClick={() => setActiveTab('agentPermissions')}
        className="border-border bg-surface hover:bg-surface-secondary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors"
      >
        <ShieldCheck size={16} className="text-accent flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {t('settings.agentPermissions')}
          </p>
          <p className="text-text-secondary dark:text-text-dark-secondary mt-0.5 text-xs">
            {t('settings.aiAgentPermissionsLinkDesc')}
          </p>
        </div>
        <ChevronRight size={16} className="text-text-tertiary flex-shrink-0" />
      </button>

      {/* 底部操作：重置、取消与保存 */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-text-tertiary text-xs">
          {isDirty
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
            disabled={!isDirty || isSaving}
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
    </div>
  )
}
