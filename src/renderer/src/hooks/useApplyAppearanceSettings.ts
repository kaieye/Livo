import { useEffect } from "react"
import { useSettingsStore } from "../store/settings-store"
import { applyAppearanceSettings } from "../lib/appearance"

export function useApplyAppearanceSettings() {
  const general = useSettingsStore((state) => state.settings.general)

  useEffect(() => {
    applyAppearanceSettings(general)
  }, [general])

  useEffect(() => {
    if (general.theme !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = () => applyAppearanceSettings(useSettingsStore.getState().settings.general)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [general.theme])
}
