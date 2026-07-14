interface ApplicationIdentityApi {
  readonly isPackaged: boolean
  getPath(name: 'userData'): string
  setName(name: string): void
  setPath(name: 'userData', path: string): void
}

const DEVELOPMENT_APP_NAME = 'Livo Dev'

/**
 * Keep the development Electron binary on a separate macOS Safe Storage
 * identity while preserving the existing development data directory.
 *
 * Packaged Livo builds and the generic Electron binary have different code
 * signatures. If both use `livo Safe Storage`, macOS asks for Keychain access
 * every time the development binary starts.
 */
export function configureAppIdentity(
  application: ApplicationIdentityApi,
  e2eUserDataPath?: string,
  platform: NodeJS.Platform = process.platform,
): { isDev: boolean } {
  const isDev = !application.isPackaged
  if (!isDev) return { isDev }

  if (platform === 'darwin') {
    const userDataPath = e2eUserDataPath || application.getPath('userData')
    application.setName(DEVELOPMENT_APP_NAME)
    application.setPath('userData', userDataPath)
  } else if (e2eUserDataPath) {
    application.setPath('userData', e2eUserDataPath)
  }

  return { isDev }
}
