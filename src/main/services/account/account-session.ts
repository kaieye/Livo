import type { AccountSessionState } from '../../../shared/types/index'
import { getAccountState } from './account-auth'

export async function getYouTubeAccountState(): Promise<AccountSessionState> {
  return getAccountState('youtube')
}
