# Secure Booking Write Flow Design

## Goal

Make every production data mutation authenticate reliably while enforcing role boundaries, and make the deployed UI support the administrator-to-teacher-to-student booking flow.

## Scope

- Replace browser-writable profile role and identity fields with server-controlled mutations.
- Make all Edge Functions verify the caller JWT before they use privileged database access.
- Provide students a safe busy-slot feed so rendered availability excludes every pending or confirmed booking without exposing other students.
- Render the existing administrator account-management capability and complete the teacher/student pages needed to exercise the flow.
- Make completed-booking archiving require a cron secret before any write occurs.
- Keep the already approved product decision: accounts are administrator-managed and email delivery, email verification, password recovery, and booking email notifications remain disabled.

## Non-goals

- Reintroducing email, SMTP, password recovery, payments, or a self-service registration path.
- Building an additional server outside Supabase.

## Authorization Design

The browser may read public teacher profile information, weekly availability, blocked periods, and a new busy-slot projection. It may update only a narrowly whitelisted set of fields for its own profile through an authenticated RPC. It may never insert a profile, change any role, username, email, or another user's profile.

`admin-create-user`, `create-booking`, `booking-action`, and the new `teacher-busy-slots` Edge Function each first resolve the supplied bearer token with the anon-key client. Only then may they instantiate the service-role client. The administrator function accepts only profiles whose role was created by the controlled bootstrap or administrator path.

## Data and API Design

Add a migration that removes the broad `profiles_insert_self` and `profiles_update_self` policies, removes authenticated DML grants that are no longer appropriate, and supplies `update_my_profile(p_display_name, p_timezone, p_default_lesson_minutes)` as a security-definer RPC with an explicit field whitelist.

Add `list_teacher_busy_slots(p_teacher_id, p_from, p_until)` as a security-definer RPC returning only UTC start/end timestamps from `PENDING` and `CONFIRMED` bookings. It is executable only by the service role and validates its bounded date range. The browser calls it only through the JWT-verifying `teacher-busy-slots` function; it never receives booking IDs or student details.

The UI uses the returned busy slots alongside teacher blackout ranges while generating slots. It must render teacher and student names rather than raw UUIDs in teacher-facing booking rows. The administrator view renders the existing `adminForm`, invokes `admin-create-user`, and lists accounts.

## Error Handling

Edge Functions return a uniform JSON `{ error: string }` body and status 401 for a missing/invalid session, 403 for a valid but unauthorized role, 400 for invalid input, and 409 for a booking conflict. The front end maps these known errors to user-facing, localized messages and preserves the server failure text only for unexpected developer diagnostics.

## Verification

- Unit tests cover busy-slot filtering and localized error mapping.
- SQL migration review verifies self-service role escalation is impossible.
- Production checks create one teacher and one student through the administrator page, write teacher availability and a blackout interval, submit a student booking, confirm it as teacher, and verify that the second attempt at the same slot is unavailable.
- `npm run typecheck`, `npm run test:unit -- --run`, `npm run build`, and `git diff --check` pass before merge.
