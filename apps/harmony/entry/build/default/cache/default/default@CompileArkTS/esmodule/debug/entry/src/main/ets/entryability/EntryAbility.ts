import type AbilityConstant from "@ohos:app.ability.AbilityConstant";
import type Want from "@ohos:app.ability.Want";
import UIAbility from "@ohos:app.ability.UIAbility";
import type window from "@ohos:window";
import { AppRepository } from "@bundle:com.livo.harmony/entry/ets/common/data/AppRepository";
import { AppContextService } from "@bundle:com.livo.harmony/entry/ets/common/services/AppContextService";
export default class EntryAbility extends UIAbility {
    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        console.info(`Livo EntryAbility onCreate: ${want.bundleName ?? ''}, ${launchParam.launchReason}`);
        AppContextService.setContext(this.context);
        void AppRepository.bootstrap().then(() => {
            console.info('Livo Harmony repositories initialized');
        }).catch((error: Error) => {
            console.error(`Failed to initialize Harmony repositories: ${error.message}`);
        });
    }
    onWindowStageCreate(windowStage: window.WindowStage): void {
        console.info('Livo EntryAbility onWindowStageCreate');
        windowStage.loadContent('pages/Index', (err) => {
            if (err.code) {
                console.error(`Failed to load content. Code: ${err.code}, message: ${err.message}`);
                return;
            }
            console.info('Livo Harmony home page loaded');
        });
    }
    onWindowStageDestroy(): void {
        console.info('Livo EntryAbility onWindowStageDestroy');
    }
    onDestroy(): void {
        console.info('Livo EntryAbility onDestroy');
    }
}
