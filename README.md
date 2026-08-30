# EduBook 课程预约系统

EduBook 是一个面向学生和老师的课程预约系统，采用 GitHub + Supabase 部署：

- 前端：Vue 3 + TypeScript，发布到 GitHub Pages
- 后端能力：Supabase Auth、PostgreSQL、Edge Functions、Cron
- 时间规则：UTC 存储，按用户 IANA 时区展示
- 预约规则：待确认和已确认预约均占用时间段，数据库事务防止超卖

## 当前状态

当前仓库处于设计与工程化准备阶段，设计文档与实施计划位于 [`docs/plans`](./docs/plans)。CI、Supabase 本地开发和 GitHub Pages 发布说明位于 [`docs/deployment`](./docs/deployment)。

## 本地启动

当前尚未加入前端 `package.json`。前端骨架加入后，在项目根目录执行：

```bash
npm ci
npm run dev
```

预期的验证 scripts 为 `typecheck`、`test:unit` 和 `build`。没有 lockfile 的首次开发环境可使用 `npm install`，提交前应生成并提交 `package-lock.json`。

## Supabase 配置

本地 Supabase 配置、迁移和 Edge Functions 说明见 [`docs/deployment/supabase-local.md`](./docs/deployment/supabase-local.md)。复制 [`.env.example`](./.env.example) 为 `.env.local`，只填入 Supabase URL 和 anon public key。预约业务的服务端密钥必须使用 Supabase Secrets。

## GitHub Pages 发布

CI workflow 位于 [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)。Push 和 Pull Request 默认只做验证；配置仓库 Pages 后，可手动运行 workflow 并将 `deploy_pages` 设为 `true` 发布 `dist`。完整说明见 [`docs/deployment/github-pages.md`](./docs/deployment/github-pages.md)。

## 验证

前端骨架加入后执行：

```bash
npm ci
npm run typecheck
npm run test:unit -- --run
npm run build
```

验证记录与当前缺少前端工程的说明见 [`docs/verification/engineering-config.md`](./docs/verification/engineering-config.md)。

## 计划

1. 初始化前端和 Supabase 工程结构
2. 实现注册登录、角色和时区
3. 实现老师排期与时段生成
4. 实现预约状态流转和并发保护
5. 实现邮件通知、课前提醒和历史归档
6. 配置 GitHub Pages 发布并完成安全检查

## 安全约定

本地配置使用 `.env.local`，只提交 `.env.example`。Supabase service key、邮件服务 Token 等服务端密钥只能配置在 Supabase Secrets 或 GitHub Actions Secrets 中。

