import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUuid, json, options, parseJson } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  // Verify the caller before using the service-role client; never trust a role from JSON.
  const authClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const admin = createClient(url, serviceRoleKey);
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "TEACHER") return json({ error: "teacher_only" }, 403);

  let body: Record<string, unknown>;
  try { body = await parseJson(request); } catch { return json({ error: "invalid_json" }, 400); }
  const bookingId = body.bookingId;
  const action = body.action;
  if (!isUuid(bookingId) || !["confirm", "reject", "cancel"].includes(String(action))) {
    return json({ error: "invalid_action_input" }, 400);
  }

  const reason = body.cancellationReason;
  if (reason !== undefined && typeof reason !== "string") return json({ error: "invalid_cancellation_reason" }, 400);
  const { data, error } = await admin.rpc("apply_booking_action", {
    p_booking_id: bookingId,
    p_teacher_id: user.id,
    p_action: action,
    p_cancellation_reason: typeof reason === "string" ? reason : null,
  });
  if (error) {
    if (error.code === "P0002") return json({ error: "booking_not_found_or_transition_conflict" }, 409);
    if (error.code === "22023") return json({ error: error.message }, 400);
    return json({ error: "booking_action_failed" }, 500);
  }
  return json({ booking: data });
});
