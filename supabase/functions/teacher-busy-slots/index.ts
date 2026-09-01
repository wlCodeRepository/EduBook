import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isIsoDate, isUuid, json, options, parseJson } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await parseJson(request); } catch { return json({ error: "invalid_json" }, 400); }
  const teacherId = body.teacherId;
  const from = body.from;
  const until = body.until;
  if (!isUuid(teacherId) || !isIsoDate(from) || !isIsoDate(until) || new Date(until) <= new Date(from)) {
    return json({ error: "invalid_busy_slot_input" }, 400);
  }

  const admin = createClient(url, serviceRoleKey);
  const { data, error } = await admin.rpc("list_teacher_busy_slots", {
    p_teacher_id: teacherId,
    p_from: from,
    p_until: until,
  });
  if (error) return json({ error: error.code === "22023" ? error.message : "busy_slots_failed" }, 400);
  return json({ slots: data ?? [] });
});
