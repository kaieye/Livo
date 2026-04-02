export interface ArticleSourceBlock {
    type: 'paragraph' | 'image' | 'video';
    videoUrl: string;
}
export interface ArticleSourceTarget {
    articleUrl: string;
    siteUrl: string;
    contentBlocks: ArticleSourceBlock[];
}
export function resolveArticleSourceUrl(target: ArticleSourceTarget): string {
    const firstVideoUrl = (target.contentBlocks || []).find((block: ArticleSourceBlock) => block.type === 'video' && !!(block.videoUrl || '').trim())?.videoUrl ?? '';
    if (firstVideoUrl.trim()) {
        return firstVideoUrl.trim();
    }
    if ((target.articleUrl || '').trim()) {
        return target.articleUrl.trim();
    }
    return (target.siteUrl || '').trim();
}
