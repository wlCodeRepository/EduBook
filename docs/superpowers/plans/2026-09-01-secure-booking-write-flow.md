# Secure Booking Write Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Make every booking-system mutation authenticate correctly, enforce least-privilege roles, and complete the administrator-to-teacher-to-student booking flow.

**Architecture:** PostgreSQL RLS denies browser profile creation and role mutation. Security-definer RPCs expose only whitelisted own-profile fields and teacher busy ranges; Edge Functions verify bearer tokens before privileged queries. The Vue app calls these controlled APIs and renders administrator management.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Supabase Auth, PostgreSQL RLS/RPC, Supabase Edge Functions.

**Spec:** \`docs/superpowers/specs/2026-09-01-secure-booking-write-flow-design.md\`

## Global Constraints

- No self-service registration, email verification, recovery, SMTP, or booking emails.
- No service-role credential in browser code, logs, API responses, or repository files.
- UTC appointments; IANA timezone display; PENDING and CONFIRMED reserve teacher time.
- Every mutation has localized loading, success, and failure feedback.

---

### Task 1: Secure profile mutations

**Files:**
- Create: \`supabase/migrations/202609010003_secure_profile_mutations.sql\`
- Modify: \`src/App.vue\`
- Test: \`src/App.test.ts\`

**Produces:** \`update_my_profile(p_display_name text, p_timezone text, p_default_lesson_minutes smallint)\`, executable only by authenticated users and updating only their own display name, timezone, and lesson duration.

- [ ] Write a failing test proving account settings never render editable role, username, or internal-email controls.
- [ ] Run \`npm run test:unit -- --run src/App.test.ts\`; confirm the regression before implementation.
- [ ] Drop \`profiles_insert_self\` and \`profiles_update_self\`; revoke profile INSERT/UPDATE/DELETE from authenticated.
- [ ] Add security-definer \`update_my_profile\` with \`auth.uid()\`, valid timezone, name length, and 5–240 minute validation; revoke public/anon execution and grant authenticated execution.
- [ ] Change the lesson-duration save call to this RPC.
- [ ] Run \`npm run typecheck\` and the focused UI test; commit \`fix: lock down profile mutations\`.

### Task 2: Deliver safe busy slots

**Files:**
- Modify: \`supabase/migrations/202609010003_secure_profile_mutations.sql\`
- Create: \`supabase/functions/teacher-busy-slots/index.ts\`
- Modify: \`src/lib/types.ts\`, \`src/lib/booking.ts\`, \`src/App.vue\`
- Test: \`src/lib/booking.test.ts\`

**Produces:** \`POST /functions/v1/teacher-busy-slots\` accepting \`{ teacherId, from, until }\` and returning only \`{ slots: [{ start_at_utc, end_at_utc }] }\`.

- [ ] Add a failing slot-generator test: an overlapping busy UTC range makes a candidate unavailable.
- [ ] Run \`npm run test:unit -- --run src/lib/booking.test.ts\`; confirm it fails before support is added.
- [ ] Add \`list_teacher_busy_slots(uuid, timestamptz, timestamptz)\`: executable only by \`service_role\`, reject invalid or over-31-day ranges, and return only PENDING/CONFIRMED timestamps.
- [ ] Create the Edge Function: verify \`Authorization\` with an anon-key client, return 401 without a user, then invoke the RPC through the service-role client.
- [ ] Load busy ranges whenever the displayed teacher/week changes and merge them with blackout ranges in \`generateSlots\`.
- [ ] Run typecheck and booking tests; commit \`feat: expose safe teacher busy slots\`.

### Task 3: Repair function and cron authorization

**Files:**
- Modify: \`supabase/functions/admin-create-user/index.ts\`
- Modify: \`supabase/functions/create-booking/index.ts\`
- Modify: \`supabase/functions/booking-action/index.ts\`
- Modify: \`supabase/functions/send-reminders/index.ts\`
- Modify: \`docs/api-contracts.md\`

**Produces:** 401 for absent/invalid identity, 403 for valid but unauthorized roles, and a cron function that validates its secret before every service-role write.

- [ ] Document 401/403/409 outcomes for every function.
- [ ] Verify every user-triggered function calls \`auth.getUser()\` before instantiating or querying with a service-role client.
- [ ] Move the reminder-secret check ahead of \`archive_expired_bookings\`; remove unreachable notification-delivery code and return only secure completion results.
- [ ] Run \`rg -n "archive_expired_bookings|SERVICE_ROLE|auth.getUser" supabase/functions\` and manually review ordering.
- [ ] Commit \`fix: enforce edge function authorization\`.

### Task 4: Complete administrator and localized role interfaces

**Files:**
- Modify: \`src/App.vue\`, \`src/lib/i18n.ts\`, \`src/styles.css\`
- Test: \`src/App.test.ts\`

**Produces:** An ADMIN-only user-management page with username, temporary password, display name, role, timezone, account list, and clear success/error feedback. Teacher rows display student names, not UUIDs.

- [ ] Add a failing test mounting an ADMIN profile and asserting the create-account controls.
- [ ] Render a dedicated \`activeNav === '用户管理'\` branch before generic teacher content; bind its form to \`createManagedUser()\`.
- [ ] Replace visible hard-coded dashboard text with both English and Chinese message keys.
- [ ] Ensure mobile layout stacks management inputs and actions at 390px.
- [ ] Run \`npm run typecheck\`, \`npm run test:unit -- --run\`, and \`npm run build\`; commit \`feat: complete administrator account management\`.

### Task 5: Apply, publish, and verify

**Files:**
- Modify: \`docs/deployment/admin-accounts.md\`, \`docs/iterations/STATUS.md\`
- Create: \`docs/verification/secure-booking-write-flow.md\`

- [ ] Apply the new SQL migration to the production Supabase project.
- [ ] Deploy \`teacher-busy-slots\` and updated functions; retain no anonymous write path.
- [ ] Publish the Pages frontend.
- [ ] Create one teacher and one student from the administrator page, then run: teacher weekly hours + blocked time; student booking; teacher confirmation; student history; second-slot conflict check.
- [ ] Record results without credentials; run \`git diff --check\`; commit documentation.

## Final Verification

- [ ] \`npm run typecheck\`
- [ ] \`npm run test:unit -- --run\`
- [ ] \`npm run build\`
- [ ] \`git diff --check\`
- [ ] Production vertical slice succeeds without an authentication failure.
