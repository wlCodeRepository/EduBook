import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, options, parseJson } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, serviceRoleKey);
  const { data: operator, error: operatorError } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  // A missing service-role secret, database outage, or broken schema must not
  // masquerade as a permissions failure. The UI can then prompt an operator to
  // fix the deployment rather than incorrectly telling a real admin to retry.
  if (operatorError) return json({ error: "operator_lookup_failed" }, 500);
  if (!operator || operator.role !== "ADMIN") return json({ error: "admin_only" }, 403);

  const body = await parseJson(request);
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const role = body.role === "TEACHER" ? "TEACHER" : body.role === "STUDENT" ? "STUDENT" : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "";

  if (!/^[a-z0-9_.-]{3,40}$/.test(username)) return json({ error: "invalid_username" }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: "invalid_password" }, 400);
  if (!displayName || displayName.length > 120) return json({ error: "invalid_display_name" }, 400);
  if (!role || !validTimezone(timezone)) return json({ error: "invalid_account_profile" }, 400);

  // This domain is deliberately non-deliverable. email_confirm prevents Auth
  // from entering an email-confirmation flow, and no email is sent.
  const internalEmail = `${username}@accounts.edubook.internal`;
  const created = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, role, timezone, username },
  });
  if (created.error || !created.data.user) return json({ error: created.error?.code || "account_create_failed" }, 400);

  const profile = await admin.from("profiles").upsert({
    id: created.data.user.id,
    username,
    email: internalEmail,
    display_name: displayName,
    role,
    timezone,
    default_lesson_minutes: 60,
  }).select("id, username, display_name, role, timezone, default_lesson_minutes").single();
  if (profile.error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return json({ error: "profile_create_failed" }, 500);
  }
  return json({ user: profile.data }, 201);
});
