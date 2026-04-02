export interface BilibiliStoredStateInput {
    linked: boolean;
    displayName: string;
    sessdata: string;
}
export interface BilibiliStoredStateResult {
    shouldTreatAsLinked: boolean;
    displayName: string;
}
export function resolveBilibiliStoredState(input: BilibiliStoredStateInput): BilibiliStoredStateResult {
    const normalizedDisplayName = (input.displayName || '').trim();
    const hasSessdata = !!(input.sessdata || '').trim();
    const shouldTreatAsLinked = input.linked || hasSessdata;
    return {
        shouldTreatAsLinked,
        displayName: shouldTreatAsLinked
            ? normalizedDisplayName || 'Bilibili 已关联'
            : '',
    };
}
