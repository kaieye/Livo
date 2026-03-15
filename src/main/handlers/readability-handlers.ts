import { ipcMain } from "electron"
import { fetchReadableContent, resolveRelativeUrls } from "../services/readability"

export function registerReadabilityHandlers(): void {
  ipcMain.handle("readability:fetch", async (_event, url: string) => {
    try {
      const result = await fetchReadableContent(url)

      // Resolve relative URLs in the extracted content
      const content = resolveRelativeUrls(result.content, url)

      return {
        success: true,
        title: result.title,
        content,
        excerpt: result.excerpt,
        siteName: result.siteName,
        length: result.length,
      }
    } catch (error) {
      return {
        success: false,
        error: `鏃犳硶鑾峰彇鍘熸枃: ${String(error)}`,
      }
    }
  })
}



