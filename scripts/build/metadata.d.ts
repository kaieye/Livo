declare module './metadata.mjs' {
  export function getGitCommitHash(): string
  export function getBuildTimestamp(): string
}
