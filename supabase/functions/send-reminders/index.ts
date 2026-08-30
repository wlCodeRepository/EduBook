import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, options } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!cronSecret || request.headers.get("X-Reminder-Cron-Secret") !== cronSecret) {
    return json({ error: "unauthorized" }, 401);
  }
  const admin = createClient(url, serviceRoleKey);
  const { data: archived, error: archiveError } = await admin.rpc("archive_expired_bookings");
  if (archiveError) return json({ error: "archive_failed" }, 500);
  const from = new Date(Date.now() + 55 * 60 * 1000).toISOString();
  const until = new Date(Date.now() + 65 * 60 * 1000).toISOString();
  const { data: claims, error } = await admin.rpc("claim_due_reminders", {
    p_from: from, p_until: until, p_limit: 100,
  });
  if (error) return json({ error: "reminder_claim_failed" }, 500);

  // Provider delivery is intentionally a later iteration. Complete each claim
  // as FAILED so it is retryable; neither service keys nor claim tokens are returned.
  for (const claim of claims ?? []) {
    await admin.rpc("complete_notification_claim", {
      p_claim_token: claim.claim_token,
      p_success: false,
      p_error: "email_provider_not_configured",
    });
  }
  return json({ archived: archived ?? 0, claimed: claims?.length ?? 0, delivery: "pending_provider" });
});
