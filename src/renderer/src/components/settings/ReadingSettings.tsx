import { useSettingSection, useSettingsActions } from "../../store/settings-store"
import { useTranslation } from "react-i18next"

export function ReadingSettings() {
  const general = useSettingSection("general")
  const { updateSettingsSection } = useSettingsActions()
  const { t } = useTranslation()

  const contentWidthOptions = [
    { key: "narrow" as const, label: t("settings.contentWidth_narrow"), desc: t("settings.contentWidthDesc_narrow"), px: 500 },
    { key: "normal" as const, label: t("settings.contentWidth_normal"), desc: t("settings.contentWidthDesc_normal"), px: 680 },
    { key: "wide" as const, label: t("settings.contentWidth_wide"), desc: t("settings.contentWidthDesc_wide"), px: 900 },
    { key: "custom" as const, label: t("settings.contentWidth_custom"), desc: t("settings.contentWidthDesc_custom") },
  ]

  const fontFamilyOptions = [
    { value: "inherit", label: t("settings.fontFamily_system") },
    { value: "\"Noto Sans SC\", sans-serif", label: t("settings.fontFamily_notoSans") },
    { value: "\"Noto Serif SC\", serif", label: t("settings.fontFamily_notoSerif") },
    { value: "\"Microsoft YaHei\", sans-serif", label: t("settings.fontFamily_msYahei") },
    { value: "\"SimSun\", serif", label: t("settings.fontFamily_simsun") },
    { value: "Georgia, serif", label: "Georgia" },
    { value: "\"Segoe UI\", sans-serif", label: "Segoe UI" },
  ]

  // Preview text for font demo
  const previewText = "Livo — The quick brown fox jumps over the lazy dog. 1234567890"

  return (
    <div className="space-y-6">
      {/* Content Width */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("settings.contentWidth")}
        </label>
        <div className="flex gap-2 flex-wrap">
          {contentWidthOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => {
                void updateSettingsSection("general", { contentWidth: option.key })
              }}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                general.contentWidth === option.key
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              }`}
              title={option.desc}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1.5">
          {t("settings.contentWidthDesc")}
        </p>
      </div>

      {/* Custom Content Max Width Slider (shown when "custom" is selected) */}
      {general.contentWidth === "custom" && (
        <div>
          <label className="block text-sm font-medium mb-1.5">
            {t("settings.contentMaxWidth")}: {general.contentMaxWidth || 680}px
          </label>
          <input
            type="range"
            min={400}
            max={1400}
            step={10}
            value={general.contentMaxWidth || 680}
            onChange={(e) =>
              void updateSettingsSection("general", { contentMaxWidth: Number(e.target.value) })
            }
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-tertiary mt-1">
            <span>400px ({t("settings.contentMaxWidth_narrow")})</span>
            <span>1400px ({t("settings.contentMaxWidth_wide")})</span>
          </div>
          {/* Live preview bar */}
          <div className="mt-3 relative h-4 bg-surface-secondary dark:bg-surface-dark-tertiary rounded overflow-hidden">
            <div
              className="h-full bg-accent/30 rounded transition-all duration-200"
              style={{ width: `${((general.contentMaxWidth || 680) / 1400) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Content Line Height */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.contentLineHeight")}: {general.contentLineHeight}
        </label>
        <input
          type="range"
          min={1.0}
          max={2.5}
          step={0.05}
          value={general.contentLineHeight}
          onChange={(e) =>
            void updateSettingsSection("general", { contentLineHeight: Number(e.target.value) })
          }
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-text-tertiary mt-1">
          <span>1.0 ({t("settings.lineHeight_compact")})</span>
          <span>2.5 ({t("settings.lineHeight_loose")})</span>
        </div>
        {/* Live preview */}
        <div
          className="mt-3 p-3 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary text-sm"
          style={{ lineHeight: general.contentLineHeight }}
        >
          Livo is an elegant RSS reader with multiple view modes. The quick brown fox jumps over the lazy dog. 1234567890
        </div>
      </div>

      {/* UI Font Family */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.uiFontFamily")}
        </label>
        <select
          value={general.uiFontFamily}
          onChange={(e) =>
            void updateSettingsSection("general", { uiFontFamily: e.target.value })
          }
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {fontFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1.5">
          {t("settings.uiFontFamilyDesc")}
        </p>
      </div>

      {/* Content Font Family */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.contentFontFamily")}
        </label>
        <select
          value={general.contentFontFamily}
          onChange={(e) =>
            void updateSettingsSection("general", { contentFontFamily: e.target.value })
          }
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          style={{ fontFamily: general.contentFontFamily }}
        >
          {fontFamilyOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Font preview */}
        <div
          className="mt-2 p-3 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary text-sm"
          style={{
            fontFamily: general.contentFontFamily,
            fontSize: `${general.fontSize}px`,
            lineHeight: general.contentLineHeight,
          }}
        >
          {previewText}
        </div>
      </div>
    </div>
  )
}
