import { resolve } from 'node:path'

import {
  getBuildTimestamp,
  getGitCommitHash,
} from '../scripts/build/metadata.mjs'

const buildCommit = getGitCommitHash()
const buildTime = getBuildTimestamp()

export default {
  appId: 'com.livo.app',
  productName: 'Livo',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  asar: true,
  // electron-builder resolves hook string paths via path.resolve() against the
  // project root (cwd), not this config file — so keep './', unlike the import above.
  afterPack: './scripts/build/after-pack.mjs',
  electronLanguages: ['en-US', 'zh-CN'],
  extraMetadata: {
    buildCommit,
    buildTime,
  },
  directories: {
    output: 'dist',
  },
  files: ['out/**/*'],
  extraResources: [{ from: 'resources', to: 'resources' }],
  electronDist: resolve('node_modules/electron/dist'),
  protocols: [
    {
      name: 'Livo',
      schemes: ['livo'],
    },
  ],
  publish: [
    {
      provider: 'github',
      owner: 'kaieye',
      repo: 'Livo',
      releaseType: 'draft',
    },
  ],
  win: {
    target: ['nsis'],
    signAndEditExecutable: false,
  },
  mac: {
    target: ['dmg'],
    category: 'public.app-category.news',
  },
  linux: {
    target: ['AppImage'],
    category: 'News',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    allowElevation: true,
    installerIcon: 'resources/icon.ico',
    uninstallerIcon: 'resources/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Livo',
    include: 'build/installer.nsh',
    warningsAsErrors: false,
    runAfterFinish: true,
    perMachine: false,
    deleteAppDataOnUninstall: false,
    menuCategory: false,
  },
}
