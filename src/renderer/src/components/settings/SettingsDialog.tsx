import { useEffect, useRef, useState } from "react"
import { useSettingsStore } from "../../store/settings-store"
import { useTranslation } from "react-i18next"
import { X, Settings, Bot, Languages, Info, Zap, Rss, BookOpen, Database, Link2 } from "lucide-react"
import { AISettings } from "./AISettings"
import { GeneralSettings } from "./GeneralSettings"
import { TranslationSettings } from "./TranslationSettings"
import { AboutSettings } from "./AboutSettings"
import { ActionsSettings } from "./ActionsSettings"
import { FeedsSettings } from "./FeedsSettings"
import { ReadingSettings } from "./ReadingSettings"
import { DataSettings } from "./DataSettings"
import { AccountsSettings } from "./AccountsSettings"
import { useOverlayHotkeyScope } from "../../hooks/useHotkeyScope"

export function SettingsDialog() {
  const { isOpen, setOpen, activeTab, setActiveTab } = useSettingsStore()
  useOverlayHotkeyScope("settings", isOpen)
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const [position, setPosition] = useState({ x: 120, y: 80 })

  const tabs = [
    { id: "general" as const, label: t("settings.general"), icon: Settings },
    { id: "reading" as const, label: t("settings.reading"), icon: BookOpen },
    { id: "subscriptions" as const, label: t("settings.subscriptions"), icon: Rss },
    { id: "ai" as const, label: t("settings.ai"), icon: Bot },
    { id: "translation" as const, label: t("settings.translation"), icon: Languages },
    { id: "actions" as const, label: t("settings.actions"), icon: Zap },
    { id: "accounts" as const, label: t("settings.accounts"), icon: Link2 },
    { id: "data" as const, label: t("settings.data"), icon: Database },
    { id: "about" as const, label: t("settings.about"), icon: Info },
  ]

  useEffect(() => {
    const width = Math.min(900, Math.floor(window.innerWidth * 0.95))
    const height = Math.min(620, Math.floor(window.innerHeight * 0.9))
    setPosition({
      x: Math.max(8, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(8, Math.round((window.innerHeight - height) / 2)),
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragStateRef.current
      if (!drag) return
      const rect = dialogRef.current?.getBoundingClientRect()
      const width = rect?.width ?? Math.min(900, Math.floor(window.innerWidth * 0.95))
      const height = rect?.height ?? Math.min(620, Math.floor(window.innerHeight * 0.9))
      const nextX = drag.originX + (e.clientX - drag.startX)
      const nextY = drag.originY + (e.clientY - drag.startY)
      setPosition({
        x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
        y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - height - 8)),
      })
    }
    const onMouseUp = () => {
      dragStateRef.current = null
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div
        ref={dialogRef}
        className="absolute bg-white dark:bg-surface-dark-secondary rounded-xl shadow-2xl flex overflow-hidden resize"
        style={{
          width: 900,
          height: 620,
          minWidth: 680,
          minHeight: 480,
          maxWidth: "95vw",
          maxHeight: "90vh",
          left: position.x,
          top: position.y,
        }}
      >
        {/* Left sidebar */}
        <div className="w-[200px] flex-shrink-0 bg-sidebar dark:bg-sidebar-dark p-4 space-y-1 border-r">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-item w-full ${activeTab === tab.id ? "sidebar-item-active" : ""}`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            className="flex items-center justify-between px-6 py-4 border-b cursor-move select-none"
            onMouseDown={(e) => {
              if (e.button !== 0) return
              dragStateRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                originX: position.x,
                originY: position.y,
              }
            }}
          >
            <h3 className="font-medium">{tabs.find((t) => t.id === activeTab)?.label}</h3>
            <button
              onClick={() => setOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-tertiary"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === "general" && <GeneralSettings />}
            {activeTab === "reading" && <ReadingSettings />}
            {activeTab === "subscriptions" && <FeedsSettings />}
            {activeTab === "ai" && <AISettings />}
            {activeTab === "translation" && <TranslationSettings />}
            {activeTab === "actions" && <ActionsSettings />}
            {activeTab === "accounts" && <AccountsSettings />}
            {activeTab === "data" && <DataSettings />}
            {activeTab === "about" && <AboutSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}
