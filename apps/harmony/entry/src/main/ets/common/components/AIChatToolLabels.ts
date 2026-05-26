export function aiChatToolLabelOf(name: string): string {
  switch (name) {
    case 'list_subscribed_feeds':
      return '查询订阅源'
    case 'get_feed_entries':
      return '获取文章列表'
    case 'get_today_updates':
      return '查询今日更新'
    case 'get_entry_detail':
      return '查看文章详情'
    case 'get_unread_count':
      return '统计未读'
    case 'web_search':
      return '网络搜索'
    case 'add_feed':
      return '添加订阅源'
    case 'remove_subscription':
      return '删除订阅源'
    case 'refresh_subscription':
      return '刷新订阅源'
    case 'refresh_all_subscriptions':
      return '刷新全部订阅'
    case 'list_builtin_feeds':
      return '查看推荐订阅源'
    case 'add_builtin_subscription':
      return '添加推荐订阅'
    case 'get_settings':
      return '查看设置'
    case 'toggle_theme_mode':
      return '切换主题'
    case 'change_accent_color':
      return '更改主题色'
    case 'update_general_settings':
      return '更新通用设置'
    case 'update_ai_feature_settings':
      return '更新 AI 功能'
    case 'update_ai_runtime_settings':
      return '更新 AI 配置'
    case 'view_starred_entries':
      return '查看收藏'
    case 'view_chat_history':
      return '查看历史'
    case 'view_refresh_log':
      return '查看刷新日志'
    case 'export_opml':
      return '导出 OPML'
    case 'import_opml':
      return '导入 OPML'
    case 'clear_refresh_log':
      return '清空刷新日志'
    case 'clear_local_cache':
      return '清理缓存'
    case 'list_account_providers':
      return '查看账号'
    case 'open_account_login':
      return '账号登录'
    case 'unlink_account':
      return '取消账号关联'
    case 'refresh_account_status':
      return '刷新账号状态'
    case 'mark_all_read':
      return '标记已读'
    case 'open_root_tab':
      return '打开根标签'
    case 'go_back':
      return '返回上一页'
    case 'open_entry_detail':
      return '打开文章'
    case 'open_feed_detail':
      return '打开订阅'
    case 'open_settings_panel':
      return '打开设置'
    case 'open_video_player':
      return '打开视频'
    case 'open_image_viewer':
      return '打开图片'
    default:
      return name
  }
}
