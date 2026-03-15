import React from "react"
import ReactDOM from "react-dom/client"
import App from "@renderer/App"
import { ErrorBoundary } from "@renderer/components/ErrorBoundary"
import "@renderer/styles/globals.css"
import { initWebPlatform } from "./web-api"

console.log("[Livo Web] Starting...")

async function main() {
  // Initialize the web platform (IndexedDB + WebAPI)
  const api = await initWebPlatform()

  // Expose the web API as window.api (same interface as Electron preload)
  ;(window as unknown as { api: typeof api }).api = api

  // Apply dark mode based on system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)")
  if (prefersDark.matches) {
    document.documentElement.classList.add("dark")
  }
  prefersDark.addEventListener("change", (e) => {
    document.documentElement.classList.toggle("dark", e.matches)
  })

  console.log("[Livo Web] Mounting React app...")

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )

  console.log("[Livo Web] App mounted successfully")
}

main().catch((err) => {
  console.error("[Livo Web] Failed to start:", err)
  document.getElementById("root")!.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;">
      <h2 style="color:#FF5C00;">Livo Web 启动失败</h2>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;color:#c00;">${err}</pre>
      <p>请确保浏览器支持 IndexedDB。</p>
    </div>
  `
})
