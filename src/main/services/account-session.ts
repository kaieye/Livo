import type { AccountSessionState } from "../../shared/types"
import { getAccountState } from "./account-auth"

export async function getYouTubeAccountState(): Promise<AccountSessionState> {
  return getAccountState("youtube")
}
