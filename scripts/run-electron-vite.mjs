import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const command = process.argv[2]
const allowedCommands = new Set(['dev', 'preview'])

if (!allowedCommands.has(command)) {
  console.error('Usage: node scripts/run-electron-vite.mjs <dev|preview>')
  process.exit(1)
}

const childEnv = { ...process.env }
delete childEnv.ELECTRON_RUN_AS_NODE

const electronViteBin = join(
  process.cwd(),
  'node_modules',
  'electron-vite',
  'bin',
  'electron-vite.js',
)

if (!existsSync(electronViteBin)) {
  console.error('electron-vite is not installed. Run `pnpm install` first.')
  process.exit(1)
}

const child = spawn(
  process.execPath,
  [electronViteBin, command, '--config', 'config/electron.vite.config.ts'],
  {
    env: childEnv,
    stdio: 'inherit',
    shell: false,
  },
)

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
