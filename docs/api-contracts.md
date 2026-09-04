# EduBook API contracts

## Frontend

The browser uses Supabase Auth and the public anon/publishable key. It may read `profiles`, `teacher_availability`, `teacher_blocked_periods`, and the signed-in user's `bookings` under RLS. It never receives a service role key.

## Edge Functions

Personal password changes use authenticated Supabase Auth `updateUser({ password })`, separately from profile updates. The form requires matching 8–128 character values. Passwords are never stored in profile records or application logs.

Signed-in users update their own display name, timezone, and (for teachers) lesson duration through the authenticated `update_my_profile` RPC. The browser never sends role, username, or password through this profile-preferences flow.

`POST /functions/v1/admin-create-user`

```json
{ "username": "alex.chen", "password": "temporary-password", "displayName": "Alex Chen", "role": "STUDENT|TEACHER", "timezone": "Asia/Shanghai" }
```

Requires an authenticated administrator. The function creates an email-confirmed internal Auth identity and profile without sending email. Passwords are never returned.

`POST /functions/v1/admin-operations`

Requires an authenticated administrator. The body always contains an `operation` field:

- `list` returns the account directory excluding the authenticated operator. Other administrator rows remain protected.
- `dashboard` returns role/booking counters and the latest platform bookings with display names.
- `update` accepts `userId`, `displayName`, `timezone`, and `defaultLessonMinutes` for a teacher/student. Sending `role` or `username` returns HTTP 400 `immutable_account_fields`; both are fixed at creation.
- `reset_password` accepts `userId` and a write-only `password`.
- `delete` accepts `userId` and only succeeds for a teacher/student without booking history.

Administrator accounts are deliberately protected from update, password-reset, and delete operations through this endpoint. The browser never receives an Auth admin or service-role credential.

`POST /functions/v1/create-booking`

```json
{ "teacherId": "uuid", "startAtUtc": "2026-09-07T01:00:00.000Z", "endAtUtc": "2026-09-07T02:00:00.000Z" }
```

Requires a student identity. The requested future start must be on a 15-minute boundary and the end must exactly match the teacher's configured duration. Teachers are available by default; only teacher-blocked periods and PENDING/CONFIRMED overlaps are rejected.

`POST /functions/v1/booking-action`

```json
{ "bookingId": "uuid", "action": "confirm|reject|cancel", "cancellationReason": "optional" }
```

Both require the caller's Supabase access token. A conflict returns HTTP 409 and a validation failure returns HTTP 400.

`POST /functions/v1/send-reminders` archives expired confirmed bookings and returns `delivery: "disabled"`; it never sends or claims reminders.

`POST /functions/v1/process-notifications` returns `delivery: "disabled"` and never sends booking notifications.
