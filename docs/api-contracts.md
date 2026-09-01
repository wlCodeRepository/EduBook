# EduBook API contracts

## Frontend

The browser uses Supabase Auth and the public anon/publishable key. It may read `profiles`, `teacher_availability`, `teacher_blocked_periods`, and the signed-in user's `bookings` under RLS. It never receives a service role key.

## Edge Functions

`POST /functions/v1/admin-create-user`

```json
{ "username": "alex.chen", "password": "temporary-password", "displayName": "Alex Chen", "role": "STUDENT|TEACHER", "timezone": "Asia/Shanghai" }
```

Requires an authenticated administrator. The function creates an email-confirmed internal Auth identity and profile without sending email. Passwords are never returned.

`POST /functions/v1/create-booking`

```json
{ "teacherId": "uuid", "startAtUtc": "2026-09-07T01:00:00.000Z", "endAtUtc": "2026-09-07T02:00:00.000Z" }
```

`POST /functions/v1/booking-action`

```json
{ "bookingId": "uuid", "action": "confirm|reject|cancel", "cancellationReason": "optional" }
```

Both require the caller's Supabase access token. A conflict returns HTTP 409 and a validation failure returns HTTP 400.

`POST /functions/v1/send-reminders` archives expired confirmed bookings and returns `delivery: "disabled"`; it never sends or claims reminders.

`POST /functions/v1/process-notifications` returns `delivery: "disabled"` and never sends booking notifications.
