/**
 * Zustand store for managing automation rules (Actions).
 */
import { createAppStore } from './helpers'
import type { ActionRule } from '../../../shared/actions'

interface ActionsState {
  rules: ActionRule[]
  isLoaded: boolean

  // CRUD
  loadRules: () => Promise<void>
  addRule: (rule: ActionRule) => Promise<void>
  updateRule: (id: string, updates: Partial<ActionRule>) => Promise<void>
  removeRule: (id: string) => Promise<void>
  toggleRule: (id: string) => Promise<void>
  reorderRules: (ruleIds: string[]) => Promise<void>

  // Import/Export
  exportRules: () => string
  importRules: (json: string) => Promise<{ imported: number; errors: string[] }>
}

const STORAGE_KEY = 'livo-action-rules'

function loadFromStorage(): ActionRule[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    /* ignore */
  }
  return []
}

function saveToStorage(rules: ActionRule[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export const useActionsStore = createAppStore<ActionsState>((set, get) => ({
  rules: [],
  isLoaded: false,

  loadRules: async () => {
    const rules = loadFromStorage()
    set({ rules, isLoaded: true })
  },

  addRule: async (rule) => {
    const rules = [...get().rules, rule]
    saveToStorage(rules)
    set({ rules })
  },

  updateRule: async (id, updates) => {
    const rules = get().rules.map((r) =>
      r.id === id ? { ...r, ...updates } : r,
    )
    saveToStorage(rules)
    set({ rules })
  },

  removeRule: async (id) => {
    const rules = get().rules.filter((r) => r.id !== id)
    saveToStorage(rules)
    set({ rules })
  },

  toggleRule: async (id) => {
    const rules = get().rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    )
    saveToStorage(rules)
    set({ rules })
  },

  reorderRules: async (ruleIds) => {
    const ruleMap = new Map(get().rules.map((r) => [r.id, r]))
    const rules = ruleIds.map((id) => ruleMap.get(id)!).filter(Boolean)
    saveToStorage(rules)
    set({ rules })
  },

  exportRules: () => {
    return JSON.stringify(get().rules, null, 2)
  },

  importRules: async (json) => {
    try {
      const imported = JSON.parse(json) as ActionRule[]
      if (!Array.isArray(imported)) throw new Error('Invalid format')

      const errors: string[] = []
      const valid: ActionRule[] = []

      for (const rule of imported) {
        if (
          !rule.id ||
          !rule.name ||
          !Array.isArray(rule.conditions) ||
          !Array.isArray(rule.actions)
        ) {
          errors.push(`Invalid rule: ${rule.name || 'unknown'}`)
          continue
        }
        // Assign new ID to avoid conflicts
        valid.push({
          ...rule,
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2),
        })
      }

      const rules = [...get().rules, ...valid]
      saveToStorage(rules)
      set({ rules })
      return { imported: valid.length, errors }
    } catch (err) {
      return { imported: 0, errors: [String(err)] }
    }
  },
}))
