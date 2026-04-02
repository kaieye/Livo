export type HomeSubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos';
export type HomeVideoSceneKind = 'list' | 'grid';
export interface HomeVideoCardMetaTarget {
    feedTitle: string;
    author: string;
    publishedLabel: string;
}
export interface HomeVideoCardThemeTarget {
    isDark: boolean;
    elevated: string;
    textPrimary: string;
    textSecondary: string;
}
export interface HomeVideoCardTokens {
    placeholderBackground: string;
    titleColor: string;
    metaColor: string;
}
export function resolveHomeVideoSceneKind(mode: HomeSubscriptionMode): HomeVideoSceneKind {
    return mode === 'videos' ? 'grid' : 'list';
}
export function resolveHomeVideoGridColumns(): number {
    return 2;
}
export function resolveHomeVideoCardSubtitle(target: HomeVideoCardMetaTarget): string {
    const feedTitle = (target.feedTitle || '').trim();
    if (feedTitle) {
        return feedTitle;
    }
    const author = (target.author || '').trim();
    if (author) {
        return author;
    }
    return (target.publishedLabel || '').trim();
}
export function resolveHomeVideoCardTokens(target: HomeVideoCardThemeTarget): HomeVideoCardTokens {
    return {
        placeholderBackground: target.elevated,
        titleColor: target.textPrimary,
        metaColor: target.textSecondary,
    };
}
export interface HomeVideoGridEntryLike {
    id: string;
}
export function chunkHomeVideoEntries<T extends HomeVideoGridEntryLike>(entries: T[], columns: number = resolveHomeVideoGridColumns()): T[][] {
    const normalizedColumns = columns > 0 ? columns : 1;
    const result: T[][] = [];
    for (let index = 0; index < entries.length; index += normalizedColumns) {
        result.push(entries.slice(index, index + normalizedColumns));
    }
    return result;
}
