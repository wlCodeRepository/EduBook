# EduBook 数据层第一轮

## 时间与规则

- 具体课程、不可预约时段和通知时间使用 `timestamptz`，由 PostgreSQL 统一按 UTC 语义保存。
- `profiles.timezone` 保存 IANA 时区名称，例如 `America/New_York`、`Asia/Shanghai`。
- `profiles.default_lesson_minutes` 保存老师默认课程时长（5–240 分钟）；预约必须精确匹配该时长。
- 旧版每周授课规则仍保留在表中以兼容已有数据，但当前产品不再依赖它：老师默认开放，学生可选择任意未来的 15 分钟开始档位。
- 预约使用半开区间 `[start, end)`，相邻课程允许紧接排列。

## 预约占用与并发

`bookings_teacher_active_time_exclusion` 使用 `btree_gist` 对同一老师的时间范围做排他约束，只有 `PENDING` 和 `CONFIRMED` 参与冲突检查。待确认申请因此立即占用时段，拒绝或取消后自动释放。

`create_booking` 在单个数据库事务中校验学生/老师角色、未来时间、老师时区下的星期与固定授课规则、课程时长和不可预约时段，然后写入预约及 `BOOKING_CREATED` 通知日志。最终仍由排他约束处理并发超卖。

## 权限边界

- 学生可以读取老师公开信息和自己的预约，只能以 `PENDING` 创建自己的预约。
- 老师可以维护自己的固定授课时间和不可预约时段，并读取自己的预约。
- 预约状态变更不开放给浏览器直连，暂由 `booking-action` Edge Function 通过服务角色执行；函数必须先验证 JWT 和老师身份。
- `notification_logs` 只允许收件人读取；写入和发送由服务端流程负责。
- `booking-action` 调用 `apply_booking_action`，使用带原状态条件的 `UPDATE ... RETURNING`，确认/拒绝/取消与 `confirmed_at`/`rejected_at`/`cancelled_at`、通知日志在同一事务内完成；并发重复操作只会有一个成功。
- 管理员目录及全局数据只通过 `admin-operations` Edge Function 读取/变更。它以调用者 JWT 确认 `ADMIN` 后才使用服务角色；密码只可写不可读，且管理员账号不暴露给常规人员管理操作。
- `send-reminders` 必须携带 `REMINDER_CRON_SECRET` 对应的请求头。`claim_due_reminders` 使用 `FOR UPDATE SKIP LOCKED` 和可过期 claim 防重复；`complete_notification_claim` 支持成功/失败回写，邮件服务未配置时失败可重试。`archive_expired_bookings` 将已结束的已确认课程标记为 `COMPLETED`。

## 本地验证

需要安装 Supabase CLI 和 Docker 后，在仓库根目录执行：

```bash
supabase start
supabase db reset
supabase functions serve create-booking
supabase functions serve booking-action
supabase functions serve send-reminders
```

静态检查（不需要密钥）：

```bash
rg -n "service_role|SUPABASE_SERVICE_ROLE_KEY|create table|exclude using gist|enable row level security" supabase docs/data-model.md

SQL/函数静态检查（不需要密钥）：

```bash
rg -n "security definer|set search_path|create_booking|apply_booking_action|for update skip locked|on conflict|archive_expired_bookings|claim_token" supabase/migrations supabase/functions docs/data-model.md
rg -n "SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey|claim_token|secret" supabase/functions
```

以上检查用于确认：服务角色仅在函数内部使用、关键函数固定 `search_path`、预约状态使用条件更新、通知使用唯一键幂等、提醒使用锁定 claim；不能替代 Supabase CLI/Deno 和真实数据库并发验证。
```

当前提醒函数是“可鉴权、可 claim、可归档”的投递骨架；真实邮件供应商调用仍需后续接入。`SUPABASE_SERVICE_ROLE_KEY`、`REMINDER_CRON_SECRET` 必须配置在 Supabase secrets，不能提交到仓库或响应。
