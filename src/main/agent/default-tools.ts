import type { AgentPermissionSettings, AgentTool } from '../../shared/types'
import { AgentToolRegistry } from './tool-registry'
import { agentToolRegistryProvider } from './registry-provider'
import {
  buildAddFeedTool,
  buildGetFeedEntriesTool,
  buildGetSessionOverviewTool,
  buildListSubscribedFeedsTool,
  buildRefreshAllSubscriptionsTool,
  buildRefreshSubscriptionTool,
  buildRemoveSubscriptionTool,
} from './tools/feed-tools'
import {
  buildGetEntryDetailTool,
  buildGetTodayUpdatesTool,
  buildGetUnreadCountTool,
  buildMarkAllReadTool,
  buildSearchAndOpenEntryTool,
  buildSearchEntriesTool,
  buildSetEntryReadStateTool,
  buildSetEntryStarredStateTool,
  buildViewStarredEntriesTool,
} from './tools/entry-tools'
import {
  buildGoBackTool,
  buildOpenEntryDetailTool,
  buildOpenFeedDetailTool,
  buildOpenImageViewerTool,
  buildOpenRootTabTool,
  buildOpenSettingsPanelTool,
  buildOpenVideoPlayerTool,
} from './tools/navigation-tools'
import {
  buildChangeAccentColorTool,
  buildGetSettingsTool,
  buildToggleThemeModeTool,
  buildUpdateAIRuntimeSettingsTool,
  buildUpdateGeneralSettingsTool,
  buildUpdateTranslationSettingsTool,
} from './tools/settings-tools'
import {
  buildAddBuiltinSubscriptionTool,
  buildListBuiltinFeedsTool,
} from './tools/discover-tools'
import {
  buildListAccountProvidersTool,
  buildOpenAccountLoginTool,
  buildRefreshAccountStatusTool,
  buildUnlinkAccountTool,
} from './tools/account-tools'
import {
  buildCleanupOldEntriesTool,
  buildClearRefreshLogTool,
  buildExportOpmlTool,
  buildViewRefreshLogTool,
} from './tools/data-tools'
import { buildWebSearchTool } from './tools/external-tools'
import {
  buildForgetPreferenceTool,
  buildRecallPreferenceTool,
  buildRememberPreferenceTool,
} from './tools/memory-tools'
import { buildSearchLivoKnowledgeTool } from './tools/rag-tools'

/** Build every agent tool exactly once. Used by the registry provider. */
export function buildAllAgentTools(): AgentTool[] {
  return [
    // Feed
    buildGetSessionOverviewTool(),
    buildListSubscribedFeedsTool(),
    buildGetFeedEntriesTool(),
    buildAddFeedTool(),
    buildRemoveSubscriptionTool(),
    buildRefreshSubscriptionTool(),
    buildRefreshAllSubscriptionsTool(),
    // Entry
    buildGetTodayUpdatesTool(),
    buildGetEntryDetailTool(),
    buildSearchEntriesTool(),
    buildSearchAndOpenEntryTool(),
    buildGetUnreadCountTool(),
    buildViewStarredEntriesTool(),
    buildSetEntryReadStateTool(),
    buildSetEntryStarredStateTool(),
    buildMarkAllReadTool(),
    // Discover
    buildListBuiltinFeedsTool(),
    buildAddBuiltinSubscriptionTool(),
    // Settings
    buildGetSettingsTool(),
    buildToggleThemeModeTool(),
    buildChangeAccentColorTool(),
    buildUpdateGeneralSettingsTool(),
    buildUpdateTranslationSettingsTool(),
    buildUpdateAIRuntimeSettingsTool(),
    // Data
    buildViewRefreshLogTool(),
    buildExportOpmlTool(),
    buildClearRefreshLogTool(),
    buildCleanupOldEntriesTool(),
    // Account
    buildListAccountProvidersTool(),
    buildRefreshAccountStatusTool(),
    buildOpenAccountLoginTool(),
    buildUnlinkAccountTool(),
    // Memory
    buildRecallPreferenceTool(),
    buildRememberPreferenceTool(),
    buildForgetPreferenceTool(),
    // Server knowledge
    buildSearchLivoKnowledgeTool(),
    // External
    buildWebSearchTool(),
    // Navigation
    buildOpenRootTabTool(),
    buildGoBackTool(),
    buildOpenEntryDetailTool(),
    buildOpenFeedDetailTool(),
    buildOpenSettingsPanelTool(),
    buildOpenVideoPlayerTool(),
    buildOpenImageViewerTool(),
  ]
}

agentToolRegistryProvider.setBuilder(buildAllAgentTools)

export function buildDefaultAgentToolRegistry(): AgentToolRegistry {
  return agentToolRegistryProvider.full()
}

export function buildAllowedAgentToolRegistry(
  permissions?: AgentPermissionSettings,
): AgentToolRegistry {
  return agentToolRegistryProvider.forPermissions(permissions)
}
