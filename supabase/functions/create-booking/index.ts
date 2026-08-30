import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isIsoDate, isUuid, json, options, parseJson } from "../_shared/http.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc("create_booking", {
    p_teacher_id: teacherId,
    p_student_id: user.id,
    p_start_at_utc: startAtUtc,
    p_end_at_utc: endAtUtc,
  });
  if (error) {
    if (["23P01"].includes(error.code) || error.message.includes("blocked_period")) return json({ error: "slot_unavailable" }, 409);
    if (error.code === "P0002" && error.message === "teacher_not_found") return json({ error: "teacher_not_found" }, 404);
    if (error.code === "42501") return json({ error: "student_only" }, 403);
    if (error.code === "22023") return json({ error: error.message }, 400);
    return json({ error: "booking_create_failed" }, 500);
  }
  return json({ booking: data }, 201);
});
