import type {
  AgentPermissionSettings,
  AgentTool,
  AgentToolArgs,
  AgentToolRun,
} from './AgentTypes.ts'
import { AgentToolRegistry } from './ToolRegistry.ts'
import { agentToolRegistryProvider } from './AgentToolRegistryProvider.ts'
import { agentToolResultToText } from './AgentToolResultText.ts'
import {
  buildAddFeedTool,
  buildGetFeedEntriesTool,
  buildListSubscribedFeedsTool,
  buildRefreshAllSubscriptionsTool,
  buildRefreshSubscriptionTool,
  buildRemoveSubscriptionTool,
} from './tools/feed/FeedAgentTools'
import {
  buildMarkAllReadTool,
  buildGetEntryDetailTool,
  buildGetTodayUpdatesTool,
  buildGetUnreadCountTool,
  buildViewStarredEntriesTool,
} from './tools/entry/EntryAgentTools'
import { buildWebSearchTool } from './tools/external/ExternalAgentTools'
import {
  buildAddBuiltinSubscriptionTool,
  buildListBuiltinFeedsTool,
} from './tools/discover/DiscoverAgentTools'
import {
  buildChangeAccentColorTool,
  buildGetSettingsTool,
  buildToggleThemeModeTool,
  buildUpdateAIFeatureSettingsTool,
  buildUpdateAIRuntimeSettingsTool,
  buildUpdateGeneralSettingsTool,
} from './tools/settings/SettingsAgentTools'
import {
  buildClearLocalCacheTool,
  buildClearRefreshLogTool,
  buildExportOpmlTool,
  buildImportOpmlTool,
  buildViewChatHistoryTool,
  buildViewRefreshLogTool,
} from './tools/data/DataAgentTools'
import {
  buildListAccountProvidersTool,
  buildOpenAccountLoginTool,
  buildRefreshAccountStatusTool,
  buildUnlinkAccountTool,
} from './tools/account/AccountAgentTools'
import {
  buildGoBackTool,
  buildOpenEntryDetailTool,
  buildOpenFeedDetailTool,
  buildOpenImageViewerTool,
  buildOpenRootTabTool,
  buildOpenSettingsPanelTool,
  buildOpenVideoPlayerTool,
} from './tools/navigation/NavigationAgentTools'

export function buildAllAgentTools(): AgentTool[] {
  return [
    buildListSubscribedFeedsTool(),
    buildGetFeedEntriesTool(),
    buildGetTodayUpdatesTool(),
    buildGetEntryDetailTool(),
    buildGetUnreadCountTool(),
    buildWebSearchTool(),
    buildAddFeedTool(),
    buildRemoveSubscriptionTool(),
    buildRefreshSubscriptionTool(),
    buildRefreshAllSubscriptionsTool(),
    buildListBuiltinFeedsTool(),
    buildAddBuiltinSubscriptionTool(),
    buildGetSettingsTool(),
    buildToggleThemeModeTool(),
    buildChangeAccentColorTool(),
    buildUpdateGeneralSettingsTool(),
    buildUpdateAIFeatureSettingsTool(),
    buildUpdateAIRuntimeSettingsTool(),
    buildViewStarredEntriesTool(),
    buildViewChatHistoryTool(),
    buildViewRefreshLogTool(),
    buildExportOpmlTool(),
    buildImportOpmlTool(),
    buildClearRefreshLogTool(),
    buildClearLocalCacheTool(),
    buildListAccountProvidersTool(),
    buildOpenAccountLoginTool(),
    buildUnlinkAccountTool(),
    buildRefreshAccountStatusTool(),
    buildMarkAllReadTool(),
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

export function normalizeDefaultAgentToolArgs(name: string, args: AgentToolArgs): AgentToolArgs {
  const next: AgentToolArgs = {}
  const keys = Object.keys(args)
  for (const key of keys) {
    const isAliasId = (name === 'get_feed_entries' || name === 'get_entry_detail') && key === 'id'
    if (!isAliasId) {
      next[key] = args[key]
    }
  }

  if (name === 'get_feed_entries' && !next['feedId'] && args['id']) {
    next['feedId'] = args['id']
  }
  if (name === 'get_entry_detail' && !next['entryId'] && args['id']) {
    next['entryId'] = args['id']
  }
  return next
}

export async function executeDefaultAgentToolCall(
  name: string,
  args: AgentToolArgs,
  confirmed: boolean = false,
): Promise<string> {
  const run = await executeDefaultAgentToolRun(name, args, confirmed)
  return agentToolResultToText(run.result)
}

export async function executeDefaultAgentToolRun(
  name: string,
  args: AgentToolArgs,
  confirmed: boolean = false,
  permissions?: AgentPermissionSettings,
): Promise<AgentToolRun> {
  return agentToolRegistryProvider.executeToolRun(
    name,
    normalizeDefaultAgentToolArgs(name, args),
    confirmed,
    permissions,
  )
}
