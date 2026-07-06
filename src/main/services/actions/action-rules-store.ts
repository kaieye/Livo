import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { sanitizeActionRules, type ActionRule } from '../../../shared/actions'

let cachedRules: ActionRule[] | null = null

function getRulesPath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'data', 'action-rules.json')
}

function sanitizeRules(input: unknown): ActionRule[] {
  return sanitizeActionRules(input)
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
  const dir = dirname(rulesPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(rulesPath, JSON.stringify(sanitized, null, 2))
}
