import {
  useSettingSection,
  useSettingsActions,
} from '../../store/settings-store'
import { useTranslation } from 'react-i18next'
import {
  AI_PROVIDERS,
  DEFAULT_SETTINGS,
  type AIProvider,
} from '../../../../shared/types'
import { useState } from 'react'
import {
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Cpu,
  MessageSquareText,
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
    <section className="rounded-xl border border-border bg-surface p-4 dark:bg-surface-dark-secondary">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className="text-accent" />
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      {description && (
        <p className="mb-3 text-xs text-text-secondary dark:text-text-dark-secondary">
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
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const providerConfig = AI_PROVIDERS[ai.provider]
  const isCustomProvider = ai.provider === 'custom'
  const isApiKeyMissing = ai.provider !== 'ollama' && !ai.apiKey.trim()
  const isBaseUrlMissing = isCustomProvider && !(ai.baseUrl || '').trim()
  const isModelMissing = isCustomProvider && !ai.model.trim()
  const disableTestConnection =
    isTesting || isApiKeyMissing || isBaseUrlMissing || isModelMissing

  const handleProviderChange = (provider: AIProvider) => {
    const config = AI_PROVIDERS[provider]
    // Remember the current provider's key, then restore the target provider's
    // previously entered key (or empty for a fresh provider).
    const rememberedKeys = { ...(ai.apiKeys || {}), [ai.provider]: ai.apiKey }
    const nextKey =
      provider === 'ollama' ? 'ollama' : (rememberedKeys[provider] ?? '')
    void updateSettingsSection('ai', {
      provider,
      baseUrl: '',
      model: config.models[0] || '',
      apiKey: nextKey,
      apiKeys: rememberedKeys,
    })
    setTestResult(null)
    setActionMessage(null)
  }

  const handleApiKeyChange = (value: string) => {
    void updateSettingsSection('ai', {
      apiKey: value,
      apiKeys: { ...(ai.apiKeys || {}), [ai.provider]: value },
    })
  }

  const handleReset = () => {
    void updateSettingsSection('ai', {
      ...DEFAULT_SETTINGS.ai,
      apiKeys: {},
    })
    setTestResult(null)
    setActionMessage(t('settings.aiResetDone'))
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

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50'

  return (
    <div className="space-y-5">
      {/* Notice */}
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm">
        <p className="mb-1 font-medium text-accent">{t('settings.aiNotice')}</p>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary">
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
                  ai.provider === key
                    ? 'border-accent bg-accent/5 font-medium text-accent'
                    : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary'
                }`}
              >
                {AI_PROVIDERS[key].name}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        {ai.provider !== 'ollama' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {t('settings.apiKey')}
              {isCustomProvider ? ' *' : ''}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={ai.apiKey}
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
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
            value={ai.baseUrl || ''}
            onChange={(e) =>
              void updateSettingsSection('ai', { baseUrl: e.target.value })
            }
            placeholder={
              providerConfig.defaultBaseUrl || t('settings.baseUrlPlaceholder')
            }
            required={isCustomProvider}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-text-tertiary">
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
              value={ai.model}
              onChange={(e) =>
                void updateSettingsSection('ai', { model: e.target.value })
              }
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
              value={ai.model}
              onChange={(e) =>
                void updateSettingsSection('ai', { model: e.target.value })
              }
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
            className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
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
            <p className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
              {t('settings.enableSystemPromptDesc', {
                defaultValue:
                  '开启后会向模型注入系统身份与上下文提示；关闭则直接调用原模型。',
              })}
            </p>
          </div>
          <button
            onClick={() =>
              void updateSettingsSection('ai', {
                enableSystemPrompt: !ai.enableSystemPrompt,
              })
            }
            className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              ai.enableSystemPrompt
                ? 'bg-accent'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                ai.enableSystemPrompt ? 'translate-x-5' : ''
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
            value={ai.systemPromptTemplate || ''}
            onChange={(e) =>
              void updateSettingsSection('ai', {
                systemPromptTemplate: e.target.value,
              })
            }
            placeholder={t('settings.systemPromptTemplatePlaceholder', {
              defaultValue: '可使用 {{context}} 和 {{persona}} 两个占位符',
            })}
            rows={7}
            disabled={!ai.enableSystemPrompt}
            className={`${inputClass} resize-y disabled:opacity-60`}
          />
          <p className="mt-1 text-xs text-text-tertiary">
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
            value={ai.chatPersonaPrompt || ''}
            onChange={(e) =>
              void updateSettingsSection('ai', {
                chatPersonaPrompt: e.target.value,
              })
            }
            placeholder={t('settings.aiPersonaPromptPlaceholder', {
              defaultValue:
                '例如：请用简洁、专业、带步骤的方式回答；优先给结论再给解释。',
            })}
            rows={5}
            disabled={!ai.enableSystemPrompt}
            className={`${inputClass} resize-y disabled:opacity-60`}
          />
          <p className="mt-1 text-xs text-text-tertiary">
            {t('settings.aiPersonaPromptDesc', {
              defaultValue:
                '用于 AI 对话的预设系统提示词。保存后每次对话都会自动附加。',
            })}
          </p>
        </div>
      </SectionCard>

      {/* Agent permissions cross-link */}
      <button
        onClick={() => setActiveTab('agentPermissions')}
        className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-secondary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary"
      >
        <ShieldCheck size={16} className="flex-shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            {t('settings.agentPermissions')}
          </p>
          <p className="mt-0.5 text-xs text-text-secondary dark:text-text-dark-secondary">
            {t('settings.aiAgentPermissionsLinkDesc')}
          </p>
        </div>
        <ChevronRight size={16} className="flex-shrink-0 text-text-tertiary" />
      </button>

      {/* Footer: reset + auto-save hint */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-text-tertiary">
          {t('settings.aiAutoSaveHint')}
        </p>
        <div className="flex items-center gap-3">
          {actionMessage && (
            <span className="text-xs text-text-secondary dark:text-text-dark-secondary">
              {actionMessage}
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          >
            <RotateCcw size={14} />
            {t('settings.aiResetDefaults')}
          </button>
        </div>
      </div>
    </div>
  )
}
