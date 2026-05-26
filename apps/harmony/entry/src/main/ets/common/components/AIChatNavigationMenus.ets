import { HdsNavigationMenuContentOptions } from '@kit.UIDesignKit'

export function buildAIChatTitleMenus(
  onNewConversation: () => void,
  onOpenHistory: () => void,
  onOpenSettings: () => void,
): HdsNavigationMenuContentOptions {
  return {
    value: [
      {
        content: {
          label: '新对话',
          icon: $r('sys.symbol.plus'),
          isEnabled: true,
          action: onNewConversation,
        },
      },
      {
        content: {
          label: '历史对话',
          icon: $r('sys.symbol.arrow_counterclockwise_clock'),
          isEnabled: true,
          action: onOpenHistory,
        },
      },
      {
        content: {
          label: 'AI助手设置',
          icon: $r('sys.symbol.gearshape'),
          isEnabled: true,
          action: onOpenSettings,
        },
      },
    ],
  }
}
