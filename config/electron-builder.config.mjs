import {
  getBuildTimestamp,
  getGitCommitHash,
} from '../scripts/build/metadata.mjs'

const buildCommit = getGitCommitHash()
const buildTime = getBuildTimestamp()
const isMacRelease = process.env.LIVO_MAC_RELEASE === 'true'

export default {
  appId: 'com.livospace.cn',
  productName: 'Livo',
  copyright: 'Copyright © 2026 Livo',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  asar: true,
  forceCodeSigning: isMacRelease,
  asarUnpack: ['node_modules/better-sqlite3/build/Release/better_sqlite3.node'],
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
  extraResources: [
    {
      from: 'resources/yuanjiao-Livo.png',
      to: 'yuanjiao-Livo.png',
    },
    {
      from: 'resources/yuanjiao-Livo.ico',
      to: 'yuanjiao-Livo.ico',
    },
    {
      from: 'resources/tray.png',
      to: 'tray.png',
    },
  ],
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
    target: ['dir'],
    icon: 'resources/yuanjiao-Livo.ico',
    executableName: 'Livo',
  },
  mac: {
    target: ['dmg'],
    category: 'public.app-category.news',
    icon: 'resources/yuanjiao-Livo.icns',
    hardenedRuntime: true,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.inherit.plist',
    notarize: isMacRelease,
  },
  linux: {
    target: ['AppImage'],
    category: 'News',
  },
}
