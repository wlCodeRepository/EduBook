# Digital Campus Implementation Plan

> Execute task-by-task with executing-plans; user approved the Digital Campus direction and implementation in the current session.

**Goal:** Replace every role's old page body and navigation with a coherent digital campus, preserving booking and account authority rules.

**Architecture:** App remains the authenticated data/action controller. Dedicated props/events-based views own presentation; shared shell, drawer, records, and tokens replace role-exclusion CSS. No new database schema, UI library or authentication bypass. Offline preview uses the same real view components but explicitly fictional data and never replaces production authentication.

**Tech Stack:** Vue 3, TypeScript, existing Supabase APIs, CSS, Vitest, browser verification.

## Approved design

**User correction during implementation:** Reject ordinary sidebar/dashboard structure. Desktop and mobile must prioritize one-screen task completion. Replace rail with campus location strip and bottom account dock around a bounded stage. Use task panels, pagination and selected-day agendas instead of long vertical pages; mobile booking becomes teacher → time/duration → ticket steps. Never force-fit by tiny fonts or clipping controls: keyboard/zoom/small heights can scroll within task surface. Settings switches between lesson unit/blocked time, personnel detail replaces list on mobile. This overrides the persistent-rail description below.

Mist #eaf0f7, ink #233957, paper #fcfdff, blue #5378b5, coral #c86454, line #d5deeb. Display: Trebuchet MS; body: Segoe UI/system; time/data: ui-monospace. Persistent narrow campus rail on desktop with named destinations and avatar at bottom; mobile compact header and scrollable destination strip. Page-level content differs by job: admin timetable/people ledger, teacher weekly planner/inbox, student reservation studio/course itinerary. Signature: course-distribution campus board, not decorative metrics or a huge login hero. Retain modest 3D only beside a student's actual booking controls.

## Task 1: Shared shell and action surfaces (main agent)

Files: src/components/CampusShell.vue, CampusDrawer.vue, tests; src/campus.css, src/App.vue, src/main.ts.
1. Write behavioral tests for all role navigation, active state, avatar actions, drawer close/focus and busy locking. Run targeted vitest to establish failures.
2. Implement accessible shell for ADMIN/TEACHER/STUDENT without exclusions; native dialog drawer with Escape/backdrop, scroll cleanup, focus restoration. Tokens drive forms and selects.
3. Replace App shell and connect existing callbacks. Split create/edit/reset/delete into explicit modes; preserve immutable role/username, no admin self entry.
4. Run typecheck and targeted tests. Review scoped diff and commit once integrated.

## Task 2: Administrator campus (agent A)

Files: src/components/AdminCampus.vue, PeopleDirectory.vue and their tests; optional src/lib/campus-admin.ts and test.
1. Test real data-derived seven-day distribution and viewer timezone; personnel filtering excludes current user and admins, actions emit selected user.
2. Implement admin timetable-first overview and searchable personnel master/detail layout with distinct create/edit/reset/delete actions. Props/events only; no API/auth mutations.
3. Unit tests and typecheck; document files and verification. Main wires callbacks and forms.

## Task 3: Teaching and course records (agent B)

Files: src/components/TeacherCampus.vue, CampusLessons.vue, TeacherBookings.vue, TeacherWeek.vue and tests.
1. Test real upcoming/pending classification and course filters; retain existing timezone/quarter-hour tests.
2. Implement weekly planner-first teacher home with upcoming session and requests lane; refine inbox and calendar. Build shared course itinerary with status tabs/search for admin and student, no student cancel action.
3. Components use shared tokens with scoped CSS; expose events only, keep API behavior unchanged. Run targeted regressions.

## Task 4: Complete integration, settings, student flow (main agent)

Files: src/App.vue, src/components/TeacherSettings.vue, BookingStudio.vue, AccountCenter.vue, src/campus.css, tests.
1. Extract teacher settings into distinct duration and blackout zones, draft values do not mutate profile before successful save. Correct obsolete single-lesson copy to 1–8 multiples; occupied lessons also unavailable.
2. Student reservation and history both receive new shell/body; shrink decorative classroom, prioritize actual teacher/date/length controls. Account/profile/password surfaces match drawer system.
3. Confirm existing loading/empty/error/success behavior and mutable-data locks; create runtime tests for all role-view mappings.

## Task 5: Verification and delivery

Files: tests/visual/CampusPreview.vue, tests/visual/campus.html, tests/visual/campus.ts, docs/verification/2026-09-06-digital-campus.md.
1. Explicitly fictional preview with ADMIN/TEACHER/STUDENT switches and every destination, shared production components; no preview code imported into production.
2. Browser inspect desktop/mobile each role, navigation, user actions, profile/password, calendar, student duration and history. Fix discovered issues, do not claim mocks establish live writes.
3. Run npm test, npm run typecheck, npm run build, git diff --check after integration. Record exact results and missing live authentication verification.
4. Preserve old backup and deployed main. Commit new iteration on codex/digital-campus; no automatic production database mutation in this UI iteration.

## Integration outcome — September 6

## Authorized publication — September 6

User requested deployment. Create release branch from current remote main, apply verified UI commit, open PR, wait for CI, merge without rewriting history, dispatch Pages-only workflow from main, verify workflow and live HTML/assets. Preserve earlier main backup; no backend deployment or migration. Record resulting release identifiers below the verification report.

Tasks 1–4 are integrated locally. The main agent completed the interrupted teaching subtask, reviewed shared CSS collisions, reduced course pagination to four desktop/two mobile records, and connected calendar-selected blackout drafts directly to the form. Account avatar dialogs and explicit administrator action modes are wired in App. All-role offline browser preview and 73 tests pass; detailed evidence and live-validation limitations are in `docs/verification/2026-09-06-digital-campus.md`. Production publication is not part of the completed local verification.
