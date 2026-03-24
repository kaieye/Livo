import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'

type LogLevel = 'info' | 'warn' | 'error'

export function getLogDirectoryPath(): string {
  const logDir = join(app.getPath('userData'), 'logs')
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  return logDir
}

export function getLogFilePath(): string {
  return join(getLogDirectoryPath(), 'main.log')
}

export function readRecentLogs(maxLines = 200): string {
  const logFilePath = getLogFilePath()
  if (!existsSync(logFilePath)) {
    return ''
  }

  const content = readFileSync(logFilePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  return lines
    .slice(Math.max(0, lines.length - maxLines))
    .join('\n')
    .trim()
}

function toMessage(input: unknown): string {
  if (input instanceof Error) {
    return `${input.name}: ${input.message}\n${input.stack || ''}`.trim()
  }
  if (typeof input === 'string') return input
  try {
    return JSON.stringify(input)
  } catch {
    return String(input)
  }
}

function writeLog(level: LogLevel, message: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`
  appendFileSync(getLogFilePath(), line, 'utf-8')
}

export function logInfo(message: string, ...details: unknown[]): void {
  console.log(message, ...details)
  writeLog('info', [message, ...details.map(toMessage)].join(' '))
}

export function logWarn(message: string, ...details: unknown[]): void {
  console.warn(message, ...details)
  writeLog('warn', [message, ...details.map(toMessage)].join(' '))
}

export function logError(message: string, ...details: unknown[]): void {
  console.error(message, ...details)
  writeLog('error', [message, ...details.map(toMessage)].join(' '))
}

export function reportRendererError(payload: {
  source: string
  message: string
  stack?: string
  componentStack?: string
}): void {
  const detail = [
    `source=${payload.source}`,
    `message=${payload.message}`,
    payload.stack ? `stack=${payload.stack}` : '',
    payload.componentStack ? `componentStack=${payload.componentStack}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  logError('[renderer-error]', detail)
}
