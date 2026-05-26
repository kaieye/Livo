/**
 * Centralized application configuration.
 *
 * Re-exports grouped sub-configs for backward compatibility.
 * New importers should prefer importing from the specific config files.
 */
export * from './config/NetworkConfig'
export * from './config/PlatformInstances'

// bilibiliSpaceReferer is a function — re-exported via PlatformInstances above.
