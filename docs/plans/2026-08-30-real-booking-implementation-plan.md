# EduBook 真实预约链路 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将当前演示工作台接入已创建的 Supabase 项目，使学生和老师可以真实登录、配置资料、查看时段、提交与处理预约。

**Architecture:** 浏览器通过 Supabase Auth 和 anon key 读取公开排期及本人数据；所有预约创建与状态流转继续经过已部署的 Edge Functions，避免浏览器绕过并发与权限校验。前端使用 IANA 时区在本地生成周排期并转换显示，数据库仍只保存 UTC。

**Tech Stack:** Vue 3, TypeScript, Vite, Supabase JS, PostgreSQL/RLS, Edge Functions, Vitest, GitHub Actions/Pages.

---

### Task 1: Supabase client and auth/profile flow

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`
- Modify: `src/main.ts`, `src/App.vue`, `src/styles.css`, `.env.example`
- Test: `src/App.test.ts`

Implement sign-in/sign-up, profile creation, role and IANA timezone selection, session restore, sign-out, loading/error states, and a setup screen for users without profiles.

### Task 2: Student booking vertical slice

**Files:**
- Create: `src/lib/booking.ts`
- Modify: `src/App.vue`, `src/styles.css`
- Test: `src/lib/booking.test.ts`, `src/App.test.ts`

Load teachers, availability, blocked periods and active bookings through Supabase. Generate future slots in the teacher timezone, convert for the viewer, submit through `create-booking`, and render the student's history.

### Task 3: Teacher operations vertical slice

**Files:**
- Modify: `src/App.vue`, `src/styles.css`
- Create: `src/lib/teacher.ts`
- Test: `src/lib/teacher.test.ts`

Allow teachers to manage weekly availability, lesson length, blocked periods, review requests, confirm/reject pending bookings, and cancel confirmed bookings. Keep all mutation controls role-scoped.

### Task 4: Notifications and scheduled processing

**Files:**
- Create: `supabase/functions/process-notifications/index.ts`
- Create: `supabase/migrations/202608300002_notifications.sql`
- Modify: `supabase/functions/create-booking/index.ts`, `supabase/functions/booking-action/index.ts`, `.github/workflows/ci.yml`
- Create: `docs/api-contracts.md`, `docs/deployment/production-secrets.md`

Add a server-side notification processor with Resend-compatible secret configuration, retry behavior, reminder processing, and a documented Cron invocation. Keep provider secrets out of the client and repository.

### Task 5: Verification and release

Run `npm ci`, `npm run typecheck`, `npm run test:unit -- --run`, `npm run build`, migration checks, browser smoke tests, and the deployed GitHub Actions workflow. Record results in `docs/iterations/STATUS.md` and update README with the live setup.
