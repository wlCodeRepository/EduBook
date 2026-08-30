import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, options } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // This endpoint is intended for Supabase Cron; protect it with the platform secret
  // or a signed scheduler request before enabling it in production.
  const admin = createClient(url, serviceRoleKey);
  const from = new Date(Date.now() + 55 * 60 * 1000).toISOString();
  const until = new Date(Date.now() + 65 * 60 * 1000).toISOString();
  const { data: bookings, error } = await admin.from("bookings")
    .select("id, teacher_id, student_id, start_at_utc, end_at_utc")
    .eq("status", "CONFIRMED").gte("start_at_utc", from).lt("start_at_utc", until);
  if (error) return json({ error: "reminder_lookup_failed" }, 500);

  // TODO: claim notification_logs rows idempotently, format per-recipient timezone,
  // and send through a provider using a Supabase secret. Never put provider tokens here.
  return json({ eligibleBookings: bookings?.length ?? 0, dryRun: true });
});
