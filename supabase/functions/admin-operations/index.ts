import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUuid, json, options, parseJson } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; }
  catch { return false; }
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return { error: "unauthorized" as const };
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return { error: "unauthorized" as const };
  const admin = createClient(url, serviceRoleKey);
  const { data: operator, error: operatorError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (operatorError) return { error: "operator_lookup_failed" as const };
  if (!operator || operator.role !== "ADMIN") return { error: "admin_only" as const };
  return { admin, operatorId: user.id };
}

async function listAccounts(admin: ReturnType<typeof createClient>, operatorId: string) {
  const { data, error } = await admin.from("profiles")
    .select("id,username,display_name,role,timezone,default_lesson_minutes,created_at")
    .neq("id", operatorId)
    .order("created_at", { ascending: false });
  if (error) return json({ error: "account_list_failed" }, 500);
  return json({ users: data });
}

async function dashboard(admin: ReturnType<typeof createClient>) {
  const [profiles, allBookings, recentBookings] = await Promise.all([
    admin.from("profiles").select("id,role"),
    admin.from("bookings").select("status, start_at_utc, end_at_utc"),
    admin.from("bookings").select("id,teacher_id,student_id,start_at_utc,end_at_utc,status,cancellation_reason,created_at").order("created_at", { ascending: false }).limit(12),
  ]);
  if (profiles.error || allBookings.error || recentBookings.error) return json({ error: "dashboard_load_failed" }, 500);
  const accountById = new Map<string, { display_name: string; timezone: string }>();
  const ids = Array.from(new Set((recentBookings.data || []).flatMap((item) => [item.teacher_id, item.student_id])));
  if (ids.length) {
    const { data: people, error } = await admin.from("profiles").select("id,display_name,timezone").in("id", ids);
    if (error) return json({ error: "dashboard_load_failed" }, 500);
    for (const person of people || []) accountById.set(person.id, person);
  }
  const now = Date.now();
  const weekEnd = now + 7 * 24 * 60 * 60 * 1000;
  const counts = { teachers: 0, students: 0, pending: 0, confirmed: 0, completed: 0, upcoming: 0 };
  for (const person of profiles.data || []) {
    if (person.role === "TEACHER") counts.teachers += 1;
    if (person.role === "STUDENT") counts.students += 1;
  }
  for (const booking of allBookings.data || []) {
    if (booking.status === "PENDING") counts.pending += 1;
    if (booking.status === "CONFIRMED") counts.confirmed += 1;
    if (booking.status === "COMPLETED") counts.completed += 1;
    const start = Date.parse(booking.start_at_utc);
    if (["PENDING", "CONFIRMED"].includes(booking.status) && start >= now && start < weekEnd) counts.upcoming += 1;
  }
  const recent = (recentBookings.data || []).map((booking) => ({
    ...booking,
    teacher: accountById.get(booking.teacher_id) || null,
    student: accountById.get(booking.student_id) || null,
  }));
  return json({ counts, recent });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const access = await requireAdmin(request);
  if ("error" in access) return json({ error: access.error }, access.error === "unauthorized" ? 401 : access.error === "admin_only" ? 403 : 500);
  const body = await parseJson(request);
  const operation = body.operation;

  if (operation === "list") return listAccounts(access.admin, access.operatorId);
  if (operation === "dashboard") return dashboard(access.admin);

  const userId = body.userId;
  if (!isUuid(userId)) return json({ error: "invalid_account" }, 400);
  const { data: target, error: targetError } = await access.admin.from("profiles").select("id,role").eq("id", userId).maybeSingle();
  if (targetError) return json({ error: "account_lookup_failed" }, 500);
  if (!target) return json({ error: "account_not_found" }, 404);
  // The scope of this endpoint is teacher/student administration. This prevents
  // a routine operational action from removing or demoting all administrators.
  if (target.role === "ADMIN") return json({ error: "administrator_account_protected" }, 403);

  if (operation === "update") {
    if ('role' in body || 'username' in body) return json({ error: "immutable_account_fields" }, 400);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const timezone = typeof body.timezone === "string" ? body.timezone : "";
    const minutes = Number(body.defaultLessonMinutes);
    if (!displayName || displayName.length > 120 || !validTimezone(timezone) || !Number.isInteger(minutes) || minutes < 5 || minutes > 240) {
      return json({ error: "invalid_account_profile" }, 400);
    }
    const { data, error } = await access.admin.from("profiles").update({ display_name: displayName, timezone, default_lesson_minutes: minutes }).eq("id", userId)
      .select("id,username,display_name,role,timezone,default_lesson_minutes,created_at").single();
    if (error) return json({ error: "account_update_failed" }, 500);
    const { error: metadataError } = await access.admin.auth.admin.updateUserById(userId, { user_metadata: { display_name: displayName, timezone } });
    if (metadataError) return json({ error: "auth_metadata_update_failed" }, 500);
    return json({ user: data });
  }

  if (operation === "reset_password") {
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8 || password.length > 128) return json({ error: "invalid_password" }, 400);
    const { error } = await access.admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: "password_reset_failed" }, 500);
    return json({ ok: true });
  }

  if (operation === "delete") {
    const { count, error: bookingError } = await access.admin.from("bookings").select("id", { count: "exact", head: true }).or(`teacher_id.eq.${userId},student_id.eq.${userId}`);
    if (bookingError) return json({ error: "account_lookup_failed" }, 500);
    if ((count || 0) > 0) return json({ error: "account_has_booking_history" }, 409);
    const { error } = await access.admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: "account_delete_failed" }, 500);
    return json({ ok: true });
  }
  return json({ error: "unsupported_operation" }, 400);
});
