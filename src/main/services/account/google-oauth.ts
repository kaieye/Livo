import { app, shell, session } from 'electron'
import { createServer, type ServerResponse } from 'http'
import type { AddressInfo } from 'net'
import { createHash, randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AccountSessionState } from '../../../shared/types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const GOOGLE_OAUTH_CALLBACK_PATH = '/'
const GOOGLE_OAUTH_TIMEOUT_MS = 180000
const GOOGLE_OAUTH_SCOPES = ['openid', 'email', 'profile']

interface GoogleOAuthTokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
}

interface GoogleUserInfoResponse {
  sub?: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

interface SavedGoogleOAuthSession {
  provider: 'google'
  profile: {
    sub: string
    email: string | null
    name: string | null
    picture: string | null
  }
  grantedScope: string | null
  authenticatedAt: number
}

const googleOAuthSessionFile = join(
  app.getPath('userData'),
  'google-oauth-session.json',
)

function getGoogleOAuthClientId(): string | null {
  const value =
    process.env['LIVO_GOOGLE_OAUTH_CLIENT_ID'] ??
    process.env['GOOGLE_OAUTH_CLIENT_ID'] ??
    ''
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function base64Url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function createCodeVerifier(): string {
  return base64Url(randomBytes(64))
}

function createCodeChallenge(verifier: string): string {
  return base64Url(createHash('sha256').update(verifier).digest())
}

function readSavedGoogleOAuthSession(): SavedGoogleOAuthSession | null {
  try {
    if (!existsSync(googleOAuthSessionFile)) return null
    const parsed = JSON.parse(
      readFileSync(googleOAuthSessionFile, 'utf-8'),
    ) as Partial<SavedGoogleOAuthSession>
    if (
      parsed.provider !== 'google' ||
      !parsed.profile ||
      typeof parsed.profile.sub !== 'string' ||
      typeof parsed.authenticatedAt !== 'number'
    ) {
      return null
    }
    return parsed as SavedGoogleOAuthSession
  } catch {
    return null
  }
}

function saveGoogleOAuthSession(data: SavedGoogleOAuthSession): void {
  mkdirSync(dirname(googleOAuthSessionFile), { recursive: true })
  writeFileSync(googleOAuthSessionFile, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  })
}

function sendOAuthCallbackResponse(
  response: ServerResponse,
  statusCode: number,
  body: string,
): void {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><title>Livo Google OAuth</title></head>
  <body style="font-family: system-ui, sans-serif; padding: 24px;">
    <h1 style="font-size: 18px;">${body}</h1>
    <p>可以关闭此浏览器窗口并返回 Livo。</p>
  </body>
</html>`)
}

async function startOAuthCallbackServer(expectedState: string): Promise<{
  redirectUri: string
  waitForCode: Promise<string>
  cancel: (message: string) => void
}> {
  const server = createServer()

  const redirectUri = await new Promise<string>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('error', onError)
      reject(error)
    }
    server.once('error', onError)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError)
      const address = server.address() as AddressInfo | null
      if (!address?.port) {
        reject(new Error('Failed to allocate OAuth callback port'))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })

  let cancel: (message: string) => void = () => {}
  const waitForCode = new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (
      result:
        | { success: true; code: string }
        | { success: false; error: string },
    ) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      server.close(() => {
        if (result.success) {
          resolve(result.code)
        } else {
          reject(new Error(result.error))
        }
      })
    }
    cancel = (message: string) => {
      finish({ success: false, error: message })
    }

    const timer = setTimeout(() => {
      finish({ success: false, error: 'Google OAuth login timed out' })
    }, GOOGLE_OAUTH_TIMEOUT_MS)

    server.on('request', (request, response) => {
      try {
        const requestUrl = new URL(
          request.url ?? '/',
          `http://${request.headers.host ?? '127.0.0.1'}`,
        )
        if (requestUrl.pathname !== GOOGLE_OAUTH_CALLBACK_PATH) {
          sendOAuthCallbackResponse(
            response,
            404,
            '未识别的 Google OAuth 回调。',
          )
          return
        }

        const state = requestUrl.searchParams.get('state')
        if (state !== expectedState) {
          sendOAuthCallbackResponse(
            response,
            400,
            'Google OAuth state 校验失败。',
          )
          finish({ success: false, error: 'Invalid Google OAuth state' })
          return
        }

        const oauthError = requestUrl.searchParams.get('error')
        if (oauthError) {
          sendOAuthCallbackResponse(response, 400, 'Google OAuth 授权未完成。')
          finish({ success: false, error: oauthError })
          return
        }

        const code = requestUrl.searchParams.get('code')
        if (!code) {
          sendOAuthCallbackResponse(response, 400, 'Google OAuth 缺少授权码。')
          finish({ success: false, error: 'Missing Google OAuth code' })
          return
        }

        sendOAuthCallbackResponse(response, 200, 'Google 登录已完成。')
        finish({ success: true, code })
      } catch (error) {
        sendOAuthCallbackResponse(response, 500, 'Google OAuth 回调处理失败。')
        finish({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  })

  return { redirectUri, waitForCode, cancel }
}

async function exchangeAuthorizationCode(input: {
  clientId: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<GoogleOAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
  })

  const response = await session.defaultSession.fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `Google token exchange failed: ${response.status}${text ? ` ${text}` : ''}`,
    )
  }
  return (await response.json()) as GoogleOAuthTokenResponse
}

async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleUserInfoResponse> {
  const response = await session.defaultSession.fetch(GOOGLE_USERINFO_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Google userinfo failed: ${response.status}`)
  }
  return (await response.json()) as GoogleUserInfoResponse
}

export async function getGoogleOAuthAccountState(): Promise<AccountSessionState> {
  const saved = readSavedGoogleOAuthSession()
  if (!saved) {
    return { provider: 'google', linked: false, displayName: null }
  }
  return {
    provider: 'google',
    linked: true,
    displayName: saved.profile.name ?? saved.profile.email ?? null,
  }
}

export async function linkGoogleOAuthAccount(): Promise<{
  success: boolean
  error?: string
}> {
  const clientId = getGoogleOAuthClientId()
  if (!clientId) {
    return {
      success: false,
      error:
        'Missing Google OAuth Client ID. Set LIVO_GOOGLE_OAUTH_CLIENT_ID before signing in.',
    }
  }

  const state = base64Url(randomBytes(32))
  const codeVerifier = createCodeVerifier()
  const codeChallenge = createCodeChallenge(codeVerifier)

  try {
    const { redirectUri, waitForCode, cancel } =
      await startOAuthCallbackServer(state)
    const authUrl = new URL(GOOGLE_AUTH_URL)
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', codeChallenge)
    authUrl.searchParams.set('code_challenge_method', 'S256')
    authUrl.searchParams.set('prompt', 'select_account')

    try {
      await shell.openExternal(authUrl.toString())
    } catch (error) {
      cancel('Failed to open Google OAuth browser')
      void waitForCode.catch(() => {})
      throw error
    }
    const code = await waitForCode
    const token = await exchangeAuthorizationCode({
      clientId,
      code,
      codeVerifier,
      redirectUri,
    })
    if (!token.access_token || !token.expires_in) {
      throw new Error('Google token response is missing access token')
    }
    const profile = await fetchGoogleUserInfo(token.access_token)
    if (!profile.sub) {
      throw new Error('Google profile response is missing subject')
    }

    saveGoogleOAuthSession({
      provider: 'google',
      profile: {
        sub: profile.sub,
        email: profile.email ?? null,
        name: profile.name ?? null,
        picture: profile.picture ?? null,
      },
      grantedScope: token.scope ?? null,
      authenticatedAt: Date.now(),
    })
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function unlinkGoogleOAuthAccount(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    if (existsSync(googleOAuthSessionFile)) {
      rmSync(googleOAuthSessionFile)
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
