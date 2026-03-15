import { useSettingsStore } from "../../store/settings-store"
import { useTranslation } from "react-i18next"
import { changeLanguage } from "../../i18n"
import { Check, GripVertical, Eye, EyeOff, RotateCcw } from "lucide-react"
import { useState, useEffect, useCallback, useRef } from "react"
import { FeedViewType, VIEW_DEFINITIONS, DEFAULT_SETTINGS } from "../../../../shared/types"
import { VIEW_TYPE_I18N_KEYS } from "../../lib/view-type-keys"

const ACCENT_COLORS = [
  { name: "orange", color: "#FF8C00", labelKey: "settings.accentColor_orange" },
  { name: "red", color: "#EF4444", labelKey: "settings.accentColor_red" },
  { name: "rose", color: "#F43F5E", labelKey: "settings.accentColor_rose" },
  { name: "purple", color: "#A855F7", labelKey: "settings.accentColor_purple" },
  { name: "blue", color: "#3B82F6", labelKey: "settings.accentColor_blue" },
  { name: "teal", color: "#14B8A6", labelKey: "settings.accentColor_teal" },
  { name: "green", color: "#22C55E", labelKey: "settings.accentColor_green" },
  { name: "yellow", color: "#EAB308", labelKey: "settings.accentColor_yellow" },
]

export function GeneralSettings() {
  const { settings, updateSettings } = useSettingsStore()
  const general = settings.general
  const { t, i18n } = useTranslation()
  const [languageChanged, setLanguageChanged] = useState(false)

  const languageOptions = [
    { value: "zh-CN", label: "简体中文" },
    { value: "en", label: "English" },
    { value: "ja", label: "日本語" },
    { value: "zh-TW", label: "繁體中文" },
    { value: "ko", label: "한국어" },
  ]

  const handleLanguageChange = async (newLanguage: string) => {
    await updateSettings({ general: { ...general, language: newLanguage } })
    try {
      await changeLanguage(newLanguage)
      setLanguageChanged(true)
      setTimeout(() => setLanguageChanged(false), 2000)
    } catch (error) {
      console.error("Failed to change language:", error)
    }
  }

  // Apply accent color to CSS variable
  useEffect(() => {
    const accent = ACCENT_COLORS.find((c) => c.name === general.accentColor)
    if (accent) {
      document.documentElement.style.setProperty("--color-accent", accent.color)
      document.documentElement.style.setProperty("--color-accent-hover", accent.color + "dd")
    } else if (general.accentColor?.startsWith("#")) {
      document.documentElement.style.setProperty("--color-accent", general.accentColor)
      document.documentElement.style.setProperty("--color-accent-hover", general.accentColor + "dd")
    }
  }, [general.accentColor])

  // Apply custom CSS
  useEffect(() => {
    let styleEl = document.getElementById("livo-custom-css")
    if (!styleEl) {
      styleEl = document.createElement("style")
      styleEl.id = "livo-custom-css"
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = general.customCSS || ""
    return () => {
      // Don't remove on unmount — keep custom CSS active
    }
  }, [general.customCSS])

  // Apply reduce motion
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", !!general.reduceMotion)
  }, [general.reduceMotion])

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("settings.theme")}
        </label>
        <div className="flex gap-2">
          {(
            [
              { key: "system", label: t("settings.theme_system") },
              { key: "light", label: t("settings.theme_light") },
              { key: "dark", label: t("settings.theme_dark") },
            ] as const
          ).map((theme) => (
            <button
              key={theme.key}
              onClick={() => {
                updateSettings({ general: { ...general, theme: theme.key } })
                // Apply immediately
                if (theme.key === "dark") {
                  document.documentElement.classList.add("dark")
                } else if (theme.key === "light") {
                  document.documentElement.classList.remove("dark")
                } else {
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
                  document.documentElement.classList.toggle("dark", prefersDark)
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                general.theme === theme.key
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("settings.accentColor")}
        </label>
        <div className="flex gap-2 flex-wrap">
          {ACCENT_COLORS.map((ac) => (
            <button
              key={ac.name}
              onClick={() => updateSettings({ general: { ...general, accentColor: ac.name } })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                general.accentColor === ac.name ? "border-text scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-surface-dark" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: ac.color, borderColor: general.accentColor === ac.name ? ac.color : "transparent" }}
              title={t(ac.labelKey)}
            />
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.language")}
        </label>
        <select
          value={general.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {languageChanged && (
          <div className="flex items-center gap-1 text-xs text-green-500 mt-1.5">
            <Check size={14} />
            {t("settings.languageChanged")}
          </div>
        )}
      </div>

      {/* Font size */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.fontSize")}: {general.fontSize}px
        </label>
        <input
          type="range"
          min={12}
          max={24}
          value={general.fontSize}
          onChange={(e) =>
            updateSettings({ general: { ...general, fontSize: Number(e.target.value) } })
          }
          className="w-full accent-accent"
        />
        <div className="flex justify-between text-xs text-text-tertiary mt-1">
          <span>12px</span>
          <span>24px</span>
        </div>
      </div>

      {/* Refresh interval */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.refreshInterval")}
        </label>
        <select
          value={general.refreshInterval}
          onChange={(e) =>
            updateSettings({ general: { ...general, refreshInterval: Number(e.target.value) } })
          }
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        >
          <option value={0}>{t("settings.refresh_manual")}</option>
          <option value={15}>{t("settings.refresh_15min")}</option>
          <option value={30}>{t("settings.refresh_30min")}</option>
          <option value={60}>{t("settings.refresh_1hour")}</option>
          <option value={120}>{t("settings.refresh_2hours")}</option>
          <option value={360}>{t("settings.refresh_6hours")}</option>
        </select>
      </div>

      {/* Mark read on scroll */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.markReadOnScroll")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.markReadOnScrollDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.markReadOnScroll}
          onChange={(v) => updateSettings({ general: { ...general, markReadOnScroll: v } })}
        />
      </div>

      {/* Dim read entries */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.dimRead")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.dimReadDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.dimRead}
          onChange={(v) => updateSettings({ general: { ...general, dimRead: v } })}
        />
      </div>

      {/* Group by date */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.groupByDate")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.groupByDateDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.groupByDate}
          onChange={(v) => updateSettings({ general: { ...general, groupByDate: v } })}
        />
      </div>

      {/* Render mark as read */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.renderMarkAsRead")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.renderMarkAsReadDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.renderMarkAsRead}
          onChange={(v) => updateSettings({ general: { ...general, renderMarkAsRead: v } })}
        />
      </div>

      {/* Video pagination */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.videoPagination")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.videoPaginationDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.videoPagination}
          onChange={(v) => updateSettings({ general: { ...general, videoPagination: v } })}
        />
      </div>

      {/* Bilibili playback mode */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.bilibiliOpenInPage")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.bilibiliOpenInPageDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.bilibiliOpenInPage}
          onChange={(v) => updateSettings({ general: { ...general, bilibiliOpenInPage: v } })}
        />
      </div>

      {/* Image proxy */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.imageProxy")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.imageProxyDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.imageProxy}
          onChange={(v) => updateSettings({ general: { ...general, imageProxy: v } })}
        />
      </div>

      {/* Show Recommended Feeds */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.showRecommended")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.showRecommendedDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.showRecommended}
          onChange={(v) => updateSettings({ general: { ...general, showRecommended: v } })}
        />
      </div>

      {/* View Tabs Configuration */}
      <ViewTabsConfig />

      {/* Opaque sidebar */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.opaqueSidebar")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.opaqueSidebarDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.opaqueSidebar}
          onChange={(v) => updateSettings({ general: { ...general, opaqueSidebar: v } })}
        />
      </div>

      {/* Reduce motion */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.reduceMotion")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.reduceMotionDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.reduceMotion}
          onChange={(v) => updateSettings({ general: { ...general, reduceMotion: v } })}
        />
      </div>

      {/* Render inline style */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium">
            {t("settings.renderInlineStyle")}
          </label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.renderInlineStyleDesc")}
          </p>
        </div>
        <ToggleSwitch
          checked={general.renderInlineStyle}
          onChange={(v) => updateSettings({ general: { ...general, renderInlineStyle: v } })}
        />
      </div>

      {/* Thumbnail ratio */}
      <div>
        <label className="block text-sm font-medium mb-2">
          {t("settings.thumbnailRatio")}
        </label>
        <div className="flex gap-2">
          {([
            { key: "square" as const, label: t("settings.thumbnailRatio_square") },
            { key: "original" as const, label: t("settings.thumbnailRatio_original") },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => updateSettings({ general: { ...general, thumbnailRatio: opt.key } })}
              className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
                general.thumbnailRatio === opt.key
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* RSSHub Instance URL */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.rsshubInstance")}
        </label>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.rsshubInstanceDesc")}
        </p>
        <input
          type="url"
          value={general.rsshubInstance || "https://rsshub.pseudoyu.com"}
          onChange={(e) =>
            updateSettings({ general: { ...general, rsshubInstance: e.target.value.trim() } })
          }
          placeholder="https://rsshub.pseudoyu.com"
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
        />
        <div className="mt-1.5 text-xs text-text-tertiary">
          {t("settings.rsshubInstanceHint")}
        </div>
        <div className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          {t("settings.rsshubInstanceInstagramTip")}
        </div>
      </div>

      {/* Custom CSS */}
      <div>
        <label className="block text-sm font-medium mb-1.5">
          {t("settings.customCSS")}
        </label>
        <p className="text-xs text-text-secondary dark:text-text-dark-secondary mb-2">
          {t("settings.customCSSDesc")}
        </p>
        <textarea
          value={general.customCSS || ""}
          onChange={(e) => updateSettings({ general: { ...general, customCSS: e.target.value } })}
          placeholder={`${t("settings.customCSSPlaceholder")}\n.entry-content {\n  /* your styles */\n}`}
          className="w-full px-3 py-2.5 rounded-lg border bg-surface-secondary dark:bg-surface-dark-tertiary text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono resize-y"
          rows={5}
        />
      </div>
    </div>
  )
}

/** View Tabs Configuration — toggle visibility and drag to reorder */
function ViewTabsConfig() {
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useTranslation()
  const general = settings.general

  // Ensure viewTabs exist and append newly introduced views for old configs.
  const viewTabs = (() => {
    const fallback = DEFAULT_SETTINGS.general.viewTabs
    const source = Array.isArray(general.viewTabs) ? general.viewTabs : fallback
    const next = source
      .filter((tab) => typeof tab?.id === "number" && typeof tab?.visible === "boolean")
      .filter((tab) => !!VIEW_DEFINITIONS[tab.id])
      .map((tab) => ({ ...tab }))
    const ids = new Set(next.map((tab) => tab.id))
    for (const tab of fallback) {
      if (!ids.has(tab.id)) next.push({ ...tab })
    }
    return next.length > 0 ? next : fallback
  })()

  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const dragRef = useRef<number | null>(null)
  const [dragOverlay, setDragOverlay] = useState<{ label: string; x: number; y: number } | null>(null)

  const toggleVisible = useCallback((idx: number) => {
    const next = [...viewTabs]
    // Must keep at least one visible
    const visibleCount = next.filter((t) => t.visible).length
    if (next[idx].visible && visibleCount <= 1) return
    next[idx] = { ...next[idx], visible: !next[idx].visible }
    updateSettings({ general: { ...general, viewTabs: next } })
  }, [viewTabs, general, updateSettings])

  const handlePointerDragStart = useCallback((idx: number, label: string, e: React.PointerEvent) => {
    e.preventDefault()
    setDragIdx(idx)
    dragRef.current = idx
    setDragOverlay({ label, x: e.clientX, y: e.clientY })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      setDragOverlay((prev) => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)
      // Hit-test for reorder targets
      const overlayEl = document.getElementById("viewtab-drag-overlay")
      if (overlayEl) overlayEl.style.pointerEvents = "none"
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      if (overlayEl) overlayEl.style.pointerEvents = ""
      if (el) {
        const rowEl = (el as HTMLElement).closest("[data-viewtab-idx]")
        if (rowEl) {
          const targetIdx = parseInt(rowEl.getAttribute("data-viewtab-idx")!, 10)
          setOverIdx(targetIdx)
        }
      }
    }

    const onUp = () => {
      const from = dragRef.current
      setOverIdx((currentOverIdx) => {
        if (from !== null && currentOverIdx !== null && from !== currentOverIdx) {
          const next = [...viewTabs]
          const [moved] = next.splice(from, 1)
          next.splice(currentOverIdx, 0, moved)
          updateSettings({ general: { ...general, viewTabs: next } })
        }
        return null
      })
      setDragIdx(null)
      setDragOverlay(null)
      dragRef.current = null
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }, [viewTabs, general, updateSettings])

  const handleReset = useCallback(() => {
    updateSettings({ general: { ...general, viewTabs: DEFAULT_SETTINGS.general.viewTabs } })
  }, [general, updateSettings])

  const VIEW_COLOR_MAP: Record<number, string> = {
    [FeedViewType.Articles]: "text-lime-600",
    [FeedViewType.SocialMedia]: "text-sky-500",
    [FeedViewType.Videos]: "text-red-500",
    [FeedViewType.Pictures]: "text-pink-500",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <label className="text-sm font-medium">{t("settings.viewTabs")}</label>
          <p className="text-xs text-text-secondary dark:text-text-dark-secondary mt-0.5">
            {t("settings.viewTabsDesc")}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
          title={t("settings.viewTabsReset")}
        >
          <RotateCcw size={12} />
          {t("settings.viewTabsReset")}
        </button>
      </div>
      <div className="rounded-lg border overflow-hidden relative">
        {viewTabs.map((tab, idx) => {
          const def = VIEW_DEFINITIONS[tab.id]
          if (!def) return null
          const colorClass = VIEW_COLOR_MAP[tab.id] || "text-text-secondary"
          return (
            <div
              key={tab.id}
              data-viewtab-idx={idx}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                idx > 0 ? "border-t" : ""
              } ${dragIdx === idx ? "opacity-40" : ""} ${
                overIdx === idx && dragIdx !== idx
                  ? "bg-accent/10 ring-1 ring-inset ring-accent/30"
                  : "bg-white dark:bg-surface-dark-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
              }`}
            >
              {/* Drag handle */}
              <GripVertical
                size={14}
                className="text-text-tertiary dark:text-text-dark-tertiary cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
                onPointerDown={(e) => handlePointerDragStart(idx, t(VIEW_TYPE_I18N_KEYS[tab.id] || def.name), e)}
              />
              {/* Icon + name */}
              <span className={`flex-shrink-0 ${tab.visible ? colorClass : "text-text-tertiary"}`}>
                {def.icon === "FileText" && <FileTextIcon size={16} />}
                {def.icon === "MessageCircle" && <MessageCircleIcon size={16} />}
                {def.icon === "Play" && <PlayIcon size={16} />}
                {def.icon === "Image" && <ImageIcon size={16} />}
              </span>
              <span className={`flex-1 text-sm ${tab.visible ? "" : "text-text-tertiary line-through"}`}>
                {t(VIEW_TYPE_I18N_KEYS[tab.id] || def.name)}
              </span>
              {/* Visibility toggle */}
              <button
                onClick={() => toggleVisible(idx)}
                className={`p-1 rounded-md transition-colors ${
                  tab.visible
                    ? "text-accent hover:bg-accent/10"
                    : "text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary"
                }`}
                title={tab.visible ? "隐藏" : "显示"}
              >
                {tab.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
          )
        })}
        {/* Pointer-based drag overlay */}
        {dragOverlay && (
          <div
            id="viewtab-drag-overlay"
            style={{
              position: "fixed",
              left: dragOverlay.x + 12,
              top: dragOverlay.y - 14,
              zIndex: 9999,
              pointerEvents: "none",
            }}
            className="px-3 py-1.5 rounded-lg bg-accent/90 text-white text-xs font-medium shadow-lg whitespace-nowrap"
          >
            {dragOverlay.label}
          </div>
        )}
      </div>
    </div>
  )
}

// Simple icon components for view tab settings (avoid importing full lucide set again)
function FileTextIcon({ size = 16 }: { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
}
function MessageCircleIcon({ size = 16 }: { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
}
function PlayIcon({ size = 16 }: { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
}
function ImageIcon({ size = 16 }: { size?: number }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
}

/** Reusable Toggle Switch component */
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-accent" : "bg-gray-300 dark:bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  )
}
