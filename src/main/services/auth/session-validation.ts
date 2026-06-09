import { authService, type CurrentUser } from './auth-service'
import { sessionStore } from './session-store'
import { logWarnQuiet } from '../system/logger'

export interface ValidatedSession {
  token: string
  user: CurrentUser
}

function isSessionRejectedByBackend(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /\b(401|403)\b/.test(error.message)
}

/**
 * Local session expiry only tells us the token has not aged out on this device.
 * Verify against the current backend so stale tokens from reset databases are cleared.
 */
export async function getValidatedSession(): Promise<ValidatedSession | null> {
  const session = sessionStore.getSession()
  if (!session || !sessionStore.isSessionValid()) {
    return null
  }

  try {
    const user = await authService.getCurrentUser(session.token)
    sessionStore.saveSession({
      ...session,
      userId: user.id,
      user,
    })
    return { token: session.token, user }
  } catch (error) {
    if (isSessionRejectedByBackend(error)) {
      sessionStore.clearSession()
      logWarnQuiet('[auth-session-invalid-cleared]', error)
      return null
    }

    logWarnQuiet('[auth-session-validation-unavailable]', error)
    return { token: session.token, user: session.user }
  }
}
