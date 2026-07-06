import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionRule } from '../../../shared/actions'

const mocks = vi.hoisted(() => ({
  userDataPath: '',
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mocks.userDataPath),
  },
}))

function makeRule(partial: Partial<ActionRule> = {}): ActionRule {
  return {
    id: partial.id ?? 'rule-1',
    name: partial.name ?? 'Rule',
    enabled: partial.enabled ?? true,
    conditions: partial.conditions ?? [
      { field: 'entry.title', operator: 'contains', value: 'AI' },
    ],
    actions: partial.actions ?? [{ type: 'star' }],
    createdAt: partial.createdAt ?? 1,
  }
}

describe('action-rules-store', () => {
  beforeEach(() => {
    mocks.userDataPath = mkdtempSync(join(tmpdir(), 'livo-actions-test-'))
    vi.resetModules()
  })

  afterEach(() => {
    rmSync(mocks.userDataPath, { recursive: true, force: true })
  })

  it('drops malformed legacy rules when reading persisted action rules', async () => {
    const dataDir = join(mocks.userDataPath, 'data')
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(
      join(dataDir, 'action-rules.json'),
      JSON.stringify([
        makeRule({ id: 'valid' }),
        {
          id: 'bad-regex',
          name: 'Bad regex',
          enabled: true,
          conditions: [
            { field: 'entry.title', operator: 'matches_regex', value: '(a+)+' },
          ],
          actions: [{ type: 'star' }],
          createdAt: 1,
        },
        {
          id: 'bad-action',
          name: 'Bad action',
          enabled: true,
          conditions: [
            { field: 'entry.title', operator: 'contains', value: 'AI' },
          ],
          actions: [{ type: 'exec_shell' }],
          createdAt: 1,
        },
      ]),
      'utf-8',
    )

    const { getActionRules } = await import('./action-rules-store')

    expect(getActionRules()).toEqual([makeRule({ id: 'valid' })])
  })

  it('sanitizes and persists rules under the data directory', async () => {
    const { setActionRules } = await import('./action-rules-store')
    const valid = makeRule({ id: 'valid' })

    setActionRules([
      { ...valid, extra: 'ignored' },
      {
        ...valid,
        id: 'bad-condition',
        conditions: [
          { field: 'entry.secret', operator: 'contains', value: 'token' },
        ],
      },
    ] as unknown as ActionRule[])

    const rulesPath = join(mocks.userDataPath, 'data', 'action-rules.json')
    expect(existsSync(rulesPath)).toBe(true)
    expect(JSON.parse(readFileSync(rulesPath, 'utf-8'))).toEqual([valid])
  })
})
