import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@renderer/App'
import { ErrorBoundary } from '@renderer/components/ErrorBoundary'
import '@renderer/styles/globals.css'
import { initWebPlatform } from './web-api'

console.log('[Livo Web] Starting...')

function getCurrentBuildSignature() {
  const commit = document
    .querySelector('meta[name="livo-build-commit"]')
    ?.getAttribute('content')
    ?.trim()
  const buildTime = document
    .querySelector('meta[name="livo-build-time"]')
    ?.getAttribute('content')
    ?.trim()
  return {
    commit: commit || '',
    buildTime: buildTime || '',
  }
}

function attachBuildBadge() {
  const { commit, buildTime } = getCurrentBuildSignature()

  if (!commit && !buildTime) return

  const badge = document.createElement('div')
  badge.setAttribute('data-livo-build-badge', 'true')
  badge.style.position = 'fixed'
  badge.style.right = '14px'
  badge.style.bottom = '14px'
  badge.style.zIndex = '9999'
  badge.style.pointerEvents = 'none'
  badge.style.padding = '6px 8px'
  badge.style.borderRadius = '999px'
  badge.style.fontFamily =
    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  badge.style.fontSize = '11px'
  badge.style.lineHeight = '1'
  badge.style.color = '#8a8a8f'
  badge.style.background = 'rgba(255,255,255,0.82)'
  badge.style.backdropFilter = 'blur(10px)'
  badge.style.border = '1px solid rgba(15,23,42,0.08)'
  badge.style.boxShadow = '0 6px 18px rgba(15,23,42,0.08)'
  badge.textContent = `web ${commit ? commit.slice(0, 7) : 'local'}${buildTime ? ` · ${buildTime.slice(0, 16).replace('T', ' ')}` : ''}`

  const syncTheme = (dark: boolean) => {
    if (dark) {
      badge.style.background = 'rgba(28,28,30,0.82)'
      badge.style.border = '1px solid rgba(255,255,255,0.08)'
      badge.style.color = '#a1a1aa'
      return
    }
    badge.style.background = 'rgba(255,255,255,0.82)'
    badge.style.border = '1px solid rgba(15,23,42,0.08)'
    badge.style.color = '#8a8a8f'
  }

  syncTheme(document.documentElement.classList.contains('dark'))
  document.body.appendChild(badge)

  return syncTheme
}

function extractMetaFromHtml(html: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    'i',
  )
  return html.match(pattern)?.[1]?.trim() || ''
}

function attachWebReloadPrompt() {
  const current = getCurrentBuildSignature()
  if (!current.commit && !current.buildTime) return

  let dismissed = false
  let prompt: HTMLDivElement | null = null

  const showPrompt = (nextCommit: string, nextBuildTime: string) => {
    if (dismissed || prompt) return
    prompt = document.createElement('div')
    prompt.style.position = 'fixed'
    prompt.style.left = '50%'
    prompt.style.bottom = '56px'
    prompt.style.transform = 'translateX(-50%)'
    prompt.style.zIndex = '10000'
    prompt.style.display = 'flex'
    prompt.style.alignItems = 'center'
    prompt.style.gap = '10px'
    prompt.style.padding = '10px 12px'
    prompt.style.borderRadius = '14px'
    prompt.style.background = 'rgba(28,28,30,0.92)'
    prompt.style.color = '#f5f5f5'
    prompt.style.boxShadow = '0 12px 30px rgba(15,23,42,0.2)'
    prompt.style.fontSize = '13px'
    prompt.style.backdropFilter = 'blur(12px)'
    prompt.innerHTML = `
      <span>检测到新版本可用${nextCommit ? ` · ${nextCommit.slice(0, 7)}` : ''}${nextBuildTime ? ` · ${nextBuildTime.slice(0, 16).replace('T', ' ')}` : ''}</span>
      <button data-action="reload" style="border:none;border-radius:999px;padding:6px 10px;background:#FF7A1A;color:#fff;cursor:pointer;">立即刷新</button>
      <button data-action="dismiss" style="border:none;background:transparent;color:#cbd5e1;cursor:pointer;">稍后</button>
    `
    prompt
      .querySelector('[data-action="reload"]')
      ?.addEventListener('click', () => {
        window.location.reload()
      })
    prompt
      .querySelector('[data-action="dismiss"]')
      ?.addEventListener('click', () => {
        dismissed = true
        prompt?.remove()
        prompt = null
      })
    document.body.appendChild(prompt)
  }

  const checkForNewBuild = async () => {
    try {
      const response = await fetch(window.location.href, {
        cache: 'no-store',
        headers: {
          Accept: 'text/html',
        },
      })
      if (!response.ok) return
      const html = await response.text()
      const nextCommit = extractMetaFromHtml(html, 'livo-build-commit')
      const nextBuildTime = extractMetaFromHtml(html, 'livo-build-time')
      const changed =
        (!!nextCommit && nextCommit !== current.commit) ||
        (!!nextBuildTime && nextBuildTime !== current.buildTime)
      if (changed) {
        showPrompt(nextCommit, nextBuildTime)
      }
    } catch {
      // Ignore transient polling failures.
    }
  }

  window.setTimeout(() => {
    void checkForNewBuild()
  }, 20_000)
  window.setInterval(
    () => {
      void checkForNewBuild()
    },
    5 * 60 * 1000,
  )
}

async function main() {
  // Initialize the web platform (IndexedDB + WebAPI)
  const api = await initWebPlatform()

  // Expose the web API as window.api (same interface as Electron preload)
  ;(window as unknown as { api: typeof api }).api = api

  // Apply dark mode based on system preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')
  if (prefersDark.matches) {
    document.documentElement.classList.add('dark')
  }
  const syncBuildBadgeTheme = attachBuildBadge()
  attachWebReloadPrompt()
  prefersDark.addEventListener('change', (e) => {
    document.documentElement.classList.toggle('dark', e.matches)
    syncBuildBadgeTheme?.(e.matches)
  })

  console.log('[Livo Web] Mounting React app...')

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )

  console.log('[Livo Web] App mounted successfully')
}

main().catch((err) => {
  console.error('[Livo Web] Failed to start:', err)
  document.getElementById('root')!.innerHTML = `
    <div style="padding:40px;font-family:sans-serif;">
      <h2 style="color:#FF5C00;">Livo Web 启动失败</h2>
      <pre style="background:#f5f5f5;padding:16px;border-radius:8px;color:#c00;">${err}</pre>
      <p>请确保浏览器支持 IndexedDB。</p>
    </div>
  `
})
