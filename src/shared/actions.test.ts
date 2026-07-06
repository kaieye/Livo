import { describe, expect, it } from 'vitest'
import {
  evaluateActionRules,
  evaluateActionRulesWithMatcher,
  evaluateActionRulesWithMatcherAsync,
  isSafeActionRegexPattern,
  isSemanticCondition,
  sanitizeActionRules,
  type ActionRule,
} from './actions'

const entry = {
  title: 'AI weekly digest',
  content: 'A long article about language models',
  author: 'Editor',
  url: 'https://example.com/post',
}

const feed = {
  title: 'Tech Notes',
  url: 'https://example.com/feed.xml',
  category: 'Tech',
}

function makeRule(partial: Partial<ActionRule>): ActionRule {
  return {
    id: partial.id || 'rule-1',
    name: partial.name || 'rule',
    enabled: partial.enabled ?? true,
    conditions: partial.conditions || [
      { field: 'entry.title', operator: 'contains', value: 'AI' },
    ],
    actions: partial.actions || [],
    createdAt: partial.createdAt || 1,
  }
}

describe('evaluateActionRules', () => {
  it('deduplicates effects and collapses storage flags', () => {
    const decision = evaluateActionRules(
      [
        makeRule({
          id: 'a',
          actions: [{ type: 'star' }, { type: 'notify' }],
        }),
        makeRule({
          id: 'b',
          actions: [
            { type: 'notify' },
            { type: 'mark_read' },
            { type: 'summarize' },
          ],
        }),
      ],
      entry,
      feed,
    )

    expect(decision).toEqual({
      blocked: false,
      star: true,
      markRead: true,
      effects: ['star', 'notify', 'mark_read', 'summarize'],
    })
  })

  it('ignores disabled rules and invalid regex conditions', () => {
    const decision = evaluateActionRules(
      [
        makeRule({
          enabled: false,
          actions: [{ type: 'block' }],
        }),
        makeRule({
          conditions: [
            { field: 'entry.title', operator: 'matches_regex', value: '[' },
          ],
          actions: [{ type: 'block' }],
        }),
      ],
      entry,
      feed,
    )

    expect(decision.blocked).toBe(false)
    expect(decision.effects).toEqual([])
  })

  it('keeps semantic conditions out of the sync evaluator', () => {
    const rule = makeRule({
      conditions: [
        {
          field: 'ai.semantic',
          operator: 'semantic_matches',
          value: '报道大模型产品进展',
        },
      ],
      actions: [{ type: 'block' }],
    })

    expect(isSemanticCondition(rule.conditions[0])).toBe(true)
    expect(evaluateActionRules([rule], entry, feed).blocked).toBe(false)
  })
})

describe('sanitizeActionRules', () => {
  it('normalizes valid rules and drops malformed or unsafe rules', () => {
    const valid = makeRule({
      id: 'valid',
      name: 'Valid',
      conditions: [
        { field: 'entry.title', operator: 'matches_regex', value: '^AI' },
      ],
      actions: [{ type: 'star' }, { type: 'notify' }],
    })

    expect(
      sanitizeActionRules([
        { ...valid, extra: 'ignored' },
        { ...valid, id: '', name: 'empty-id' },
        {
          ...valid,
          id: 'bad-field',
          conditions: [
            { field: 'entry.secret', operator: 'contains', value: 'token' },
          ],
        },
        {
          ...valid,
          id: 'bad-regex',
          conditions: [
            { field: 'entry.title', operator: 'matches_regex', value: '(a+)+' },
          ],
        },
        {
          ...valid,
          id: 'bad-action',
          actions: [{ type: 'exec_shell' }],
        },
      ]),
    ).toEqual([valid])
  })

  it('rejects unsafe regex patterns before evaluation', () => {
    expect(isSafeActionRegexPattern('^AI')).toBe(true)
    expect(isSafeActionRegexPattern('[')).toBe(false)
    expect(isSafeActionRegexPattern('(a+)+$')).toBe(false)

    const rule = makeRule({
      conditions: [
        { field: 'entry.title', operator: 'matches_regex', value: '(a+)+$' },
      ],
      actions: [{ type: 'block' }],
    })

    expect(evaluateActionRules([rule], entry, feed).blocked).toBe(false)
  })
})

describe('evaluateActionRulesWithMatcher', () => {
  it('shares the effect-folding logic with custom matchers', () => {
    const rules = [
      makeRule({
        id: 'ignored',
        actions: [{ type: 'block' }],
      }),
      makeRule({
        id: 'matched',
        actions: [
          { type: 'star' },
          { type: 'notify' },
          { type: 'notify' },
          { type: 'mark_read' },
        ],
      }),
    ]

    expect(
      evaluateActionRulesWithMatcher(rules, (rule) => rule.id === 'matched'),
    ).toEqual({
      blocked: false,
      star: true,
      markRead: true,
      effects: ['star', 'notify', 'mark_read'],
    })
  })

  it('supports async semantic matchers without duplicating decision folding', async () => {
    const decision = await evaluateActionRulesWithMatcherAsync(
      [
        makeRule({
          id: 'semantic',
          actions: [{ type: 'block' }, { type: 'summarize' }],
        }),
      ],
      async (rule) => rule.id === 'semantic',
    )

    expect(decision).toEqual({
      blocked: true,
      star: false,
      markRead: false,
      effects: ['block', 'summarize'],
    })
  })
})
