import { app } from 'electron'
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
} from 'fs'
import { join } from 'path'

type LogLevel = 'info' | 'warn' | 'error'

const DEFAULT_RECENT_LOG_LINES = 200
const MAX_RECENT_LOG_LINES = 2000
const MAX_RECENT_LOG_BYTES = 2 * 1024 * 1024
const MAX_RENDERER_ERROR_SOURCE_LENGTH = 512
const MAX_RENDERER_ERROR_MESSAGE_LENGTH = 16 * 1024
const MAX_RENDERER_ERROR_STACK_LENGTH = 64 * 1024

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

function clampRecentLogLines(maxLines: number): number {
  if (!Number.isFinite(maxLines)) return DEFAULT_RECENT_LOG_LINES
  return Math.min(MAX_RECENT_LOG_LINES, Math.max(1, Math.floor(maxLines)))
}

function readRecentLogBytes(path: string): string {
  const size = statSync(path).size
  if (size <= MAX_RECENT_LOG_BYTES) {
    return readFileSync(path, 'utf-8')
  }

  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.allocUnsafe(MAX_RECENT_LOG_BYTES)
    readSync(fd, buffer, 0, MAX_RECENT_LOG_BYTES, size - MAX_RECENT_LOG_BYTES)
    return buffer.toString('utf-8')
  } finally {
    closeSync(fd)
  }
}

export function readRecentLogs(maxLines = DEFAULT_RECENT_LOG_LINES): string {
  const logFilePath = getLogFilePath()
  if (!existsSync(logFilePath)) {
    return ''
  }

  const lineCount = clampRecentLogLines(maxLines)
  const content = readRecentLogBytes(logFilePath)
  const lines = content.split(/\r?\n/)
  return lines
    .slice(Math.max(0, lines.length - lineCount))
    .join('\n')
    .trim()
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`
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

// On Windows, console.log/warn/error encodes through the system codepage (e.g. GBK),
// which garbles UTF-8 Chinese characters. Writing a UTF-8 Buffer to the raw stdout/stderr
// fd bypasses the codepage conversion and renders correctly in any modern terminal.
function consoleLog(...args: unknown[]): void {
  try {
    const line =
      args.map((a) => (typeof a === 'string' ? a : toMessage(a))).join(' ') +
      '\n'
    process.stdout.write(Buffer.from(line, 'utf-8'))
  } catch {
    console.log(...args)
  }
}

function consoleWarn(...args: unknown[]): void {
  try {
    const line =
      args.map((a) => (typeof a === 'string' ? a : toMessage(a))).join(' ') +
      '\n'
    process.stderr.write(Buffer.from(line, 'utf-8'))
  } catch {
    console.warn(...args)
  }
}

function consoleError(...args: unknown[]): void {
  try {
    const line =
      args.map((a) => (typeof a === 'string' ? a : toMessage(a))).join(' ') +
      '\n'
    process.stderr.write(Buffer.from(line, 'utf-8'))
  } catch {
    console.error(...args)
  }
}

export function logInfo(message: string, ...details: unknown[]): void {
  consoleLog(message, ...details)
  writeLog('info', [message, ...details.map(toMessage)].join(' '))
}

export function logWarn(message: string, ...details: unknown[]): void {
  consoleWarn(message, ...details)
  writeLog('warn', [message, ...details.map(toMessage)].join(' '))
}

export function logWarnQuiet(message: string, ...details: unknown[]): void {
  writeLog('warn', [message, ...details.map(toMessage)].join(' '))
}

export function logError(message: string, ...details: unknown[]): void {
  consoleError(message, ...details)
  writeLog('error', [message, ...details.map(toMessage)].join(' '))
}

export function reportRendererError(payload: {
  source: string
  message: string
  stack?: string
  componentStack?: string
}): void {
  const source = truncateForLog(
    String(payload.source || 'renderer').trim() || 'renderer',
    MAX_RENDERER_ERROR_SOURCE_LENGTH,
  )
  const message = truncateForLog(
    String(payload.message || 'Unknown renderer error'),
    MAX_RENDERER_ERROR_MESSAGE_LENGTH,
  )
  const stack = payload.stack
    ? truncateForLog(String(payload.stack), MAX_RENDERER_ERROR_STACK_LENGTH)
    : ''
  const componentStack = payload.componentStack
    ? truncateForLog(
        String(payload.componentStack),
        MAX_RENDERER_ERROR_STACK_LENGTH,
      )
    : ''
  const detail = [
    `source=${source}`,
    `message=${message}`,
    stack ? `stack=${stack}` : '',
    componentStack ? `componentStack=${componentStack}` : '',
  ]
    .filter(Boolean)
    .join(' | ')

  logError('[renderer-error]', detail)
}
