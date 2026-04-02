import type { AccountProvider, AccountSelfCheckResult, AccountSelfCheckRow } from '../models/LivoModels';
import { AccountSessionService } from "@bundle:com.livo.harmony/entry/ets/common/services/AccountSessionService";
const SELF_CHECK_PROVIDERS: AccountProvider[] = ['youtube', 'x', 'instagram', 'bilibili'];
export class AccountSelfCheckService {
    static async run(): Promise<AccountSelfCheckResult> {
        const rows: AccountSelfCheckRow[] = [];
        let passed: number = 0;
        for (const provider of SELF_CHECK_PROVIDERS) {
            try {
                const status = await AccountSessionService.status(provider);
                const pass = status.linked && status.displayName.length > 0 && status.error.length === 0;
                if (pass) {
                    passed += 1;
                }
                const row: AccountSelfCheckRow = {
                    name: AccountSelfCheckService.providerLabel(provider),
                    pass,
                    detail: pass
                        ? `通过: ${status.displayName}`
                        : (status.error || (status.linked ? '已关联但未获取到账号名' : '未关联')),
                };
                rows.push(row);
            }
            catch (error) {
                const row: AccountSelfCheckRow = {
                    name: AccountSelfCheckService.providerLabel(provider),
                    pass: false,
                    detail: error instanceof Error ? error.message : '状态检查失败',
                };
                rows.push(row);
            }
        }
        const result: AccountSelfCheckResult = {
            summary: passed === rows.length
                ? `一键自检通过（${passed}/${rows.length}）`
                : `一键自检未通过（${passed}/${rows.length}）`,
            rows,
        };
        return result;
    }
    private static providerLabel(provider: AccountProvider): string {
        switch (provider) {
            case 'youtube':
                return 'YouTube';
            case 'x':
                return 'X / Twitter';
            case 'instagram':
                return 'Instagram';
            case 'bilibili':
                return 'Bilibili';
            default:
                return provider;
        }
    }
}
