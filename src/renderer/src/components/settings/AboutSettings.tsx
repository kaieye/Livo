import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Rss, Github, Heart } from "lucide-react"

export function AboutSettings() {
  const [version, setVersion] = useState("")
  const { t } = useTranslation()

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => setVersion("1.0.0"))
  }, [])

  return (
    <div className="space-y-6">
      {/* Logo and name */}
      <div className="text-center py-4">
        <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Rss size={36} className="text-accent" />
        </div>
        <h2 className="text-xl font-bold">Livo</h2>
        <p className="text-sm text-text-secondary dark:text-text-dark-secondary mt-1">
          {t("settings.version")} {version || "1.0.0"}
        </p>
      </div>

      {/* Description */}
      <div className="text-center text-sm text-text-secondary dark:text-text-dark-secondary space-y-2">
        <p>{t("settings.aboutDesc")}</p>
        <p>
          <strong>{t("settings.noLoginNeeded")}</strong> · <strong>{t("settings.noSubscriptionNeeded")}</strong> · <strong>{t("settings.aiFeaturesOpen")}</strong>
        </p>
        <p>{t("settings.aboutAIDesc")}</p>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          { label: t("settings.feature_rss"), desc: t("settings.feature_rssDesc") },
          { label: t("settings.feature_aiSummary"), desc: t("settings.feature_aiSummaryDesc") },
          { label: t("settings.feature_aiChat"), desc: t("settings.feature_aiChatDesc") },
          { label: t("settings.feature_localStorage"), desc: t("settings.feature_localStorageDesc") },
          { label: t("settings.feature_multiModel"), desc: t("settings.feature_multiModelDesc") },
          { label: t("settings.feature_darkMode"), desc: t("settings.feature_darkModeDesc") },
        ].map((feature) => (
          <div key={feature.label} className="p-3 rounded-lg bg-surface-secondary dark:bg-surface-dark-tertiary">
            <p className="font-medium">{feature.label}</p>
            <p className="text-xs text-text-tertiary mt-0.5">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="flex justify-center gap-4 pt-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <Github size={16} />
          GitHub
        </a>
        <span className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Heart size={16} className="text-red-400" />
          {t("settings.openSourceFree")}
        </span>
      </div>
    </div>
  )
}
