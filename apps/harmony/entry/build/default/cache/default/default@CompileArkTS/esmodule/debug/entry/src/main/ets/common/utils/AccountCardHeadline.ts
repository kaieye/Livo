export function accountCardHeadlineStatus(linked: boolean, displayName: string, error: string): string {
    if (linked) {
        return (displayName || '').trim() || '已关联';
    }
    if ((error || '').trim()) {
        return '需处理';
    }
    return '未关联';
}
