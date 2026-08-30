# EduBook 数据层第一轮

## 时间与规则

- 具体课程、不可预约时段和通知时间使用 `timestamptz`，由 PostgreSQL 统一按 UTC 语义保存。
- `profiles.timezone` 保存 IANA 时区名称，例如 `America/New_York`、`Asia/Shanghai`。
- 每周授课规则保存老师当地的星期和 `time`；生成具体日期时才结合老师时区转换为 UTC。
- 预约使用半开区间 `[start, end)`，相邻课程允许紧接排列。

## 预约占用与并发

`bookings_teacher_active_time_exclusion` 使用 `btree_gist` 对同一老师的时间范围做排他约束，只有 `PENDING` 和 `CONFIRMED` 参与冲突检查。待确认申请因此立即占用时段，拒绝或取消后自动释放。

## 权限边界

- 学生可以读取老师公开信息和自己的预约，只能以 `PENDING` 创建自己的预约。
- 老师可以维护自己的固定授课时间和不可预约时段，并读取自己的预约。
- 预约状态变更不开放给浏览器直连，暂由 `booking-action` Edge Function 通过服务角色执行；函数必须先验证 JWT 和老师身份。
- `notification_logs` 只允许收件人读取；写入和发送由服务端流程负责。

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
```

当前提醒函数是 dry-run 骨架，邮件服务和 Cron 鉴权将在通知迭代实现；不要把任何服务密钥提交到仓库。
