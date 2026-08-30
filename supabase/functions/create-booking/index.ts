import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isIsoDate, isUuid, json, options, parseJson } from "../_shared/http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // The caller's JWT is forwarded so auth.getUser() and RLS see the real user.
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await parseJson(request); } catch { return json({ error: "invalid_json" }, 400); }
  const teacherId = body.teacherId;
  const startAtUtc = body.startAtUtc;
  const endAtUtc = body.endAtUtc;
  if (!isUuid(teacherId) || !isIsoDate(startAtUtc) || !isIsoDate(endAtUtc) ||
    new Date(startAtUtc).getTime() <= Date.now() ||
    new Date(endAtUtc).getTime() <= new Date(startAtUtc).getTime()) {
    return json({ error: "invalid_booking_input" }, 400);
  }

  const { data: teacher } = await client.from("profiles").select("role").eq("id", teacherId).single();
  if (!teacher || teacher.role !== "TEACHER") return json({ error: "teacher_not_found" }, 404);

  // TODO: validate the slot against weekly availability and blocked periods server-side.
  // The exclusion constraint remains the final concurrency boundary.
  const { data, error } = await client.from("bookings").insert({
    teacher_id: teacherId,
    student_id: user.id,
    start_at_utc: startAtUtc,
    end_at_utc: endAtUtc,
    status: "PENDING",
  }).select().single();
  if (error) {
    // PostgreSQL exclusion violations are surfaced as a conflict, never retried blindly.
    if (error.code === "23P01") return json({ error: "slot_unavailable" }, 409);
    return json({ error: "booking_create_failed" }, 500);
  }
  return json({ booking: data }, 201);
});
