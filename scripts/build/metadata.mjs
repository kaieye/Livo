import { execSync } from 'node:child_process'

function runGit(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export function getGitCommitHash() {
  return runGit('git rev-parse --short HEAD') || 'unknown'
}

export function getBuildTimestamp() {
  return new Date().toISOString()
}
