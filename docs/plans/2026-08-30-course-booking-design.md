# 课程预约系统设计

## 目标

构建一个无需自建服务器、可部署到 GitHub + Supabase 的课程预约 MVP，支持学生预约、老师排期管理、人工确认/拒绝/取消、时区转换、邮件通知和课前提醒。

## 部署架构

- GitHub Repository：源码、数据库迁移、Supabase Functions、CI 配置。
- GitHub Pages：部署 Vue 3 + TypeScript 前端静态资源。
- Supabase Auth：用户注册、登录和身份认证。
- Supabase PostgreSQL：业务数据、事务、RLS 和预约冲突约束。
- Supabase Edge Functions：预约业务、权限校验和邮件服务适配。
- Supabase Cron：定时扫描课前一小时提醒及过期预约归档。

GitHub Pages 只承载静态前端；服务端密钥只放在 Supabase Secrets 或 GitHub Actions Secrets，不进入前端和仓库。

## 核心规则

1. 系统时间统一以 UTC 存储；用户资料保存 IANA 时区。
2. 固定授课规则保存为老师当地的星期和时间，生成具体日期时转换为 UTC。
3. `PENDING` 和 `CONFIRMED` 都占用时间段；`REJECTED`、`CANCELLED`、`COMPLETED` 释放时间段。
4. 数据库通过老师维度的时间范围排他约束禁止重叠预约，服务端事务再次校验业务规则。
5. 学生不能取消预约；老师可以取消已确认预约。
6. 课程结束后自动标记为 `COMPLETED`，历史数据仍可查询。
7. 邮件时间按收件人的时区展示，通知日志通过唯一键防止重复发送。

## 数据模型

- `profiles`：用户角色、姓名、邮箱、IANA 时区。
- `teacher_availability`：老师每周固定授课规则及生效区间。
- `teacher_blocked_periods`：老师的不可预约 UTC 时段及原因。
- `bookings`：老师、学生、UTC 开始/结束时间、状态和状态时间戳。
- `notification_logs`：预约事件、收件人、发送状态、重试次数和幂等键。

## 业务接口

- 老师列表、老师详情和可预约时段查询。
- 我的预约、老师预约申请列表。
- 老师固定授课时间和不可预约时段维护。
- 创建预约、确认、拒绝和取消。
- 课前提醒与过期归档内部任务接口。

## 权限边界

- 学生只能创建预约、查询公开老师信息和自己的预约。
- 老师只能维护自己的排期、不可预约时段和预约记录。
- 预约状态变更只能通过 Edge Functions，不允许前端直接写状态。
- 所有暴露 schema 的表启用 RLS，Edge Function 使用用户身份上下文执行授权校验。

## 异常与测试

覆盖夏令时转换、跨时区展示、并发预约、重复提交、非法状态流转、过期归档、邮件幂等和失败重试。页面统一提供 loading、empty、error、success 状态。

