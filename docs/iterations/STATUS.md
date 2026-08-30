# EduBook Iteration Status

## Current iteration: real booking flow

- Completed: Supabase Auth login/sign-up and profile setup with role/timezone.
- Completed: teacher discovery, weekly availability and blocked-period filtering.
- Completed: UTC booking submission through `create-booking` with conflict handling.
- Completed: teacher confirmation, rejection and cancellation through `booking-action`.
- Completed: student history and teacher schedule management UI.
- Completed: English-first interface with a Chinese language switch, responsive mobile layout, and timezone select seeded from browser detection.
- Completed: server-side notification processor and retryable delivery records.
- Pending external setup: configure `RESEND_API_KEY`, `MAIL_FROM`, and invoke the two cron functions on a schedule.

## Verification

`npm run typecheck`, `npm run test:unit -- --run`, and `npm run build` pass locally. GitHub Actions CI #3 passed the backend deployment; Pages publication is enabled and the live page is reachable.
