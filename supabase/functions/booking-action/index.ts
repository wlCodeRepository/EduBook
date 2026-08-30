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

  // Enforce the lifecycle boundary before updating; notification emission will be added
  // as an atomic outbox operation in the notification iteration.
  const { data: current, error: lookupError } = await admin.from("bookings")
    .select("status").eq("id", bookingId).eq("teacher_id", user.id).single();
  if (lookupError || !current) return json({ error: "booking_not_found" }, 404);
  const allowed = (action === "confirm" || action === "reject") && current.status === "PENDING" ||
    action === "cancel" && current.status === "CONFIRMED";
  if (!allowed) return json({ error: "invalid_booking_transition" }, 409);

  // This first-round skeleton scopes the update to the authenticated teacher.
  const nextStatus = action === "confirm" ? "CONFIRMED" : action === "reject" ? "REJECTED" : "CANCELLED";
  const patch: Record<string, string> = { status: nextStatus };
  if (nextStatus === "CONFIRMED") patch.confirmed_at = new Date().toISOString();
  if (nextStatus === "CANCELLED") patch.cancelled_at = new Date().toISOString();
  if (typeof body.cancellationReason === "string") patch.cancellation_reason = body.cancellationReason.slice(0, 500);
  const { data, error } = await admin.from("bookings").update(patch)
    .eq("id", bookingId).eq("teacher_id", user.id).select().single();
  if (error) return json({ error: "booking_action_failed" }, 409);
  return json({ booking: data });
});
