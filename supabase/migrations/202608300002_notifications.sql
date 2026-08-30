-- Notification processing is idempotent by notification_logs.unique_key.
-- The provider adapter is server-side only; configure RESEND_API_KEY and MAIL_FROM as secrets.
create index if not exists notification_logs_delivery_queue_idx
  on public.notification_logs (created_at)
  where status in ('PENDING', 'FAILED') and claimed_at is null;
