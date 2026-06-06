# 安全策略

## 报告安全问题

请不要在公开 issue 中披露安全漏洞细节。可以通过仓库维护者公开联系方式私下报告，并尽量提供：

- 受影响版本或提交。
- 复现步骤。
- 影响范围。
- 可行的缓解建议。

## 安全基线

- Electron 渲染层默认不启用 Node.js 集成。
- preload 只暴露受控 API，主进程 IPC 需要参数校验。
- 外部链接通过系统浏览器打开，并经过 URL policy 检查。
- OAuth、AI API Key、Fever API Key 等凭据不得写入源码或测试 fixture。

## 依赖与发布

依赖更新由 Dependabot 提醒。发布前按 `docs/release/release-plan.md` 执行质量门禁和构建检查。
