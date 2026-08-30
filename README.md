# EduBook 课程预约系统

EduBook 是一个面向学生和老师的课程预约系统，采用 GitHub + Supabase 部署：

- 前端：Vue 3 + TypeScript，发布到 GitHub Pages
- 后端能力：Supabase Auth、PostgreSQL、Edge Functions、Cron
- 时间规则：UTC 存储，按用户 IANA 时区展示
- 预约规则：待确认和已确认预约均占用时间段，数据库事务防止超卖

## 当前状态

当前仓库处于设计阶段，设计文档与实施计划位于 [`docs/plans`](./docs/plans)。

## 计划

1. 初始化前端和 Supabase 工程结构
2. 实现注册登录、角色和时区
3. 实现老师排期与时段生成
4. 实现预约状态流转和并发保护
5. 实现邮件通知、课前提醒和历史归档
6. 配置 GitHub Pages 发布并完成安全检查

## 安全约定

本地配置使用 `.env.local`，只提交 `.env.example`。Supabase service key、邮件服务 Token 等服务端密钥只能配置在 Supabase Secrets 或 GitHub Actions Secrets 中。

