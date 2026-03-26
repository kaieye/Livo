/**
 * SharePoster — Generate a shareable poster image from an entry.
 * Share poster modal.
 * Uses Canvas API to render a styled poster with entry title, content snippet, feed info, and QR-like branding.
 */
import { useState, useRef, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { X, Download, Copy, Loader2 } from "lucide-react"
import type { Entry } from "../../../../shared/types"

interface SharePosterProps {
  entry: Entry
  feedTitle?: string
  onClose: () => void
}

export function SharePoster({ entry, feedTitle, onClose }: SharePosterProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(true)

  const generatePoster = useCallback(async () => {
    setIsGenerating(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 2
    const W = 440
    const H = 620
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.scale(dpr, dpr)

    // Background
    const isDark = document.documentElement.classList.contains("dark")
    ctx.fillStyle = isDark ? "#1a1a2e" : "#ffffff"
    ctx.fillRect(0, 0, W, H)

    // Accent bar at top
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim() || "#FF8C00"
    ctx.fillStyle = accentColor
    ctx.fillRect(0, 0, W, 4)

    const textColor = isDark ? "#e5e7eb" : "#1f2937"
    const secondaryColor = isDark ? "#9ca3af" : "#6b7280"

    // Feed title
    const py = 36
    const px = 32
    ctx.font = "500 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.fillStyle = accentColor
    ctx.fillText(feedTitle || "Livo", px, py)

    // Date
    const dateStr = new Date(entry.publishedAt).toLocaleDateString()
    const dateWidth = ctx.measureText(dateStr).width
    ctx.fillStyle = secondaryColor
    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.fillText(dateStr, W - px - dateWidth, py)

    // Title
    ctx.fillStyle = textColor
    ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    const titleLines = wrapText(ctx, entry.title || "", W - px * 2, 3)
    let y = py + 28
    for (const line of titleLines) {
      ctx.fillText(line, px, y)
      y += 28
    }

    // Separator
    y += 12
    ctx.strokeStyle = isDark ? "#374151" : "#e5e7eb"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(px, y)
    ctx.lineTo(W - px, y)
    ctx.stroke()
    y += 20

    // Content snippet
    const contentText = (entry.summary || entry.content || "")
      .replace(/<[^>]+>/g, "")
      .trim()
      .slice(0, 400)

    if (contentText) {
      ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      ctx.fillStyle = secondaryColor
      const contentLines = wrapText(ctx, contentText, W - px * 2, 12)
      for (const line of contentLines) {
        if (y > H - 100) break
        ctx.fillText(line, px, y)
        y += 22
      }
    }

    // Author
    if (entry.author) {
      y = Math.max(y + 16, H - 90)
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      ctx.fillStyle = secondaryColor
      ctx.fillText(`— ${entry.author}`, px, y)
    }

    // Footer branding
    const footerY = H - 32
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.fillStyle = accentColor
    ctx.fillText("Livo", px, footerY)

    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    ctx.fillStyle = secondaryColor
    const url = entry.url || ""
    const shortUrl = url.length > 50 ? url.slice(0, 50) + "..." : url
    ctx.fillText(shortUrl, px, footerY + 18)

    setDataUrl(canvas.toDataURL("image/png"))
    setIsGenerating(false)
  }, [entry, feedTitle])

  // Generate poster on mount and whenever content changes
  useEffect(() => {
    void generatePoster()
  }, [generatePoster])

  const handleSave = useCallback(() => {
    if (!dataUrl) return
    const link = document.createElement("a")
    link.download = `${(entry.title || "poster").slice(0, 50)}.png`
    link.href = dataUrl
    link.click()
  }, [dataUrl, entry.title])

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png"),
      )
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ])
      }
    } catch {
      // Fallback: copy data URL
      if (dataUrl) {
        navigator.clipboard.writeText(dataUrl)
      }
    }
  }, [dataUrl])

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-surface-dark rounded-2xl shadow-2xl overflow-hidden max-w-[500px] w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{t("entryList.posterTitle")}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary">
            <X size={16} />
          </button>
        </div>

        {/* Canvas preview */}
        <div className="flex justify-center p-4 bg-surface-secondary dark:bg-surface-dark-secondary">
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-lg"
            style={{ maxWidth: "100%", height: "auto" }}
          />
          {isGenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50">
              <Loader2 size={24} className="animate-spin text-accent" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t">
          <button
            onClick={handleSave}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            <Download size={14} />
            {t("entryList.saveImage")}
          </button>
          <button
            onClick={handleCopy}
            disabled={isGenerating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary disabled:opacity-50"
          >
            <Copy size={14} />
            {t("entryList.copyTitle")}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Wrap text to fit within maxWidth, limiting to maxLines */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split("")
  const lines: string[] = []
  let currentLine = ""

  for (const char of words) {
    const testLine = currentLine + char
    if (ctx.measureText(testLine).width > maxWidth) {
      if (lines.length >= maxLines - 1) {
        lines.push(currentLine + "...")
        return lines
      }
      lines.push(currentLine)
      currentLine = char
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) {
    if (lines.length >= maxLines) {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -3) + "..."
    } else {
      lines.push(currentLine)
    }
  }
  return lines
}
