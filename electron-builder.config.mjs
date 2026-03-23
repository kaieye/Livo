import { resolve } from 'node:path'

import { getBuildTimestamp, getGitCommitHash } from './scripts/build/metadata.mjs'

const buildCommit = getGitCommitHash()
const buildTime = getBuildTimestamp()

export default {
  appId: 'com.livo.app',
  productName: 'Livo',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  asar: true,
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
  },
}
