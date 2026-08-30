# Course Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a deployable course booking MVP using GitHub Pages for the frontend and Supabase for authentication, PostgreSQL, server-side functions, email notifications, and scheduled jobs.

**Architecture:** Use a Vue 3 + TypeScript SPA deployed by GitHub Actions to GitHub Pages. Use Supabase Auth and RLS for identity and data boundaries. Put all booking mutations in Edge Functions and enforce no-overlap with PostgreSQL constraints and transactions.

**Tech Stack:** Vue 3, TypeScript, Vite, Supabase Auth, PostgreSQL, Supabase Edge Functions, Supabase Cron, Vitest, Playwright, GitHub Actions.

---

## Iteration 1: Project skeleton and deployment

1. Initialize frontend and Supabase directory structure.
2. Add environment-variable example files and secret-handling rules.
3. Add GitHub Actions workflow for typecheck, test, build, and GitHub Pages deployment.
4. Add a health/status page proving the frontend can connect to Supabase without exposing secrets.
5. Verify with install, lint/typecheck, test, and production build commands.

Acceptance: a clean checkout can build the SPA, and the generated static artifact is publishable by GitHub Pages.

## Iteration 2: Authentication and profiles

1. Write failing tests for registration, login, role selection, timezone selection, and protected routes.
2. Create versioned SQL migration for `profiles`, roles, timezone validation, and RLS policies.
3. Implement Auth UI and profile setup flow.
4. Add tests for student/teacher route boundaries and invalid timezone handling.

Acceptance: both roles can register and log in, every profile has a valid IANA timezone, and users cannot read or edit another user's private profile data.

## Iteration 3: Teacher availability and time calculation

1. Write unit tests for weekly rules, DST transitions, blocked periods, and teacher-to-student timezone conversion.
2. Create migrations for `teacher_availability` and `teacher_blocked_periods` with indexes and RLS.
3. Implement teacher schedule management and blocked-period management.
4. Implement server-side slot generation for a requested date range.
5. Add empty, loading, validation-error, and conflict states to the teacher UI.

Acceptance: a teacher can configure multiple weekly periods and blackout periods; students see only valid future slots in their own timezone.

## Iteration 4: Booking lifecycle and concurrency

1. Write failing integration tests for create, confirm, reject, cancel, complete, invalid transitions, and two simultaneous booking attempts.
2. Create the `bookings` migration with status checks, foreign keys, UTC timestamps, indexes, and a partial time-range exclusion constraint for `PENDING`/`CONFIRMED` rows.
3. Implement transactional Edge Functions for create, confirm, reject, and cancel.
4. Implement student booking history and teacher booking request/confirmed lists.
5. Add UI handling for stale slots and rejected concurrent requests.

Acceptance: exactly one active booking can occupy a teacher time range; pending bookings block the slot; only the teacher can confirm, reject, or cancel.

## Iteration 5: Email notifications and scheduled jobs

1. Write tests for notification event creation, recipient timezone formatting, idempotency, and retryable failures.
2. Create `notification_logs` migration and policies.
3. Add a backend email-provider adapter using Supabase secrets.
4. Trigger notifications after booking state changes without holding the booking transaction open for network calls.
5. Add Cron-triggered reminder and completion functions with a unique reminder key.

Acceptance: each required business event produces at most one notification per recipient/event, reminders use each recipient's timezone, and failed deliveries are retryable.

## Iteration 6: Documentation, security review, and release

1. Add README with local setup, Supabase setup, deployment, and rollback/recovery instructions.
2. Add API contract documentation and database business semantics.
3. Run frontend tests, Edge Function tests, migration checks, build, and a manual end-to-end checklist.
4. Review RLS, CORS, secret exposure, input validation, rate limiting, and error responses.
5. Record verification results in `docs/iterations/STATUS.md` and remaining external dependencies in `HANDOFF.md`.

Acceptance: the repository contains reproducible setup instructions, no secrets, passing verification commands, and a clear list of Supabase/email configuration required for deployment.

