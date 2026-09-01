# 生产配置

## GitHub Actions Variables

- `VITE_SUPABASE_URL`: `https://ahhmaiazcimegsuihnrg.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon public key

## Administrator-managed accounts

The public application does not offer sign-up, password recovery, email verification, or email notifications. Users sign in with a username and password. An administrator creates student and teacher accounts through the `admin-create-user` Edge Function; it uses a non-deliverable internal Auth email and `email_confirm: true`.

After applying the administrator migration, bootstrap the first administrator from the Supabase SQL editor as documented in `docs/deployment/admin-accounts.md`. The service role key is used only by the Edge Function and must never be placed in frontend variables.

## Supabase Edge Function Secrets

- `REMINDER_CRON_SECRET`: 已配置，用于课前提醒请求鉴权
- `NOTIFICATION_CRON_SECRET`: 配置后用于通知处理任务鉴权
- `RESEND_API_KEY`: 已停用，不再发送预约邮件
- `MAIL_FROM`: 已停用，不再发送预约邮件

预约邮件通知和课前提醒已停用；旧 Cron 即使继续调用，也只会安全返回 disabled，不发送邮件。`send-reminders` 仍可归档已完成预约。
