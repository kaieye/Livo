import { useSettingsStore } from "../../store/settings-store"
import { useTranslation } from "react-i18next"

export function TranslationSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useTranslation()
  const translation = settings.translation

  return (
    <div className="space-y-6">
      {/* Notice */}
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-sm">
        <p className="text-text-secondary dark:text-text-dark-secondary text-xs">
          {t("settings.translationNotice")}
        </p>
      </div>

      {/* Enable translation */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{t("settings.enableTranslation")}</label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.enableTranslationDesc")}
          </p>
        </div>
        <button
          onClick={() =>
            updateSettings({
              translation: { ...translation, enabled: !translation.enabled },
            })
          }
          className={`relative w-11 h-6 rounded-full transition-colors ${
            translation.enabled ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              translation.enabled ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {/* Target language */}
      <div>
        <label className="block text-sm font-medium mb-1.5">{t("settings.targetLanguage")}</label>
        <select
          value={translation.targetLanguage}
          onChange={(e) =>
            updateSettings({
              translation: { ...translation, targetLanguage: e.target.value },
            })
          }
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value="zh-CN">简体中文</option>
          <option value="zh-TW">繁體中文</option>
          <option value="en">English</option>
          <option value="ja">日本語</option>
          <option value="ko">한국어</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="es">Español</option>
          <option value="ru">Русский</option>
          <option value="ar">العربية</option>
        </select>
      </div>

      {/* Auto translate */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">{t("settings.autoTranslate")}</label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.autoTranslateDesc")}
          </p>
        </div>
        <button
          onClick={() =>
            updateSettings({
              translation: { ...translation, autoTranslate: !translation.autoTranslate },
            })
          }
          className={`relative w-11 h-6 rounded-full transition-colors ${
            translation.autoTranslate ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              translation.autoTranslate ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>
    </div>
  )
}
