import { execFileSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import BetterSqlite3 from 'better-sqlite3'
import type Database from 'better-sqlite3'

/**
 * Test-only helper for opening a real better-sqlite3 database under vitest.
 *
 * The repository ships a prebuilt `better_sqlite3.node` compiled against
 * Electron's Node ABI. When the test runner uses system Node with a different
 * ABI (or the running Electron app holds a lock on the canonical binary),
 * `new BetterSqlite3()` throws a NODE_MODULE_VERSION mismatch. To keep the
 * characterization tests reliable across both setups, we lazily resolve a
 * matching native binding for the *current* Node ABI into an OS temp cache and
 * pass it via the `nativeBinding` option. When the default binding already
 * matches (e.g. CI running under the same ABI) no extra work is done.
 */

let cachedBinding: string | null | undefined

function bsq3Dir(): string {
  const require = createRequire(import.meta.url)
  return dirname(require.resolve('better-sqlite3/package.json'))
}

function isAbiMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /NODE_MODULE_VERSION|was compiled against a different Node\.js version/i.test(
    message,
  )
}

function resolveMatchingBinding(): string | null {
  if (cachedBinding !== undefined) return cachedBinding

  const cacheRoot = join(
    tmpdir(),
    `livo-bsq3-abi-${process.versions.modules}-${process.arch}`,
  )
  const cachedFile = join(cacheRoot, 'build', 'Release', 'better_sqlite3.node')

  if (!existsSync(cachedFile)) {
    const bsq3 = bsq3Dir()
    // prebuild-install chdir()s into --path and reads package.json/binding.gyp
    // from there, so the target must exist and carry that metadata before we
    // invoke it (the canonical build/Release file may be locked by a running
    // Electron app, hence we materialize an ABI-matched copy off to the side).
    mkdirSync(cacheRoot, { recursive: true })
    copyFileSync(join(bsq3, 'package.json'), join(cacheRoot, 'package.json'))
    const gyp = join(bsq3, 'binding.gyp')
    if (existsSync(gyp)) copyFileSync(gyp, join(cacheRoot, 'binding.gyp'))

    // Under pnpm's flat layout prebuild-install is a sibling package of
    // better-sqlite3 (../prebuild-install). Fall back to a normal resolve for
    // hoisted/npm layouts.
    const candidates = [
      join(bsq3, '..', 'prebuild-install', 'bin.js'),
      join(bsq3, 'node_modules', 'prebuild-install', 'bin.js'),
    ]
    let prebuildInstall = candidates.find((p) => existsSync(p))
    if (!prebuildInstall) {
      const require = createRequire(import.meta.url)
      prebuildInstall = require.resolve('prebuild-install/bin.js')
    }
    execFileSync(process.execPath, [prebuildInstall, '--path', cacheRoot], {
      cwd: cacheRoot,
      stdio: 'ignore',
    })
  }

  cachedBinding = existsSync(cachedFile) ? cachedFile : null
  return cachedBinding
}

export function createInMemoryDatabase(): Database.Database {
  try {
    return new BetterSqlite3(':memory:')
  } catch (error) {
    if (!isAbiMismatch(error)) throw error
    const nativeBinding = resolveMatchingBinding()
    if (!nativeBinding) throw error
    return new BetterSqlite3(':memory:', { nativeBinding })
  }
}

/**
 * Best-effort preflight used to skip the suite when no usable native binding
 * can be produced (e.g. offline CI with no matching prebuild). Tests that need
 * a real DB should gate on this so the suite never falsely passes.
 */
export function canOpenSqliteDatabase(): boolean {
  try {
    const db = createInMemoryDatabase()
    db.close()
    return true
  } catch {
    return false
  }
}
