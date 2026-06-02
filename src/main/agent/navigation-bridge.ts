import type {
  AgentNavigationAction,
  AgentRootTab,
  AgentSettingsPanel,
} from '../../shared/types'
import { getEventBus } from '../services/event-bus'

export type { AgentNavigationAction, AgentRootTab, AgentSettingsPanel }

/**
 * Navigation tools run in the main process but the actual view switching lives
 * in the renderer (zustand stores + router). This bridge relays a structured
 * navigation intent to every window over the `agent:navigate` channel; the
 * renderer subscribes and performs the corresponding store action.
 */
export function dispatchAgentNavigation(action: AgentNavigationAction): void {
  getEventBus().send('agent:navigate', action)
}
