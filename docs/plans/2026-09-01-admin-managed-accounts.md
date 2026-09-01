# Admin-managed accounts and email-free operation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove end-user email dependency and all email delivery from EduBook. Accounts are created by administrators and users sign in with a username and password.

**Architecture:** Supabase Auth remains the identity provider. The browser converts a username to a non-deliverable internal Auth email for password sign-in. Only the `admin-create-user` Edge Function can create accounts, after verifying the caller has the `ADMIN` profile role. It sets `email_confirm: true` and writes the profile with service-role access. Booking notification and reminder functions are safe no-ops; expiry archiving remains enabled.

**Tech Stack:** Vue 3, TypeScript, Supabase Auth, PostgreSQL, Supabase Edge Functions, GitHub Pages.

## Tasks

1. Add `ADMIN` role and nullable profile username migration.
2. Add authenticated admin-only account creation Edge Function with server-side validation.
3. Replace public signup/recovery UI with username/password login and admin user-management panel.
4. Disable notification delivery while preserving booking completion archiving.
5. Update CI deployment, API/deployment documentation, and frontend regression tests.

## Bootstrap

The first administrator is created in Supabase Authentication → Users, then promoted with the SQL documented in `docs/deployment/admin-accounts.md`. All later accounts are created from the application.

## Verification

- `npm run typecheck`
- `npm run test:unit -- --run`
- `npm run build`
- `git diff --check`
- Deploy the migration and `admin-create-user` function before using the admin panel.
