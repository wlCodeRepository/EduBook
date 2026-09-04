# Operations workspace verification record

## Automated checks

Run from the repository root after implementation:

```powershell
npm run typecheck
npm run test:unit -- --run
npm run build
git diff --check
```

## Required production sequence

1. Apply `202609010005_free_form_booking_slots.sql` to the Supabase project.
2. Deploy `admin-operations` with the other Edge Functions.
3. Publish the GitHub Pages build.
4. Sign in as an administrator and exercise create, edit, password reset and delete against a disposable teacher/student account; verify the dashboard figures refresh.

The first two steps mutate external production systems and must be explicitly authorised at deployment time.

## Result on 2026-09-04

- `npm run typecheck` passed.
- `npm run test:unit -- --run` passed: 3 files, 8 tests.
- `npm run build` passed.
- `git diff --check` passed.
- Supabase/Deno CLI was not installed on this workstation, so the new Edge Function has frontend/type-level coverage and will receive its deployment verification from the GitHub Actions Supabase CLI job.
