import type { Rectangle } from 'electron'
import { app, screen } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { logWarn } from './logger'

export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  isMaximized: boolean
}

const DEFAULT_WINDOW_STATE: WindowState = {
  width: 1280,
  height: 800,
  x: 0,
  y: 0,
  isMaximized: false,
}

const MIN_WIDTH = 900
const MIN_HEIGHT = 600

function getWindowStatePath(): string {
  return join(app.getPath('userData'), 'data', 'window-state.json')
}

export function hasSavedWindowState(): boolean {
  return existsSync(getWindowStatePath())
}

function isWindowState(value: unknown): value is WindowState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return (
    typeof state.x === 'number' &&
    typeof state.y === 'number' &&
    typeof state.width === 'number' &&
    typeof state.height === 'number' &&
    typeof state.isMaximized === 'boolean'
  )
}

export function clampWindowBounds(
  bounds: Rectangle,
  displayBounds: Rectangle,
): Rectangle {
  const width = Math.min(
    Math.max(Math.floor(bounds.width), MIN_WIDTH),
    displayBounds.width,
  )
  const height = Math.min(
    Math.max(Math.floor(bounds.height), MIN_HEIGHT),
    displayBounds.height,
  )
  const maxX = displayBounds.x + displayBounds.width - width
  const maxY = displayBounds.y + displayBounds.height - height

  return {
    width,
    height,
    x: Math.min(Math.max(Math.floor(bounds.x), displayBounds.x), maxX),
    y: Math.min(Math.max(Math.floor(bounds.y), displayBounds.y), maxY),
  }
}

export function readWindowState(): WindowState {
  const statePath = getWindowStatePath()
  if (!existsSync(statePath)) return DEFAULT_WINDOW_STATE

  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf-8')) as unknown
    if (!isWindowState(parsed)) return DEFAULT_WINDOW_STATE
    const display = screen.getDisplayMatching(parsed)
    const clamped = clampWindowBounds(parsed, display.workArea)
    return { ...clamped, isMaximized: parsed.isMaximized }
  } catch (error) {
    logWarn('[window] failed to read window state', error)
    return DEFAULT_WINDOW_STATE
  }
}

export function persistWindowState(state: WindowState): void {
  try {
    const statePath = getWindowStatePath()
    const dir = join(statePath, '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(statePath, JSON.stringify(state, null, 2))
  } catch (error) {
    logWarn('[window] failed to persist window state', error)
  }
}
