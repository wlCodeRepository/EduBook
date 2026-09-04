# Operations workspace and end-to-end booking iteration

## Objective

Turn the existing role-aware prototype into a coherent operating workspace: administrators manage all teacher and student accounts and see live platform health; teachers manage lesson settings, blackouts and requests; students find a teacher and reserve a free 15-minute-start slot.

## Product decisions

- The working model is default-open. A teacher does not publish weekly availability. Any future start on a 15-minute boundary can be requested unless it overlaps a PENDING/CONFIRMED lesson or an explicit teacher blackout.
- Accounts are username/password identities created and administered by an administrator. Email delivery is intentionally not in the product flow.
- Times are stored as UTC and always rendered in the signed-in viewer's IANA timezone.
- The visual system is a restrained education-operations interface: navy typography, teal action states, useful density, explicit empty/error/loading states, and a mobile navigation pattern.

## Delivery slices

1. Replace the legacy fixed-availability navigation and UI with role-specific dashboard routes and a responsive shell.
2. Add an administrator-only Edge Function for account list, update, password reset, deletion, dashboard metrics, and global booking records. Keep passwords write-only and block mutation of administrator accounts through this surface.
3. Add an account directory with search, role filter, create/edit/password-reset/delete flows, plus a platform overview and global booking view.
4. Rework teacher and student pages around the default-open 15-minute booking rule and expose the people involved in every booking record.
5. Extend contracts, data documentation, and regression tests; run frontend validation. Deploy Edge Functions and the static app after production database migrations are applied.

## Acceptance checks

- An administrator can create, find, edit, reset the password of, and delete teacher/student accounts; they cannot accidentally delete administrators.
- The administrator overview includes role totals, booking-state totals, and recent platform booking activity.
- A teacher can set duration, create a blackout, and confirm/reject/cancel requests.
- A student can select a teacher, choose a future 15-minute local start, review both timezones, and submit a request. Pending requests block the time.
- The same routes remain usable at 360px width, and all role pages provide useful empty/loading/error feedback.

## Deployment note

`202609010005_free_form_booking_slots.sql` must be applied before release because it removes the old weekly-availability database check. This iteration does not embed production credentials or database mutations in the web application.
