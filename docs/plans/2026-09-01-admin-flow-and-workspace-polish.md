# Admin Flow and Workspace Polish Implementation Plan

**Goal:** Make administrator account creation reliable and make every role land in a focused, responsive workspace.

**Architecture:** The Edge Function continues to use a verified Supabase user plus a service-role profile lookup for authorization. It distinguishes lookup failures from a valid non-admin caller. The Vue workspace derives a role-appropriate initial view and renders an explicit administrator onboarding state when no teaching accounts exist.

**Tech stack:** Vue 3, TypeScript, Vite, Supabase Edge Functions, Vitest, CSS.

## Tasks

### Task 1: Harden administrator authorization feedback

- Modify `supabase/functions/admin-create-user/index.ts`.
- Capture profile-query failures separately from a missing/non-admin profile.
- Return `operator_lookup_failed` with HTTP 500 only for the former; retain `admin_only` with HTTP 403 for the latter.
- Deploy the function with the existing GitHub Actions backend job.

### Task 2: Rebuild role landing and account-management UI

- Modify `src/App.vue` and `src/styles.css`; add `src/lib/navigation.ts`.
- Route administrators to the user-management view after profile restore.
- Add administrator onboarding, account totals, structured account form, complete booking empty states, and responsive layout.
- Preserve username/password-only login and never expose service-role credentials.

### Task 3: Regression checks and release

- Add `src/lib/navigation.test.ts` for administrator-route regression coverage.
- Run `npm run typecheck`, `npm run test:unit -- --run`, `npm run build`, and `git diff --check`.
- Merge, publish Pages and Edge Functions, then verify the deployment workflow and public URL.
