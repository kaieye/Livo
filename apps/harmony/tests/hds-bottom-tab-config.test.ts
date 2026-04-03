import test from 'node:test'
import assert from 'node:assert/strict'

import {
  resolveHdsBottomTabItems,
  rootTabIdToHdsIndex,
  hdsIndexToRootTabId,
  resolveAdaptiveMaterialLevel,
  resolveHdsBottomTabBarBottomMargin,
} from '../entry/src/main/ets/common/utils/HdsBottomTabConfig.ts'

test('resolveHdsBottomTabItems keeps the existing root tab order and labels', () => {
  assert.deepEqual(
    resolveHdsBottomTabItems().map((item) => ({
      id: item.id,
      label: item.label,
    })),
    [
      { id: 'home', label: '首页' },
      { id: 'subscriptions', label: '订阅' },
      { id: 'discover', label: '发现' },
      { id: 'settings', label: '设置' },
    ],
  )
})

test('rootTabIdToHdsIndex maps root tabs to stable HDS tab indices', () => {
  assert.equal(rootTabIdToHdsIndex('home'), 0)
  assert.equal(rootTabIdToHdsIndex('subscriptions'), 1)
  assert.equal(rootTabIdToHdsIndex('discover'), 2)
  assert.equal(rootTabIdToHdsIndex('settings'), 3)
})

test('hdsIndexToRootTabId falls back to home for invalid indices', () => {
  assert.equal(hdsIndexToRootTabId(0), 'home')
  assert.equal(hdsIndexToRootTabId(2), 'discover')
  assert.equal(hdsIndexToRootTabId(99), 'home')
})

test('resolveAdaptiveMaterialLevel keeps the HDS bottom bar on system adaptive material', () => {
  assert.equal(
    resolveAdaptiveMaterialLevel(['IMMERSIVE', 'ADAPTIVE']),
    'ADAPTIVE',
  )
})

test('resolveAdaptiveMaterialLevel stays adaptive even when immersive capability is absent', () => {
  assert.equal(resolveAdaptiveMaterialLevel(['ADAPTIVE']), 'ADAPTIVE')
  assert.equal(resolveAdaptiveMaterialLevel([]), 'ADAPTIVE')
})

test('resolveHdsBottomTabBarBottomMargin keeps the floating offset aligned with the current dock spacing', () => {
  assert.equal(resolveHdsBottomTabBarBottomMargin(18), 28)
})
