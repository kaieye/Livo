import { describe, expect, it } from 'vitest'
import {
  USER_OPERATION_CATALOG,
  USER_OPERATION_KEYS,
  getUserOperationDefinition,
} from './user-operations'

describe('USER_OPERATION_CATALOG', () => {
  it('defines every exported operation key', () => {
    const keys = Object.values(USER_OPERATION_KEYS)

    expect(Object.keys(USER_OPERATION_CATALOG).sort()).toEqual(keys.sort())
  })

  it('keeps operation definitions aligned with their keys', () => {
    for (const key of Object.values(USER_OPERATION_KEYS)) {
      const operation = getUserOperationDefinition(key)

      expect(operation.key).toBe(key)
      expect(operation.label).not.toHaveLength(0)
    }
  })
})
