import { spawn } from 'node:child_process'

const command = process.argv[2]
const allowedCommands = new Set(['dev', 'preview'])

if (!allowedCommands.has(command)) {
  console.error('Usage: node scripts/run-electron-vite.mjs <dev|preview>')
  process.exit(1)
}

const childEnv = { ...process.env }
delete childEnv.ELECTRON_RUN_AS_NODE

const child = spawn(
  process.platform === 'win32' ? 'electron-vite.cmd' : 'electron-vite',
  [command, '--config', 'config/electron.vite.config.ts'],
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
