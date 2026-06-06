# Livo 发布计划

本文档记录发布前必须完成的检查，避免发布流程只依赖个人记忆。

## 发布前检查

1. 确认 `docs/changelog/next.md` 已记录本轮用户可见变更。
2. 执行质量门禁：

   ```bash
   pnpm format:check
   pnpm typecheck
   pnpm lint
   pnpm test
   ```

3. 按目标平台执行构建：

   ```bash
   pnpm build
   pnpm build:web
   ```

4. 若发布桌面安装包，再按平台执行：

   ```bash
   pnpm build:win
   pnpm build:mac
   pnpm build:linux
   ```

## 版本记录

- 正式发布时，把 `docs/changelog/next.md` 的内容复制到对应版本条目。
- 新建空的 `docs/changelog/next.md`，继续收集下一版本变更。

## 风险策略

- 不在发布日引入新依赖或大规模重构。
- 签名、公证、商店分发和 artifact provenance 暂未接入；接入前必须单独评审配置和密钥管理。
