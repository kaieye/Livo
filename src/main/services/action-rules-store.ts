import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { ActionRule } from '../../shared/actions'

let cachedRules: ActionRule[] | null = null

function getRulesPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data', 'action-rules.json')
}

function sanitizeRules(input: unknown): ActionRule[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (rule): rule is ActionRule =>
      !!rule &&
      typeof rule === 'object' &&
      typeof (rule as ActionRule).id === 'string' &&
      Array.isArray((rule as ActionRule).conditions) &&
      Array.isArray((rule as ActionRule).actions),
  )
}

export function getActionRules(): ActionRule[] {
  if (cachedRules) return cachedRules

  const rulesPath = getRulesPath()
  if (!existsSync(rulesPath)) {
    cachedRules = []
    return cachedRules
  }

  try {
    cachedRules = sanitizeRules(JSON.parse(readFileSync(rulesPath, 'utf-8')))
  } catch {
    cachedRules = []
  }
  return cachedRules
}

export function setActionRules(rules: ActionRule[]): void {
  const sanitized = sanitizeRules(rules)
  cachedRules = sanitized

  const rulesPath = getRulesPath()
  const dir = join(rulesPath, '..')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(rulesPath, JSON.stringify(sanitized, null, 2))
}
