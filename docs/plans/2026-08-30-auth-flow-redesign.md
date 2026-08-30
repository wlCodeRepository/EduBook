# EduBook Authentication Flow Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide a conventional, dependable authentication experience with password login, six-digit signup verification, and six-digit password recovery.

**Architecture:** Supabase Auth remains the identity provider. The browser uses `signUp` to create an unconfirmed pending identity and send the signup code, then `verifyOtp({ type: 'email' })` to confirm it before creating the public profile. Password recovery uses `resetPasswordForEmail`, `verifyOtp({ type: 'recovery' })`, and `updateUser`. A small client-side state machine controls which fields are editable and prevents session/profile loading from racing with verification.

**Tech Stack:** Vue 3, TypeScript, Supabase JS v2, Vitest, GitHub Pages, custom SMTP.

---

### Task 1: Delivery configuration

- Confirm custom SMTP is enabled, sender email is non-empty and matches the SMTP account, and the SMTP password remains stored.
- Confirm `Confirm signup` and `Reset password` templates contain `{{ .Token }}` and no `{{ .ConfirmationURL }}`.
- Keep the Supabase Auth `Confirm email` setting enabled.

### Task 2: Signup state machine

- Details state collects name, email, password, role, and timezone.
- Submit calls `signUp`; only after a successful response does the UI move to code state.
- Code state renders the email as read-only and accepts exactly six digits.
- Verification uses `verifyOtp` with type `email`; only after success is the profile upserted.
- Add a resend action using Supabase `auth.resend({ type: 'signup', email })`, with a visible countdown and a deliberate restart action for a changed email.

### Task 3: Login and recovery

- Login uses `signInWithPassword`.
- Recovery uses email → six-digit code → new password.
- Keep recovery sessions out of the main workspace until the password update succeeds.
- Translate common Auth API error codes and clean up the Auth subscription on unmount.

### Verification

- `npm run typecheck`
- `npm run test:unit -- --run`
- `npm run build`
- `git diff --check`
- Inspect the published signup UI and Supabase configuration after deployment.
