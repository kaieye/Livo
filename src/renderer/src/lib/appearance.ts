import type { AppSettings } from "../../../shared/types"

type AppearanceSettings = Pick<
  AppSettings["general"],
  "theme" | "reduceMotion" | "accentColor" | "uiFontFamily" | "contentFontFamily" | "customCSS"
>

export const ACCENT_COLOR_MAP: Record<string, { color: string; hover: string; soft: string }> = {
  orange: { color: "#FF8C00", hover: "#FF9F2F", soft: "#FFF1E6" },
  red: { color: "#EF4444", hover: "#F87171", soft: "#FEE2E2" },
  rose: { color: "#F43F5E", hover: "#FB7185", soft: "#FFE4E6" },
  purple: { color: "#A855F7", hover: "#C084FC", soft: "#F3E8FF" },
  blue: { color: "#3B82F6", hover: "#60A5FA", soft: "#DBEAFE" },
  teal: { color: "#14B8A6", hover: "#2DD4BF", soft: "#CCFBF1" },
  green: { color: "#22C55E", hover: "#4ADE80", soft: "#DCFCE7" },
  yellow: { color: "#EAB308", hover: "#FACC15", soft: "#FEF9C3" },
}

function hexToRgbTriplet(hex: string): string {
  const normalized = hex.replace("#", "").trim()
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "255 92 0"
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return `${red} ${green} ${blue}`
}

function resolveAccentPalette(accentColor: string | undefined) {
  if (!accentColor) return ACCENT_COLOR_MAP.orange
  if (accentColor in ACCENT_COLOR_MAP) return ACCENT_COLOR_MAP[accentColor]
  if (/^#[0-9a-f]{6}$/i.test(accentColor)) {
    return {
      color: accentColor,
      hover: accentColor,
      soft: `${accentColor}1A`,
    }
  }
  return ACCENT_COLOR_MAP.orange
}

function ensureCustomStyleElement(): HTMLStyleElement {
  let styleEl = document.getElementById("livo-custom-css") as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "livo-custom-css"
    document.head.appendChild(styleEl)
  }
  return styleEl
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const shouldUseDark = settings.theme === "dark" || (settings.theme === "system" && prefersDark)
  root.classList.toggle("dark", shouldUseDark)
  root.classList.toggle("reduce-motion", !!settings.reduceMotion)

  const accent = resolveAccentPalette(settings.accentColor)
  root.style.setProperty("--color-accent", accent.color)
  root.style.setProperty("--color-accent-hover", accent.hover)
  root.style.setProperty("--color-accent-soft", accent.soft)
  root.style.setProperty("--color-accent-rgb", hexToRgbTriplet(accent.color))
  root.style.setProperty("--font-ui", settings.uiFontFamily || "inherit")
  root.style.setProperty("--font-content", settings.contentFontFamily || "inherit")

  ensureCustomStyleElement().textContent = settings.customCSS || ""
}
