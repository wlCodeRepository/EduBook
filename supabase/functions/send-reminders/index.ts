import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, options } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // Continue archiving completed bookings, but never create or send reminders.
  const archiveAdmin = createClient(url, serviceRoleKey);
  const { data: archived, error: archiveError } = await archiveAdmin.rpc("archive_expired_bookings");
  if (archiveError) return json({ error: "archive_failed" }, 500);
  return json({ archived: archived ?? 0, delivery: "disabled" });
  if (!cronSecret || request.headers.get("X-Reminder-Cron-Secret") !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }
  const admin = createClient(url, serviceRoleKey);
  const { data: archived, error: archiveError } = await admin.rpc("archive_expired_bookings");
  if (archiveError) return json({ error: "archive_failed" }, 500);
  return json({ archived: archived ?? 0, delivery: "disabled" });
});
