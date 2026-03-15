import { useSettingsStore } from "../../store/settings-store"
import { useTranslation } from "react-i18next"
import { AI_PROVIDERS, type AIProvider } from "../../../../shared/types"
import { useState } from "react"
import { Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react"

export function AISettings() {
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useTranslation()
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const ai = settings.ai
  const providerConfig = AI_PROVIDERS[ai.provider]

  const handleProviderChange = (provider: AIProvider) => {
    const config = AI_PROVIDERS[provider]
    updateSettings({
      ai: {
        ...ai,
        provider,
        baseUrl: "",
        model: config.models[0] || "",
        apiKey: provider === "ollama" ? "ollama" : ai.apiKey,
      },
    })
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await window.api.ai.chat([
        { role: "user", content: "Say 'OK' if you can hear me." },
      ])
      if (result.success) {
        setTestResult({ success: true, message: t("settings.testSuccess") })
      } else {
        setTestResult({ success: false, message: result.error || t("settings.testFailed") })
      }
    } catch (err) {
      setTestResult({ success: false, message: String(err) })
    }
    setIsTesting(false)
  }

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm">
        <p className="font-medium text-accent mb-1">{t("settings.aiNotice")}</p>
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t("settings.aiNoticeDesc")}
        </p>
      </div>

      {/* Provider selection */}
      <div>
        <label className="block text-sm font-medium mb-2">{t("settings.aiProvider")}</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(AI_PROVIDERS) as AIProvider[]).map((key) => (
            <button
              key={key}
              onClick={() => handleProviderChange(key)}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                ai.provider === key
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {AI_PROVIDERS[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      {ai.provider !== "ollama" && (
        <div>
          <label className="block text-sm font-medium mb-1.5">{t("settings.apiKey")}</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={ai.apiKey}
              onChange={(e) => updateSettings({ ai: { ...ai, apiKey: e.target.value } })}
              placeholder={t("settings.apiKeyPlaceholder", { provider: providerConfig.name })}
              className="w-full px-3 py-2.5 pr-10 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("settings.baseUrl")}</label>
        <input
          type="text"
          value={ai.baseUrl || ""}
          onChange={(e) => updateSettings({ ai: { ...ai, baseUrl: e.target.value } })}
          placeholder={providerConfig.defaultBaseUrl || t("settings.baseUrlPlaceholder")}
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <p className="text-xs text-text-tertiary mt-1">
          {t("settings.baseUrlHint")}{providerConfig.defaultBaseUrl || "N/A"}
        </p>
      </div>

      {/* Model */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("settings.model")}</label>
        {providerConfig.models.length > 0 ? (
          <select
            value={ai.model}
            onChange={(e) => updateSettings({ ai: { ...ai, model: e.target.value } })}
            className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
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
            onChange={(e) => updateSettings({ ai: { ...ai, model: e.target.value } })}
            placeholder={t("settings.modelPlaceholder")}
            className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        )}
      </div>

      {/* Enable system prompt */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{t("settings.enableSystemPrompt", { defaultValue: "启用系统提示词" })}</label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.enableSystemPromptDesc", { defaultValue: "开启后会向模型注入系统身份与上下文提示；关闭则直接调用原模型。" })}
          </p>
        </div>
        <button
          onClick={() => updateSettings({ ai: { ...ai, enableSystemPrompt: !ai.enableSystemPrompt } })}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            ai.enableSystemPrompt ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              ai.enableSystemPrompt ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Chat persona prompt */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("settings.systemPromptTemplate", { defaultValue: "系统提示词模板" })}</label>
        <textarea
          value={ai.systemPromptTemplate || ""}
          onChange={(e) => updateSettings({ ai: { ...ai, systemPromptTemplate: e.target.value } })}
          placeholder={t("settings.systemPromptTemplatePlaceholder", { defaultValue: "可使用 {{context}} 和 {{persona}} 两个占位符" })}
          rows={7}
          disabled={!ai.enableSystemPrompt}
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
        <p className="text-xs text-text-tertiary mt-1">
          {t("settings.systemPromptTemplateDesc", { defaultValue: "用于 AI 对话的 system prompt 模板。{{context}} 会替换为当前文章上下文，{{persona}} 会替换为「AI 个性化 Prompt」。" })}
        </p>
      </div>

      {/* Chat persona prompt */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("settings.aiPersonaPrompt", { defaultValue: "AI 个性化 Prompt" })}</label>
        <textarea
          value={ai.chatPersonaPrompt || ""}
          onChange={(e) => updateSettings({ ai: { ...ai, chatPersonaPrompt: e.target.value } })}
          placeholder={t("settings.aiPersonaPromptPlaceholder", { defaultValue: "例如：请用简洁、专业、带步骤的方式回答；优先给结论再给解释。" })}
          rows={5}
          disabled={!ai.enableSystemPrompt}
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-y"
        />
        <p className="text-xs text-text-tertiary mt-1">
          {t("settings.aiPersonaPromptDesc", { defaultValue: "用于 AI 对话的预设系统提示词。保存后每次对话都会自动附加。" })}
        </p>
      </div>

      {/* Test connection */}
      <div>
        <button
          onClick={handleTestConnection}
          disabled={isTesting || (!ai.apiKey && ai.provider !== "ollama")}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {isTesting ? t("settings.testing") : t("settings.testConnection")}
        </button>
        {testResult && (
          <div
            className={`mt-2 flex items-center gap-2 text-sm ${
              testResult.success ? "text-green-600" : "text-red-500"
            }`}
          >
            {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  )
}
