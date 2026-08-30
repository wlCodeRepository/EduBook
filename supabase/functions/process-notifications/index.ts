import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json, options } from "../_shared/http.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendKey = Deno.env.get("RESEND_API_KEY");
const fromAddress = Deno.env.get("MAIL_FROM") || "EduBook <onboarding@resend.dev>";

function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("zh-CN", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendKey) throw new Error("email_provider_not_configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`email_provider_${response.status}`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  if (!secret || request.headers.get("X-Notification-Cron-Secret") !== secret) return json({ error: "unauthorized" }, 401);
  const admin = createClient(url, serviceRoleKey);
  const { data: rows, error } = await admin.from("notification_logs").select("id, booking_id, recipient_id, notification_type, claim_token, bookings(start_at_utc, teacher_id, student_id)").in("status", ["PENDING", "FAILED"]).is("claimed_at", null).order("created_at").limit(100);
  if (error) return json({ error: "notification_read_failed" }, 500);
  let sent = 0; let failed = 0;
  for (const row of rows ?? []) {
    const claimToken = crypto.randomUUID();
    const claim = await admin.from("notification_logs").update({ claimed_at: new Date().toISOString(), claim_token: claimToken, attempts: (row as { attempts?: number }).attempts ? (row as { attempts: number }).attempts + 1 : 1 }).eq("id", row.id).in("status", ["PENDING", "FAILED"]).is("claimed_at", null).select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    const booking = Array.isArray(row.bookings) ? row.bookings[0] : row.bookings;
    const { data: recipient } = await admin.from("profiles").select("email, display_name, timezone").eq("id", row.recipient_id).single();
    if (!recipient || !booking) continue;
    const time = formatTime(booking.start_at_utc, recipient.timezone);
    const subject = row.notification_type === "BOOKING_CREATED" ? "EduBook：收到新的预约申请" : row.notification_type === "BOOKING_CONFIRMED" ? "EduBook：预约已确认" : row.notification_type === "BOOKING_REJECTED" ? "EduBook：预约未能确认" : row.notification_type === "BOOKING_CANCELLED" ? "EduBook：预约已取消" : "EduBook：课程将在 1 小时后开始";
    const message = row.notification_type === "BOOKING_CREATED" ? "有学生提交了新的课程预约申请，请登录工作台处理。" : row.notification_type === "BOOKING_CONFIRMED" ? "老师已确认你的课程预约。" : row.notification_type === "BOOKING_REJECTED" ? "老师暂时无法确认这次预约，你可以重新选择其他时间。" : row.notification_type === "BOOKING_CANCELLED" ? "老师已取消这次已确认的课程，请留意后续安排。" : "你的课程即将开始，请提前做好准备。";
    try { await sendEmail(recipient.email, subject, `<p>${recipient.display_name}，您好：</p><p>${message}</p><p>课程时间：<strong>${time}（${recipient.timezone}）</strong></p><p>EduBook</p>`); await admin.rpc("complete_notification_claim", { p_claim_token: claimToken, p_success: true }); sent += 1; } catch (deliveryError) { await admin.rpc("complete_notification_claim", { p_claim_token: claimToken, p_success: false, p_error: deliveryError instanceof Error ? deliveryError.message : "email_delivery_failed" }); failed += 1; }
  }
  return json({ processed: sent + failed, sent, failed });
});
