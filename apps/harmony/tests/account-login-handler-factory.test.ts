import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import * as ts from 'typescript'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.ets')) {
      return {
        url: new URL(specifier, context.parentURL).href,
        shortCircuit: true,
      }
    }

    const resolved = nextResolve(specifier, context)
    return {
      ...resolved,
      shortCircuit: true,
    }
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ets')) {
      const source = readFileSync(new URL(url), 'utf8')
      const transformed = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        },
        fileName: new URL(url).pathname,
      }).outputText

      return {
        format: 'module',
        shortCircuit: true,
        source: transformed,
      }
    }

    const loaded = nextLoad(url, context)
    return {
      ...loaded,
      shortCircuit: true,
    }
  },
})

const { createAccountLoginHandler } =
  await import('../entry/src/main/ets/common/services/account-login/AccountLoginHandlerFactory.ets')

test('createAccountLoginHandler returns a handler with the requested provider', () => {
  assert.equal(createAccountLoginHandler('bilibili').provider, 'bilibili')
  assert.equal(createAccountLoginHandler('youtube').provider, 'youtube')
  assert.equal(createAccountLoginHandler('x').provider, 'x')
})
