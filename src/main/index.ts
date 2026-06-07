import { app } from 'electron'
import { createAppManager } from './app-manager'

const e2eUserDataPath = process.env['LIVO_E2E_USER_DATA']
if (e2eUserDataPath) {
  app.setPath('userData', e2eUserDataPath)
}

const isDev = !app.isPackaged
const appManager = createAppManager({ isDev })
appManager.handleInitialArgv(process.argv)

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

// Chromium's network stack prints low-level SSL handshake failures directly to
// stderr for some upstreams we probe during startup/refresh. Keep those noisy
// internal messages out of the terminal while preserving our own app logs.
app.commandLine.appendSwitch('log-level', '3')

if (isDev) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

app.on('second-instance', (_event, argv) => {
  appManager.handleSecondInstance(argv)
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  appManager.handleOpenUrl(url)
})

app.whenReady().then(async () => {
  await appManager.onReady()

  app.on('activate', () => {
    appManager.handleActivate()
  })
})

app.on('before-quit', () => {
  appManager.handleBeforeQuit()
})

app.on('window-all-closed', () => {
  appManager.handleWindowAllClosed()
})
