import type Want from "@ohos:app.ability.Want";
import { AppContextService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppContextService";
import { buildExternalUrlWant } from "@bundle:com.livo.harmony/entry/ets/common/utils/ExternalUrlWant";
function normalizeUrl(url: string): string {
    return (url || '').trim();
}
export class ExternalUrlService {
    static async open(url: string): Promise<void> {
        const normalized = normalizeUrl(url);
        if (!normalized) {
            throw new Error('未提供可打开的链接');
        }
        const want: Want = buildExternalUrlWant(normalized) as Want;
        try {
            await AppContextService.getContext().startAbility(want);
        }
        catch (error) {
            throw new Error(error instanceof Error ? error.message : '打开外部链接失败');
        }
    }
}
