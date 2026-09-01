# Free-form Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a student to request any future teacher time in 15-minute increments unless it overlaps an occupied or teacher-blocked period.

**Architecture:** The database remains the concurrency authority: its exclusion constraint reserves PENDING and CONFIRMED time ranges. A replacement `create_booking` function removes the legacy weekly-availability gate, validates a 15-minute start and the teacher's configured duration, then rejects blocked or overlapping ranges. The browser submits a selected local date/time interpreted in the student's profile timezone.

**Tech Stack:** Vue 3, TypeScript, Vitest, Supabase PostgreSQL and Edge Functions.

**Spec:** `docs/plans/2026-09-01-admin-flow-and-workspace-polish.md`

## Global Constraints

- Store and compare concrete booking times as UTC `timestamptz`.
- PENDING and CONFIRMED bookings reserve the teacher range.
- Browser clients never receive service-role credentials.

### Task 1: Replace weekly availability validation

**Files:** `supabase/migrations/202609010005_free_form_booking_slots.sql`, `docs/api-contracts.md`

- [ ] Replace `public.create_booking` so it requires a future start at a 15-minute boundary, exact default lesson duration, a STUDENT caller, and no overlap with `teacher_blocked_periods`.
- [ ] Keep the existing range exclusion constraint as the final no-oversell guard.

### Task 2: Provide custom date-time selection

**Files:** `src/lib/booking.ts`, `src/lib/booking.test.ts`, `src/App.vue`, `src/styles.css`

- [ ] Convert a student timezone date-time input to UTC and calculate the teacher-local display end time.
- [ ] Reject a non-15-minute input in the client before submission and mark occupied/blocked proposals unavailable.
- [ ] Remove fixed weekly availability from the teacher UI; retain duration and blocked-period controls.

### Task 3: Verify and release

- [ ] Run `npm run typecheck`, `npm run test:unit -- --run`, `npm run build`, and `git diff --check`.
- [ ] Apply migration `202609010005_free_form_booking_slots.sql` in the production Supabase SQL editor, then deploy the Edge Function and Pages.
