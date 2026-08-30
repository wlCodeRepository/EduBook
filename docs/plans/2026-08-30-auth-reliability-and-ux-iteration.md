# EduBook Authentication Reliability and UX Iteration Plan

**Goal:** Make password sign-in, email-code recovery, and the responsive auth experience reliable for real users without changing the booking data model.

**Architecture:** Keep Supabase Auth as the source of truth. Treat password recovery as a distinct UI mode that can be entered either after a recovery OTP or after a recovery redirect, and keep profile loading paused until the password update is complete. Map common Auth API errors to localized, actionable messages in the client.

**Tech Stack:** Vue 3, TypeScript, Supabase JS v2, Vitest, GitHub Pages.

---

### Scope

1. Make the initial recovery session safe when a user returns through a recovery URL or verifies an OTP.
2. Release the Supabase auth subscription when the component is unmounted.
3. Translate common authentication failures instead of exposing raw provider errors.
4. Keep resend and reset controls usable on narrow mobile screens.
5. Add regression coverage for the recovery view and document the expected email-template configuration.

### Verification

- `npm run typecheck`
- `npm run test:unit -- --run`
- `npm run build`
- `git diff --check`
- Publish to GitHub Pages and inspect the deployed auth DOM with a cache-busting URL.
