# EduBook 课程预约系统

EduBook 是一个面向学生和老师的课程预约系统，采用 GitHub + Supabase 部署：

- 前端：Vue 3 + TypeScript，发布到 GitHub Pages
- 后端能力：Supabase Auth、PostgreSQL、Edge Functions、Cron
- 时间规则：UTC 存储，按用户 IANA 时区展示
- 预约规则：待确认和已确认预约均占用时间段，数据库事务防止超卖

## 当前状态

当前版本已接入真实 Supabase Auth、管理员创建账号、用户时区、老师排期、预约申请与老师审核。在线演示地址为 https://wlcoderepository.github.io/EduBook/。管理员初始化见 [`docs/deployment/admin-accounts.md`](./docs/deployment/admin-accounts.md)。

## 本地启动

在项目根目录执行：

```bash
npm ci
npm run dev
```

验证 scripts 为 `typecheck`、`test:unit` 和 `build`。

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
5. 保留历史归档，停用邮件通知和课前提醒
6. 配置 GitHub Pages 发布并完成安全检查

## 安全约定

本地配置使用 `.env.local`，只提交 `.env.example`。Supabase service key、邮件服务 Token 等服务端密钥只能配置在 Supabase Secrets 或 GitHub Actions Secrets 中。

