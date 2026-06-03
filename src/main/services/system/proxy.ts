import { session } from 'electron'
import type { AppSettings } from '../../../shared/types/index'

const PROXY_PROTOCOLS = new Set(['http:', 'https:', 'socks:', 'socks5:'])
const DEFAULT_PROXY_BYPASS_RULES = '<local>'

type ProxyMode = AppSettings['general']['proxyMode']

export interface NormalizedProxyState {
  mode: ProxyMode
  proxyUrl: string
}

export function normalizeProxyUrl(input: string | undefined): string {
  const raw = (input || '').trim()
  if (!raw) return ''

  const firstInput = raw.split(',')[0]?.trim() || ''
  if (!firstInput) return ''

  try {
    const parsed = new URL(firstInput)
    if (!PROXY_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) return ''
    const port = parsed.port ? `:${parsed.port}` : ''
    return `${parsed.protocol}//${parsed.hostname}${port}`
  } catch {
    return ''
  }
}

export function getNormalizedProxyState(
  general: Pick<AppSettings['general'], 'proxyMode' | 'proxyUrl'>,
): NormalizedProxyState {
  const mode = general.proxyMode === 'custom' ? 'custom' : 'system'
  const proxyUrl = mode === 'custom' ? normalizeProxyUrl(general.proxyUrl) : ''
  if (mode === 'custom' && proxyUrl) {
    return { mode, proxyUrl }
  }
  return { mode: 'system', proxyUrl: '' }
}

export function buildElectronProxyConfig(state: NormalizedProxyState): {
  mode?: 'system'
  proxyRules?: string
  proxyBypassRules?: string
} {
  if (state.mode !== 'custom' || !state.proxyUrl) {
    return { mode: 'system' }
  }

  return {
    proxyRules: `${state.proxyUrl},direct://`,
    proxyBypassRules: DEFAULT_PROXY_BYPASS_RULES,
  }
}

async function syncUndiciProxy(state: NormalizedProxyState): Promise<void> {
  let undici: {
    Agent: new () => unknown
    ProxyAgent: new (options: string | { uri: string }) => unknown
    setGlobalDispatcher: (dispatcher: unknown) => void
  } | null = null

  try {
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier)',
    ) as (specifier: string) => Promise<{
      Agent: new () => unknown
      ProxyAgent: new (options: string | { uri: string }) => unknown
      setGlobalDispatcher: (dispatcher: unknown) => void
    }>
    undici = await dynamicImport('undici')
  } catch {
    undici = null
  }

  if (!undici) return

  if (state.mode !== 'custom' || !state.proxyUrl) {
    undici.setGlobalDispatcher(new undici.Agent())
    return
  }

  const protocol = new URL(state.proxyUrl).protocol
  if (protocol === 'http:' || protocol === 'https:') {
    undici.setGlobalDispatcher(new undici.ProxyAgent(state.proxyUrl))
    return
  }

  // SOCKS is handled by Electron session proxy only; undici does not support it directly.
  undici.setGlobalDispatcher(new undici.Agent())
}

export async function applyProxySettings(
  settings: Pick<AppSettings, 'general'>,
): Promise<NormalizedProxyState> {
  const normalized = getNormalizedProxyState(settings.general)
  await session.defaultSession.setProxy(buildElectronProxyConfig(normalized))
  await syncUndiciProxy(normalized)
  return normalized
}
