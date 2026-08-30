# 工程化配置验证记录

## 本次变更

- 检查 GitHub Actions YAML 的结构和触发条件。
- 检查环境模板不包含真实密钥。
- 检查 README 与 Supabase、Pages 文档覆盖本地启动、发布、验证和安全约定。

## 当前仓库状态

当前没有 `package.json`，因此不能执行 npm 安装、类型检查、单元测试或构建。CI 已为此保留清晰的跳过提示；前端骨架加入后，必须重新执行完整命令。

## 前端加入后的验收命令

```bash
npm ci
npm run typecheck
npm run test:unit -- --run
npm run build
```

同时应在 GitHub Actions 中验证 Pull Request 只执行 verify，手动将 `deploy_pages=true` 时才执行 Pages 发布。
