import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { I18nProvider } from "./providers/I18nProvider"
import "./styles/globals.css"

console.log("[Livo] Renderer starting...")

// Apply dark mode based on system preference
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)")
if (prefersDark.matches) {
  document.documentElement.classList.add("dark")
}
prefersDark.addEventListener("change", (e) => {
  if (e.matches) {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
})

console.log("[Livo] Mounting React app...")

try {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <I18nProvider>
          <App />
        </I18nProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
  console.log("[Livo] React app mounted successfully")
} catch (err) {
  console.error("[Livo] Failed to mount React app:", err)
  document.getElementById("root")!.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;">
      <h2 style="color:#FF5C00;">Livo 启动失败</h2>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;color:#c00;">${err}</pre>
    </div>
  `
}
