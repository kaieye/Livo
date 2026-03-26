#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

const appRoot = resolve(process.cwd())

execSync('pnpm run build:debug', {
  cwd: appRoot,
  stdio: 'inherit',
  shell: true,
})
