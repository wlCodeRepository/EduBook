# 生产配置

## GitHub Actions Variables

- `VITE_SUPABASE_URL`: `https://ahhmaiazcimegsuihnrg.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon public key

## Email OTP

The frontend uses Supabase email/password sign-in and sign-up. Sign-up first calls `signUp` to send a six-digit confirmation code; the email field is locked until `verifyOtp({ email, token, type: 'email' })` succeeds, then the profile is created. The `Confirm signup` email template should contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`. Password recovery uses an email OTP: the `Reset password` email template should contain `{{ .Token }}` and must not contain `{{ .ConfirmationURL }}`. The Auth email SMTP provider must be configured with a real SMTP account. After OTP verification, the frontend holds the recovery session on the password form until `updateUser({ password })` succeeds.

## Supabase Edge Function Secrets

- `REMINDER_CRON_SECRET`: 已配置，用于课前提醒请求鉴权
- `NOTIFICATION_CRON_SECRET`: 配置后用于通知处理任务鉴权
- `RESEND_API_KEY`: Resend 服务端 Token，仅配置在 Supabase Secrets
- `MAIL_FROM`: 已通过 Resend 验证的发件地址，例如 `EduBook <booking@example.com>`

未配置 Resend 时，通知会记录为 `FAILED` 并可重试，不会泄漏服务端 Token。建议使用 Supabase Cron 每分钟调用 `process-notifications`，每 5 分钟调用 `send-reminders`，请求头分别携带对应 secret。
