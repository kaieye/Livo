/**
 * External URL Service — Single, secure entry point for opening external URLs.
 *
 * Wraps the IPC `window.api.app.openExternal()` with:
 * - Protocol validation (http/https only — blocks javascript:, data:, file:, etc.)
 * - Credential-bearing URL rejection
 * - Suspicious URL detection (IP addresses, oversized hostnames, @ symbols, etc.)
 * - Optional user confirmation dialog for flagged URLs
 *
 * Motivation: External URL handling was scattered across EntryContent.tsx
 * (inlined click interception + React warning modal), ContextMenu.tsx
 * (direct IPC call with no validation), and will be needed by the upcoming
 * AI chat markdown component. This module is a pure utility — no React, no JSX.
 */

import { classifyExternalUrl } from '../../../shared/url-policy'

/**
 * Result of an external URL open attempt.
 */
export interface OpenExternalResult {
  /** true if the URL was successfully opened */
  opened: boolean
  /** true if the URL was blocked outright (invalid protocol, malformed URL) */
  blocked: boolean
  /** true if the URL looks suspicious and requires user confirmation */
  suspicious: boolean
  /** extracted hostname for display purposes */
  hostname: string
}

/**
 * Open an external URL with security validation.
 *
 * Processing order:
 * 1. Parse the URL via `new URL()` — malformed URLs are blocked.
 * 2. Protocol check — only `http:` and `https:` are allowed.
 * 3. Suspicious pattern detection (reuses logic from `sanitize.ts`):
 *    - Hostname contains `..`
 *    - Hostname is an IPv4 address
 *    - Hostname longer than 50 characters
 *    - URL contains `@` or `\\`
 * 4. For safe URLs: opens via `window.api.app.openExternal()` IPC.
 * 5. For suspicious URLs: returns with `suspicious: true` so the caller
 *    can decide whether to show a confirmation UI.
 *
 * @param url - The URL to open (raw string, will be parsed)
 * @returns Result object describing what happened
 *
 * @example
 * ```ts
 * const result = await openExternalUrl('https://example.com')
 * if (result.blocked) { showError('Invalid URL') }
 * if (result.suspicious) { showWarning(result.hostname) }
 * if (result.opened) { /* all good *\/ }
 * ```
 */
export async function openExternalUrl(
  url: string,
): Promise<OpenExternalResult> {
  const policy = classifyExternalUrl(url)
  const hostname = policy.hostname

  if (policy.blocked) {
    return { opened: false, blocked: true, suspicious: false, hostname }
  }

  if (policy.suspicious) {
    return { opened: false, blocked: false, suspicious: true, hostname }
  }

  // ---- Step 4: Safe URL — open via IPC ----
  if (window.api?.app?.openExternal) {
    try {
      const result = await window.api.app.openExternal(policy.url)
      return {
        opened: result.success,
        blocked: false,
        suspicious: false,
        hostname,
      }
    } catch {
      return { opened: false, blocked: false, suspicious: false, hostname }
    }
  }

  // Fallback for non-Electron environments (e.g. web build)
  try {
    window.open(policy.url, '_blank', 'noopener,noreferrer')
    return { opened: true, blocked: false, suspicious: false, hostname }
  } catch {
    return { opened: false, blocked: false, suspicious: false, hostname }
  }
}

/**
 * Open a URL with automatic confirmation dialog for suspicious links.
 *
 * This is a convenience wrapper around {@link openExternalUrl} that:
 * - Calls `openExternalUrl(url)` to validate and classify the URL
 * - If blocked — returns `{ opened: false }` immediately
 * - If suspicious — shows a native `confirm()` dialog to the user
 * - If the user confirms, opens the URL via IPC
 * - If safe — the URL was already opened by `openExternalUrl`
 *
 * @param url - The URL to open
 * @returns `{ opened: boolean }` — true if the URL was ultimately opened
 *
 * @example
 * ```ts
 * // Simple usage — handles everything automatically
 * await openExternalUrlSafe(linkHref)
 * ```
 */
export async function openExternalUrlSafe(
  url: string,
): Promise<{ opened: boolean }> {
  const result = await openExternalUrl(url)

  // Blocked URLs — nothing to do
  if (result.blocked) {
    return { opened: false }
  }

  // Safe URLs — already opened by openExternalUrl
  if (!result.suspicious) {
    return { opened: result.opened }
  }

  // Suspicious URL — ask the user
  const confirmed = window.confirm(
    `即将打开外部链接\n\n${result.hostname}\n\n该链接看起来可能存在风险，确定要继续吗？`,
  )

  if (!confirmed) {
    return { opened: false }
  }

  // User confirmed — open via IPC
  if (window.api?.app?.openExternal) {
    try {
      const openResult = await window.api.app.openExternal(url)
      return { opened: openResult.success }
    } catch {
      return { opened: false }
    }
  }

  // Fallback for non-Electron environment
  try {
    window.open(url, '_blank', 'noopener,noreferrer')
    return { opened: true }
  } catch {
    return { opened: false }
  }
}
