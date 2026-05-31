import { Menu, app } from 'electron'
import type { AppCommandPayload } from '../shared/types'
import type { WindowManager } from './window-manager'

function sendCommand(
  windowManager: WindowManager,
  payload: AppCommandPayload,
): void {
  windowManager.sendAppCommand(payload)
}

export function registerAppMenu(options: {
  windowManager: WindowManager
  isDev: boolean
  openDataDirectory: () => void
  openCacheDirectory: () => void
  openLogsDirectory: () => void
  checkForUpdates: () => void
}): void {
  const { windowManager, isDev } = options
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: app.name,
            submenu: [
              {
                label: '关于 Livo',
                click: () =>
                  sendCommand(windowManager, {
                    type: 'open-settings',
                    tab: 'about',
                  }),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '文件',
      submenu: [
        {
          label: '刷新全部订阅',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendCommand(windowManager, { type: 'refresh-all' }),
        },
        {
          label: '快速搜索',
          accelerator: 'CmdOrCtrl+K',
          click: () => sendCommand(windowManager, { type: 'open-search' }),
        },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendCommand(windowManager, { type: 'open-settings' }),
        },
        {
          label: '数据与诊断',
          click: () =>
            sendCommand(windowManager, {
              type: 'open-data-settings',
              tab: 'data',
            }),
        },
        {
          label: '检查更新',
          click: () => options.checkForUpdates(),
        },
        { type: 'separator' },
        ...(process.platform === 'darwin' ? [] : [{ role: 'quit' as const }]),
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '快捷键帮助',
          accelerator: 'Shift+/',
          click: () => sendCommand(windowManager, { type: 'show-shortcuts' }),
        },
        { type: 'separator' },
        {
          label: '打开数据目录',
          click: () => options.openDataDirectory(),
        },
        {
          label: '打开缓存目录',
          click: () => options.openCacheDirectory(),
        },
        {
          label: '打开日志目录',
          click: () => options.openLogsDirectory(),
        },
        { type: 'separator' },
        {
          label: '检查更新',
          click: () => options.checkForUpdates(),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
