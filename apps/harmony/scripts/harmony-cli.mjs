#!/usr/bin/env node

import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const projectName = '@livo/harmony'

const requiredFiles = [
  'build-profile.json5',
  'entry/build-profile.json5',
  'entry/src/main/module.json5',
  'AppScope/app.json5',
]

function printTitle(title) {
  console.log(`\n== ${title} ==`)
}

function candidateStudioPaths() {
  return [
    process.env.DEVECO_STUDIO_HOME
      ? join(process.env.DEVECO_STUDIO_HOME, 'bin', 'devecostudio.bat')
      : '',
    'D:\\Program Files\\Huawei\\DevEco Studio\\bin\\devecostudio.bat',
    'C:\\Program Files\\Huawei\\DevEco Studio\\bin\\devecostudio.bat',
    `${process.env.ProgramFiles || 'C:\\Program Files'}\\Huawei\\DevEco Studio\\bin\\devecostudio.bat`,
    `${process.env.LOCALAPPDATA || ''}\\Programs\\DevEco Studio\\bin\\devecostudio.bat`,
  ].filter(Boolean)
}

function findExistingPath(paths) {
  return paths.find((item) => existsSync(item)) || null
}

function toShortWindowsPath(targetPath) {
  if (process.platform !== 'win32') {
    return targetPath
  }

  try {
    const output = execSync(`for %I in ("${targetPath}") do @echo %~sI`, {
      cwd: appRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: true,
    })
      .toString()
      .trim()

    return output || targetPath
  } catch {
    return targetPath
  }
}

function findStudio() {
  return findExistingPath(candidateStudioPaths())
}

function candidateSdkHomes(studioPath) {
  const studioRoot = studioPath ? resolve(studioPath, '..', '..') : null
  return [
    process.env.DEVECO_SDK_HOME || '',
    process.env.OHOS_SDK_HOME || '',
    studioRoot ? join(studioRoot, 'sdk', 'default') : '',
    `${process.env.LOCALAPPDATA || ''}\\Huawei\\Sdk`,
  ].filter(Boolean)
}

function normalizeSdkHome(rawPath) {
  if (!rawPath || !existsSync(rawPath)) {
    return null
  }

  const openHarmony = join(rawPath, 'openharmony')
  if (existsSync(openHarmony)) {
    return rawPath
  }

  const nested = join(rawPath, 'default')
  if (existsSync(join(nested, 'openharmony'))) {
    return nested
  }

  const children = readdirSync(rawPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rawPath, entry.name))

  return children.find((item) => existsSync(join(item, 'openharmony'))) || null
}

function findSdkHome(studioPath) {
  for (const candidate of candidateSdkHomes(studioPath)) {
    const normalized = normalizeSdkHome(candidate)
    if (normalized) {
      return normalized
    }
  }

  return null
}

function findHvigorw(studioPath) {
  if (!studioPath) {
    return null
  }

  const studioRoot = resolve(studioPath, '..', '..')
  const hvigorw = join(studioRoot, 'tools', 'hvigor', 'bin', 'hvigorw.bat')
  return existsSync(hvigorw) ? hvigorw : null
}

function findHdc(sdkHome) {
  if (!sdkHome) {
    return null
  }

  const hdc = join(sdkHome, 'openharmony', 'toolchains', 'hdc.exe')
  return existsSync(hdc) ? hdc : null
}

function toEnvSdkHome(sdkHome) {
  if (!sdkHome) {
    return null
  }

  const normalized = sdkHome.replace(/[\\/]+$/, '')
  if (normalized.endsWith('\\default') || normalized.endsWith('/default')) {
    return resolve(normalized, '..')
  }

  return normalized
}

function buildEnv() {
  const studio = findStudio()
  const sdkHome = findSdkHome(studio)
  const envSdkHome = toEnvSdkHome(sdkHome)
  const hvigorw = findHvigorw(studio)
  const hdc = findHdc(sdkHome)
  const nodeHome = dirname(process.execPath)
  const nodeHomeForEnv = toShortWindowsPath(nodeHome)
  const system32 = process.env.SystemRoot
    ? join(process.env.SystemRoot, 'System32')
    : 'C:\\Windows\\System32'
  const cmdPath = join(system32, 'cmd.exe')

  const env = { ...process.env }
  const pathKey = Object.prototype.hasOwnProperty.call(env, 'Path')
    ? 'Path'
    : 'PATH'
  const existingPath = env[pathKey] || env.PATH || env.Path || ''
  const pathSegments = existingPath.split(delimiter).filter(Boolean)
  const prependUniquePath = (targetPath) => {
    if (!targetPath) {
      return
    }
    const normalizedTarget = targetPath.toLowerCase()
    const hasTarget = pathSegments.some(
      (segment) => segment.toLowerCase() === normalizedTarget,
    )
    if (!hasTarget) {
      pathSegments.unshift(targetPath)
    }
  }

  env.NODE_HOME = env.NODE_HOME || nodeHomeForEnv
  prependUniquePath(system32)
  prependUniquePath(nodeHome)
  if (envSdkHome) {
    env.DEVECO_SDK_HOME = envSdkHome
    env.OHOS_SDK_HOME = envSdkHome
  }
  if (hdc) {
    const toolchainDir = dirname(hdc)
    prependUniquePath(toolchainDir)
  }
  env.ComSpec = env.ComSpec || cmdPath
  env.PATH = pathSegments.join(delimiter)
  env.Path = env.PATH

  return { studio, sdkHome, envSdkHome, hvigorw, hdc, env }
}

function checkRequiredFiles() {
  return requiredFiles.map((file) => ({
    file,
    exists: existsSync(join(appRoot, file)),
  }))
}

function hasSdkComponents(sdkHome) {
  if (!sdkHome) {
    return false
  }

  return [
    join(sdkHome, 'openharmony'),
    join(sdkHome, 'openharmony', 'toolchains'),
    join(sdkHome, 'openharmony', 'ets'),
  ].every((path) => existsSync(path))
}

function runDoctor() {
  const { studio, sdkHome, envSdkHome, hvigorw, hdc } = buildEnv()
  printTitle(`${projectName} doctor`)

  console.log(`Project: ${appRoot}`)
  console.log(`DevEco Studio: ${studio || 'not found'}`)
  console.log(`DEVECO_SDK_HOME: ${sdkHome || 'not found'}`)
  console.log(`DEVECO_SDK_HOME(env): ${envSdkHome || 'not found'}`)
  console.log(`hvigorw: ${hvigorw || 'not found'}`)
  console.log(`hdc: ${hdc || 'not found'}`)

  printTitle('Project Files')
  for (const item of checkRequiredFiles()) {
    console.log(`${item.exists ? 'OK ' : 'MISS'} ${item.file}`)
  }

  printTitle('SDK Check')
  console.log(
    hasSdkComponents(sdkHome)
      ? 'OK SDK core directories found'
      : 'MISS SDK components incomplete',
  )

  if (!studio) {
    console.log(
      '\nSuggestion: install DevEco Studio or set DEVECO_STUDIO_HOME.',
    )
  }
  if (!sdkHome) {
    console.log('Suggestion: set DEVECO_SDK_HOME to the Harmony SDK root.')
  } else if (!hasSdkComponents(sdkHome)) {
    console.log(
      'Suggestion: open DevEco Studio SDK Manager and complete the OpenHarmony SDK installation.',
    )
  }
}

function runPrepare() {
  runDoctor()
  printTitle('Install Dependencies')
  execSync('pnpm install', {
    cwd: appRoot,
    stdio: 'inherit',
    env: process.env,
  })
}

function openStudio() {
  const { studio } = buildEnv()
  if (!studio) {
    throw new Error(
      'DevEco Studio not found. Run `pnpm --dir apps/harmony doctor` first.',
    )
  }

  spawnSync(studio, [appRoot], {
    cwd: appRoot,
    stdio: 'inherit',
    shell: true,
  })
}

function runHvigor(taskName, extraArgs = []) {
  const { hvigorw, env, sdkHome } = buildEnv()
  if (!hvigorw) {
    throw new Error(
      'hvigorw not found. Run `pnpm --dir apps/harmony doctor` first.',
    )
  }
  if (!sdkHome || !hasSdkComponents(sdkHome)) {
    throw new Error(
      'Harmony SDK is incomplete. Open DevEco Studio SDK Manager first.',
    )
  }

  const command = [
    `"${hvigorw}"`,
    taskName,
    '--mode',
    'module',
    '--no-daemon',
    ...extraArgs,
  ].join(' ')

  execSync(command, {
    cwd: appRoot,
    stdio: 'inherit',
    env,
    shell: true,
  })
}

function findDebugHap() {
  const candidates = [
    join(
      appRoot,
      'entry',
      'build',
      'default',
      'outputs',
      'default',
      'entry-default-signed.hap',
    ),
    join(
      appRoot,
      'entry',
      'build',
      'outputs',
      'default',
      'entry-default-signed.hap',
    ),
    join(
      appRoot,
      'entry',
      'build',
      'default',
      'outputs',
      'default',
      'entry-default-unsigned.hap',
    ),
    join(
      appRoot,
      'entry',
      'build',
      'outputs',
      'default',
      'entry-default-unsigned.hap',
    ),
  ]

  return candidates.find((item) => existsSync(item)) || null
}

function installDebug() {
  const { hdc, env } = buildEnv()
  if (!hdc) {
    throw new Error(
      'hdc not found. Run `pnpm --dir apps/harmony doctor` first.',
    )
  }

  const hap = findDebugHap()
  if (!hap) {
    throw new Error(
      'Debug HAP not found. Run `pnpm --dir apps/harmony build:debug` first.',
    )
  }

  execFileSync(hdc, ['install', '-r', hap], {
    cwd: appRoot,
    stdio: 'inherit',
    env,
  })
}

function runDebug() {
  const { hdc, env } = buildEnv()
  if (!hdc) {
    throw new Error(
      'hdc not found. Run `pnpm --dir apps/harmony doctor` first.',
    )
  }

  execFileSync(
    hdc,
    ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'com.chos1nz.livo'],
    {
      cwd: appRoot,
      stdio: 'inherit',
      env,
    },
  )
}

function main() {
  const command = process.argv[2] || 'doctor'

  switch (command) {
    case 'doctor':
      runDoctor()
      break
    case 'prepare':
      runPrepare()
      break
    case 'studio':
      openStudio()
      break
    case 'build:debug':
      runHvigor('assembleHap')
      break
    case 'build:release':
      runHvigor('assembleApp', ['-p', 'buildMode=release'])
      break
    case 'install:debug':
      installDebug()
      break
    case 'run:debug':
      runDebug()
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

try {
  main()
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\n[harmony-cli] ${message}`)
  process.exit(1)
}
