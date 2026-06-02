import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { FeverAccount } from '../../../shared/types'

const FEVER_ACCOUNTS_KEY = ['fever', 'accounts']
const feverSyncStateKey = (id: string) => ['fever', 'sync-state', id]

export function useFeverAccountsQuery() {
  return useQuery({
    queryKey: FEVER_ACCOUNTS_KEY,
    queryFn: () => window.api.fever.listAccounts(),
  })
}

export function useFeverSyncStateQuery(accountId: string | undefined) {
  return useQuery({
    queryKey: feverSyncStateKey(accountId || ''),
    queryFn: () => window.api.fever.getSyncState(accountId!),
    enabled: !!accountId,
  })
}

export function useFeverCreateAccountMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      baseUrl: string
      username: string
      apiKey: string
    }) => window.api.fever.createAccount(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEVER_ACCOUNTS_KEY })
    },
  })
}

export function useFeverUpdateAccountMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: Partial<FeverAccount>
    }) => window.api.fever.updateAccount(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEVER_ACCOUNTS_KEY })
    },
  })
}

export function useFeverDeleteAccountMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.api.fever.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEVER_ACCOUNTS_KEY })
    },
  })
}

export function useFeverVerifyMutation() {
  return useMutation({
    mutationFn: (input: {
      baseUrl: string
      username: string
      apiKey: string
    }) => window.api.fever.verify(input.baseUrl, input.username, input.apiKey),
  })
}

export function useFeverSyncMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) => window.api.fever.sync(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEVER_ACCOUNTS_KEY })
      queryClient.invalidateQueries({ queryKey: ['fever', 'sync-state'] })
    },
  })
}
