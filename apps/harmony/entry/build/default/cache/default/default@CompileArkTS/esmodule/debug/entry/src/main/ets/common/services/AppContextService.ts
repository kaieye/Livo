import type common from "@ohos:app.ability.common";
export class AppContextService {
    private static context: common.UIAbilityContext | null = null;
    static setContext(context: common.UIAbilityContext): void {
        AppContextService.context = context;
    }
    static getContext(): common.UIAbilityContext {
        if (!AppContextService.context) {
            throw new Error('Harmony application context has not been initialized');
        }
        return AppContextService.context;
    }
}
