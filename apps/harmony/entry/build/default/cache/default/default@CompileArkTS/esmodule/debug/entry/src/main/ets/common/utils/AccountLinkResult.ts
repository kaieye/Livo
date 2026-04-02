export type AccountLinkResultProvider = 'youtube' | 'x' | 'instagram' | 'bilibili';
export interface AccountLinkStatusFields {
    linked: boolean;
    displayName: string;
    error: string;
}
export interface AccountLinkResultState {
    provider: AccountLinkResultProvider | '';
    displayName: string;
    linked: boolean;
}
export function mergeStatusWithAccountLinkResult(provider: AccountLinkResultProvider, current: AccountLinkStatusFields, fallbackTitle: string, linkResult: AccountLinkResultState): AccountLinkStatusFields {
    if (!linkResult.linked || linkResult.provider !== provider) {
        return current;
    }
    if (current.linked && !current.error) {
        return {
            linked: true,
            displayName: current.displayName ||
                linkResult.displayName ||
                `${fallbackTitle} 已关联`,
            error: '',
        };
    }
    return {
        linked: true,
        displayName: linkResult.displayName ||
            current.displayName ||
            `${fallbackTitle} 已关联`,
        error: '',
    };
}
