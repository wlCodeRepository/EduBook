<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  createCustomBookingSlot,
  formatDateTimeInput,
  formatViewerTime,
} from "./lib/booking";
import { messages, type Language } from "./lib/i18n";
import { initialNavForRole } from "./lib/navigation";
import { supabase, supabaseConfigured } from "./lib/supabase";
import type {
  AdminBooking,
  AdminDashboardCounts,
  AdminUser,
  BlockedPeriod,
  Booking,
  BusySlot,
  Profile,
  Role,
} from "./lib/types";

type Operation = "list" | "dashboard" | "update" | "reset_password" | "delete";
const language = ref<Language>(
  (localStorage.getItem("edubook-language") as Language) || "en",
);
const copy = computed(() => messages[language.value]);
const detectedTimezone =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const zones = Array.from(
  new Set([
    detectedTimezone,
    "UTC",
    "Asia/Shanghai",
    "Asia/Tokyo",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
  ]),
);
const session = ref<{ user: { id: string } } | null>(null);
const profile = ref<Profile | null>(null);
const auth = ref({ username: "", password: "" });
const activeNav = ref("book");
const loading = ref(false);
const busy = ref(false);
const errorMessage = ref("");
const toast = ref("");
const teachers = ref<Profile[]>([]);
const bookings = ref<Booking[]>([]);
const blocked = ref<BlockedPeriod[]>([]);
const busySlots = ref<BusySlot[]>([]);
const selectedTeacherId = ref("");
const bookingStart = ref(
  formatDateTimeInput(new Date(Date.now() + 15 * 60_000), detectedTimezone),
);
const selectedSlot = ref<ReturnType<typeof createCustomBookingSlot>>(null);
const blockedForm = ref({ start: "", end: "", reason: "" });
const users = ref<AdminUser[]>([]);
const adminBookings = ref<AdminBooking[]>([]);
const dashboard = ref<AdminDashboardCounts>({
  teachers: 0,
  students: 0,
  pending: 0,
  confirmed: 0,
  completed: 0,
  upcoming: 0,
});
const search = ref("");
const roleFilter = ref<"ALL" | "TEACHER" | "STUDENT">("ALL");
const accountForm = ref({
  username: "",
  password: "",
  displayName: "",
  role: "TEACHER" as "TEACHER" | "STUDENT",
  timezone: detectedTimezone,
});
const editing = ref<AdminUser | null>(null);
const editForm = ref({
  displayName: "",
  role: "TEACHER" as "TEACHER" | "STUDENT",
  timezone: detectedTimezone,
  defaultLessonMinutes: 60,
  password: "",
});
const creating = ref(false);
const profileForm = ref({
  displayName: "",
  timezone: detectedTimezone,
  defaultLessonMinutes: 60,
});
const viewerTimezone = computed(
  () => profile.value?.timezone || detectedTimezone,
);
const currentTeacher = computed(
  () =>
    teachers.value.find((item) => item.id === selectedTeacherId.value) ||
    teachers.value[0],
);
const studentBookings = computed(() =>
  bookings.value.filter((item) => item.student_id === profile.value?.id),
);
const teacherBookings = computed(() =>
  bookings.value.filter((item) => item.teacher_id === profile.value?.id),
);
const pendingTeacherBookings = computed(() =>
  teacherBookings.value.filter((item) => item.status === "PENDING"),
);
const upcomingTeacherBookings = computed(() =>
  teacherBookings.value
    .filter(
      (item) =>
        item.status === "CONFIRMED" && new Date(item.end_at_utc) > new Date(),
    )
    .sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc)),
);
const filteredUsers = computed(() =>
  users.value.filter(
    (user) =>
      (roleFilter.value === "ALL" || user.role === roleFilter.value) &&
      (!search.value.trim() ||
        `${user.display_name} ${user.username || ""} ${user.timezone}`
          .toLowerCase()
          .includes(search.value.trim().toLowerCase())),
  ),
);
const proposal = computed(() =>
  currentTeacher.value
    ? createCustomBookingSlot(
        bookingStart.value,
        viewerTimezone.value,
        currentTeacher.value.timezone,
        currentTeacher.value.default_lesson_minutes,
        blocked.value,
        busySlots.value,
      )
    : null,
);
function tr(en: string, zh: string) {
  return language.value === "en" ? en : zh;
}
function toggleLanguage() {
  language.value = language.value === "en" ? "zh" : "en";
  localStorage.setItem("edubook-language", language.value);
}
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
function dateInZone(value: string, zone = viewerTimezone.value) {
  return formatViewerTime(value, zone);
}
function statusLabel(status: string) {
  return (
    {
      PENDING: tr("Pending", "待确认"),
      CONFIRMED: tr("Confirmed", "已确认"),
      REJECTED: tr("Declined", "已拒绝"),
      CANCELLED: tr("Cancelled", "已取消"),
      COMPLETED: tr("Completed", "已完成"),
    }[status] || status
  );
}
function roleLabel(role: Role) {
  return role === "TEACHER"
    ? tr("Teacher", "老师")
    : role === "ADMIN"
      ? tr("Administrator", "管理员")
      : tr("Student", "学生");
}
function showToast(value: string) {
  toast.value = value;
  window.setTimeout(() => {
    toast.value = "";
  }, 3500);
}
const title = computed(
  () =>
    ({
      overview: tr("Platform overview", "平台总览"),
      people: tr("People & accounts", "人员与账号"),
      bookings: tr("Global bookings", "全局预约"),
      profile: tr("Personal settings", "个人设置"),
      "teacher-overview": tr("Teaching overview", "授课总览"),
      requests: tr("Booking requests", "预约申请"),
      settings: tr("Lesson settings", "课程设置"),
      history: tr("My lessons", "我的课程"),
    })[activeNav.value] || copy.value.findLesson,
);
async function setError(error: unknown) {
  let code = "";
  if (typeof error === "object" && error !== null && "context" in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        code = String(
          ((await context.clone().json()) as { error?: string }).error || "",
        );
      } catch {
        /* fallback */
      }
    } else if (context && typeof context === "object" && "error" in context)
      code = String((context as { error?: string }).error || "");
  }
  const known: Record<string, string> = {
    unauthorized: tr(
      "Your session has expired. Please sign in again.",
      "登录已过期，请重新登录。",
    ),
    admin_only: tr("Administrator access is required.", "需要管理员权限。"),
    operator_lookup_failed: tr(
      "The administrator service is unavailable. Please retry in a moment.",
      "管理员服务暂不可用，请稍后重试。",
    ),
    teacher_only: tr(
      "Only teachers can perform this action.",
      "只有老师可以执行此操作。",
    ),
    student_only: tr(
      "Only students can submit booking requests.",
      "只有学生可以提交预约。",
    ),
    slot_unavailable: tr(
      "This time was just taken. Please choose another one.",
      "该时间刚被占用，请选择其他时间。",
    ),
    invalid_account_profile: tr(
      "Choose a valid role, timezone and lesson duration.",
      "请选择有效的角色、时区和课程时长。",
    ),
    invalid_password: tr(
      "Passwords must be 8–128 characters.",
      "密码长度需为 8–128 位。",
    ),
    administrator_account_protected: tr(
      "Administrator accounts are protected here.",
      "管理员账号受保护，不能在此操作。",
    ),
    account_has_booking_history: tr(
      "This account has booking history and cannot be deleted. Keep it for the record.",
      "该账号已有预约历史，不能删除，请保留用于历史记录。",
    ),
  };
  errorMessage.value =
    known[code] ||
    (error instanceof Error &&
    error.message !== "Edge Function returned a non-2xx status code"
      ? error.message
      : code || copy.value.authGeneric);
}
async function adminOperation<T>(
  operation: Operation,
  payload: Record<string, unknown> = {},
) {
  const result = await supabase.functions.invoke("admin-operations", {
    body: { operation, ...payload },
  });
  if (result.error) throw result.error;
  return result.data as T;
}
async function loadAdmin() {
  const [accounts, overview] = await Promise.all([
    adminOperation<{ users: AdminUser[] }>("list"),
    adminOperation<{ counts: AdminDashboardCounts; recent: AdminBooking[] }>(
      "dashboard",
    ),
  ]);
  users.value = accounts.users || [];
  dashboard.value = overview.counts;
  adminBookings.value = overview.recent || [];
}
async function loadRole() {
  if (!profile.value) return;
  const teacherResult = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "TEACHER")
    .order("display_name");
  if (teacherResult.error) throw teacherResult.error;
  teachers.value = teacherResult.data as Profile[];
  if (!selectedTeacherId.value && teachers.value[0])
    selectedTeacherId.value = teachers.value[0].id;
  const bookingResult = await supabase
    .from("bookings")
    .select("*")
    .or(`student_id.eq.${profile.value.id},teacher_id.eq.${profile.value.id}`)
    .order("start_at_utc", { ascending: false });
  if (bookingResult.error) throw bookingResult.error;
  const records = bookingResult.data as Booking[];
  const ids = Array.from(
    new Set(records.flatMap((item) => [item.teacher_id, item.student_id])),
  );
  if (ids.length) {
    const people = await supabase.from("profiles").select("*").in("id", ids);
    if (people.error) throw people.error;
    const byId = new Map(
      (people.data as Profile[]).map((item) => [item.id, item]),
    );
    bookings.value = records.map((item) => ({
      ...item,
      teacher: byId.get(item.teacher_id),
      student: byId.get(item.student_id),
    }));
  } else bookings.value = records;
  const teacherId =
    profile.value.role === "TEACHER"
      ? profile.value.id
      : selectedTeacherId.value;
  if (!teacherId) return;
  const blockedResult = await supabase
    .from("teacher_blocked_periods")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("start_at_utc");
  if (blockedResult.error) throw blockedResult.error;
  blocked.value = blockedResult.data as BlockedPeriod[];
  const candidate = proposal.value
    ? new Date(proposal.value.startAtUtc)
    : new Date();
  const busyResult = await supabase.functions.invoke("teacher-busy-slots", {
    body: {
      teacherId,
      from: new Date(candidate.getTime() - 86_400_000).toISOString(),
      until: new Date(candidate.getTime() + 172_800_000).toISOString(),
    },
  });
  if (busyResult.error) throw busyResult.error;
  busySlots.value = (busyResult.data?.slots || []) as BusySlot[];
}
async function loadData() {
  if (!profile.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    if (profile.value.role === "ADMIN") await loadAdmin();
    else await loadRole();
  } catch (error) {
    await setError(error);
  } finally {
    loading.value = false;
  }
}
async function restore(id: string) {
  const result = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (result.error || !result.data) {
    await setError(result.error || new Error("profile_not_found"));
    return;
  }
  profile.value = result.data as Profile;
  profileForm.value = {
    displayName: profile.value.display_name,
    timezone: profile.value.timezone,
    defaultLessonMinutes: profile.value.default_lesson_minutes,
  };
  activeNav.value = initialNavForRole(profile.value.role);
  await loadData();
}
async function signIn() {
  busy.value = true;
  try {
    if (!supabaseConfigured) throw new Error(copy.value.setupMissing);
    const result = await supabase.auth.signInWithPassword({
      email: `${auth.value.username.trim().toLowerCase()}@accounts.edubook.internal`,
      password: auth.value.password,
    });
    if (result.error) throw result.error;
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function signOut() {
  await supabase.auth.signOut();
  session.value = null;
  profile.value = null;
  errorMessage.value = "";
}
async function createUser() {
  busy.value = true;
  try {
    const result = await supabase.functions.invoke("admin-create-user", {
      body: accountForm.value,
    });
    if (result.error) throw result.error;
    const role = accountForm.value.role;
    accountForm.value = {
      username: "",
      password: "",
      displayName: "",
      role,
      timezone: detectedTimezone,
    };
    creating.value = false;
    showToast(
      tr(
        "Account created. Share the username and temporary password securely.",
        "账号已创建，请通过安全方式提供账号与临时密码。",
      ),
    );
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
function openCreate() {
  accountForm.value = {
    username: "",
    password: "",
    displayName: "",
    role: "TEACHER",
    timezone: detectedTimezone,
  };
  creating.value = true;
}
function openEdit(user: AdminUser) {
  editing.value = user;
  editForm.value = {
    displayName: user.display_name,
    role: user.role === "STUDENT" ? "STUDENT" : "TEACHER",
    timezone: user.timezone,
    defaultLessonMinutes: user.default_lesson_minutes,
    password: "",
  };
}
async function saveAccount() {
  if (!editing.value) return;
  busy.value = true;
  try {
    await adminOperation("update", {
      userId: editing.value.id,
      displayName: editForm.value.displayName,
      role: editForm.value.role,
      timezone: editForm.value.timezone,
      defaultLessonMinutes: editForm.value.defaultLessonMinutes,
    });
    if (editForm.value.password)
      await adminOperation("reset_password", {
        userId: editing.value.id,
        password: editForm.value.password,
      });
    editing.value = null;
    showToast(tr("Account updated.", "账号已更新。"));
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function deleteAccount(user: AdminUser) {
  if (
    !window.confirm(
      tr(
        `Delete ${user.display_name}? This only works when the account has no booking history.`,
        `确定删除 ${user.display_name} 吗？仅没有预约历史的账号可删除。`,
      ),
    )
  )
    return;
  busy.value = true;
  try {
    await adminOperation("delete", { userId: user.id });
    editing.value = null;
    showToast(tr("Account deleted.", "账号已删除。"));
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function addBlocked() {
  if (!profile.value || !blockedForm.value.start || !blockedForm.value.end)
    return;
  try {
    const result = await supabase.from("teacher_blocked_periods").insert({
      teacher_id: profile.value.id,
      start_at_utc: new Date(blockedForm.value.start).toISOString(),
      end_at_utc: new Date(blockedForm.value.end).toISOString(),
      reason: blockedForm.value.reason || null,
    });
    if (result.error) throw result.error;
    blockedForm.value = { start: "", end: "", reason: "" };
    showToast(tr("Blackout saved.", "不可预约时段已保存。"));
    await loadData();
  } catch (error) {
    await setError(error);
  }
}
async function removeBlocked(id: string) {
  try {
    const result = await supabase
      .from("teacher_blocked_periods")
      .delete()
      .eq("id", id);
    if (result.error) throw result.error;
    await loadData();
  } catch (error) {
    await setError(error);
  }
}
async function saveMinutes() {
  if (!profile.value) return;
  try {
    const result = await supabase.rpc("update_my_profile", {
      p_display_name: profile.value.display_name,
      p_timezone: profile.value.timezone,
      p_default_lesson_minutes: profile.value.default_lesson_minutes,
    });
    if (result.error) throw result.error;
    profile.value = result.data as Profile;
    showToast(tr("Lesson duration saved.", "课程时长已保存。"));
  } catch (error) {
    await setError(error);
  }
}
async function saveProfile() {
  if (!profile.value) return;
  busy.value = true;
  try {
    const minutes =
      profile.value.role === "TEACHER"
        ? profileForm.value.defaultLessonMinutes
        : profile.value.default_lesson_minutes;
    const result = await supabase.rpc("update_my_profile", {
      p_display_name: profileForm.value.displayName,
      p_timezone: profileForm.value.timezone,
      p_default_lesson_minutes: minutes,
    });
    if (result.error) throw result.error;
    profile.value = result.data as Profile;
    profileForm.value = {
      displayName: profile.value.display_name,
      timezone: profile.value.timezone,
      defaultLessonMinutes: profile.value.default_lesson_minutes,
    };
    showToast(tr("Personal settings saved.", "个人信息已保存。"));
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function refreshProposal() {
  selectedSlot.value = proposal.value;
  await loadRole();
}
async function book() {
  const slot = proposal.value;
  if (!slot || !slot.available || !currentTeacher.value) return;
  busy.value = true;
  try {
    const result = await supabase.functions.invoke("create-booking", {
      body: {
        teacherId: currentTeacher.value.id,
        startAtUtc: slot.startAtUtc,
        endAtUtc: slot.endAtUtc,
      },
    });
    if (result.error) throw result.error;
    showToast(
      tr(
        "Booking request sent. The time is now reserved while your teacher decides.",
        "预约申请已提交，该时段会保留至老师处理。",
      ),
    );
    selectedSlot.value = null;
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function action(id: string, value: "confirm" | "reject" | "cancel") {
  try {
    const result = await supabase.functions.invoke("booking-action", {
      body: { bookingId: id, action: value },
    });
    if (result.error) throw result.error;
    showToast(tr("Booking updated.", "预约已更新。"));
    await loadData();
  } catch (error) {
    await setError(error);
  }
}
async function selectTeacher(id: string) {
  selectedTeacherId.value = id;
  selectedSlot.value = null;
  await loadRole();
}
onMounted(async () => {
  const result = await supabase.auth.getSession();
  session.value = result.data.session
    ? { user: { id: result.data.session.user.id } }
    : null;
  if (session.value) await restore(session.value.user.id);
  supabase.auth.onAuthStateChange(async (_event, next) => {
    session.value = next ? { user: { id: next.user.id } } : null;
    if (next) await restore(next.user.id);
  });
});
</script>

<template>
  <main v-if="!session || !profile" class="auth-shell">
    <section class="auth-card">
      <div class="auth-top">
        <div class="brand">
          <span class="brand-mark">E</span><span>EduBook</span>
        </div>
        <button class="language-button" @click="toggleLanguage">
          {{ copy.language }}
        </button>
      </div>
      <p class="eyebrow">{{ copy.workspace }}</p>
      <h1>{{ copy.loginTitle }}</h1>
      <p class="auth-intro">{{ copy.intro }}</p>
      <p v-if="!supabaseConfigured" class="alert alert-error">
        {{ copy.setupMissing }}
      </p>
      <form @submit.prevent="signIn">
        <label
          >{{ tr("Username", "账号名")
          }}<input
            v-model="auth.username"
            autocomplete="username"
            required /></label
        ><label
          >{{ copy.password
          }}<input
            v-model="auth.password"
            type="password"
            autocomplete="current-password"
            minlength="8"
            required
        /></label>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <button class="primary-button" :disabled="busy || !supabaseConfigured">
          {{ busy ? copy.processing : copy.login }}
        </button>
      </form>
      <p class="auth-note">
        {{
          tr(
            "Accounts are created by an administrator. No email is required.",
            "账户由管理员创建，无需邮箱。",
          )
        }}
      </p>
    </section>
  </main>
  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">E</span><span>EduBook</span>
      </div>
      <p class="workspace-label">
        {{
          profile.role === "ADMIN"
            ? tr("Platform operations", "平台运营")
            : profile.role === "TEACHER"
              ? tr("Teaching workspace", "授课工作台")
              : copy.workspace
        }}
      </p>
      <nav class="nav-list">
        <template v-if="profile.role === 'ADMIN'"
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'overview' }"
            @click="activeNav = 'overview'"
          >
            {{ tr("Overview", "总览") }}</button
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'people' }"
            @click="activeNav = 'people'"
          >
            {{ tr("People", "人员") }}</button
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'bookings' }"
            @click="activeNav = 'bookings'"
          >
            {{ tr("Bookings", "预约") }}
          </button></template
        ><template v-else-if="profile.role === 'TEACHER'"
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'teacher-overview' }"
            @click="activeNav = 'teacher-overview'"
          >
            {{ tr("Overview", "总览") }}</button
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'requests' }"
            @click="activeNav = 'requests'"
          >
            {{ tr("Requests", "预约申请")
            }}<span v-if="pendingTeacherBookings.length" class="nav-count">{{
              pendingTeacherBookings.length
            }}</span></button
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'settings' }"
            @click="activeNav = 'settings'"
          >
            {{ tr("Lesson settings", "课程设置") }}
          </button></template
        ><template v-else
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'book' }"
            @click="activeNav = 'book'"
          >
            {{ tr("Book a lesson", "预约课程") }}</button
          ><button
            class="nav-item"
            :class="{ active: activeNav === 'history' }"
            @click="activeNav = 'history'"
          >
            {{ tr("My lessons", "我的课程") }}
          </button></template
        ><button
          class="nav-item"
          :class="{ active: activeNav === 'profile' }"
          @click="activeNav = 'profile'"
        >
          {{ tr("Profile", "个人信息") }}
        </button>
      </nav>
      <div class="profile-mini">
        <span class="avatar avatar-user">{{
          initials(profile.display_name)
        }}</span>
        <div>
          <strong>{{ profile.display_name }}</strong
          ><small>{{ roleLabel(profile.role) }} · {{ profile.timezone }}</small>
        </div>
        <button class="signout" @click="signOut">{{ copy.signOut }}</button>
      </div>
    </aside>
    <section class="main-content">
      <header class="topbar">
        <div>
          <p class="eyebrow">
            {{
              new Intl.DateTimeFormat(language === "en" ? "en-US" : "zh-CN", {
                dateStyle: "full",
                timeZone: viewerTimezone,
              }).format(new Date())
            }}
          </p>
          <h1>{{ title }}</h1>
        </div>
        <button class="language-button" @click="toggleLanguage">
          {{ copy.language }}
        </button>
      </header>
      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span
        ><button class="text-button" @click="loadData">{{ copy.retry }}</button>
      </div>
      <section v-if="activeNav === 'profile'" class="profile-layout">
        <div class="profile-intro">
          <span class="avatar avatar-user profile-avatar">{{
            initials(profile.display_name)
          }}</span>
          <div>
            <p class="eyebrow">{{ tr("Your account", "我的账号") }}</p>
            <h2>
              {{
                tr(
                  "Keep your teaching and learning details current.",
                  "维护准确的个人资料，让预约时间始终正确。",
                )
              }}
            </h2>
            <p>
              {{
                tr(
                  "Your username and role are managed by an administrator. You can update the details that shape how EduBook works for you.",
                  "登录账号和角色由管理员维护；你可以更新会影响个人使用体验的信息。",
                )
              }}
            </p>
          </div>
        </div>
        <form class="panel profile-form" @submit.prevent="saveProfile">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">{{ tr("Personal details", "个人资料") }}</p>
              <h3>{{ tr("Profile preferences", "资料偏好") }}</h3>
            </div>
            <span class="role-tag" :class="profile.role.toLowerCase()">{{
              roleLabel(profile.role)
            }}</span>
          </div>
          <label
            >{{ tr("Display name", "显示名称")
            }}<input
              v-model="profileForm.displayName"
              required
              maxlength="120" /></label
          ><label
            >{{ tr("Timezone", "时区")
            }}<select v-model="profileForm.timezone">
              <option v-for="zone in zones" :key="zone">
                {{ zone }}
              </option></select
            ><small>{{
              tr(
                "All lesson times are displayed in this timezone.",
                "所有课程时间会按此时区显示。",
              )
            }}</small></label
          ><label v-if="profile.role === 'TEACHER'"
            >{{ tr("Default lesson duration", "默认课程时长") }}
            <div class="inline-field">
              <input
                v-model.number="profileForm.defaultLessonMinutes"
                type="number"
                min="5"
                max="240"
                step="5"
                required
              /><span>{{ tr("minutes", "分钟") }}</span>
            </div>
            <small>{{
              tr(
                "New booking requests must use this duration.",
                "新的预约申请必须使用该时长。",
              )
            }}</small></label
          >
          <div class="profile-form-footer">
            <div>
              <span>{{ tr("Username", "登录账号") }}</span
              ><strong>@{{ profile.username || "—" }}</strong>
            </div>
            <button class="primary-button" :disabled="busy">
              {{
                busy
                  ? copy.processing
                  : tr("Save personal settings", "保存个人信息")
              }}
            </button>
          </div>
        </form>
      </section>
      <template v-else-if="profile.role === 'ADMIN'"
        ><section v-if="activeNav === 'overview'" class="operations-layout">
          <div class="overview-hero">
            <div>
              <p class="eyebrow">{{ tr("Operations pulse", "运营脉搏") }}</p>
              <h2>
                {{
                  tr(
                    "Every account and lesson, in one calm view.",
                    "让每个账号与每次课程，都在同一处清晰呈现。",
                  )
                }}
              </h2>
              <p>
                {{
                  tr(
                    "Track capacity, pending decisions and the latest platform activity without leaving the workspace.",
                    "不离开工作台，即可掌握人员规模、待处理预约与最新平台动态。",
                  )
                }}
              </p>
            </div>
            <button class="outline-button light" @click="activeNav = 'people'">
              {{ tr("Manage people", "管理人员") }}
            </button>
          </div>
          <div class="stat-grid">
            <article class="stat-card">
              <span>{{ tr("Teachers", "老师") }}</span
              ><strong>{{ dashboard.teachers }}</strong
              ><small>{{ tr("Teaching accounts", "授课账号") }}</small>
            </article>
            <article class="stat-card">
              <span>{{ tr("Students", "学生") }}</span
              ><strong>{{ dashboard.students }}</strong
              ><small>{{ tr("Learning accounts", "学习账号") }}</small>
            </article>
            <article class="stat-card">
              <span>{{ tr("Pending", "待确认") }}</span
              ><strong>{{ dashboard.pending }}</strong
              ><small>{{ tr("Awaiting teachers", "等待老师处理") }}</small>
            </article>
            <article class="stat-card">
              <span>{{ tr("Next 7 days", "未来 7 天") }}</span
              ><strong>{{ dashboard.upcoming }}</strong
              ><small>{{ tr("Reserved lessons", "已占用课程") }}</small>
            </article>
          </div>
          <section class="panel activity-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">{{ tr("Latest activity", "最新动态") }}</p>
                <h3>{{ tr("Recent bookings", "最近预约") }}</h3>
              </div>
              <button class="text-button" @click="activeNav = 'bookings'">
                {{ tr("View all", "查看全部") }}
              </button>
            </div>
            <div v-if="adminBookings.length" class="activity-list">
              <article
                v-for="booking in adminBookings.slice(0, 6)"
                :key="booking.id"
                class="activity-row"
              >
                <span class="avatar avatar-teal">{{
                  initials(booking.teacher?.display_name || "?")
                }}</span>
                <div>
                  <strong
                    >{{
                      booking.student?.display_name || tr("Student", "学生")
                    }}
                    →
                    {{
                      booking.teacher?.display_name || tr("Teacher", "老师")
                    }}</strong
                  ><small>{{ dateInZone(booking.start_at_utc) }}</small>
                </div>
                <span
                  class="status-pill"
                  :class="booking.status.toLowerCase()"
                  >{{ statusLabel(booking.status) }}</span
                >
              </article>
            </div>
            <div v-else class="empty-state compact">
              <span class="empty-glyph">○</span>
              <h3>{{ tr("No booking activity yet", "还没有预约动态") }}</h3>
              <p>
                {{
                  tr(
                    "Once students submit requests, the live queue will appear here.",
                    "学生提交预约后，动态会显示在这里。",
                  )
                }}
              </p>
            </div>
          </section>
        </section>
        <section v-else-if="activeNav === 'people'" class="operations-layout">
          <div class="section-bar">
            <div>
              <p class="eyebrow">{{ tr("Directory", "账号目录") }}</p>
              <h2>{{ tr("Teachers and students", "老师与学生") }}</h2>
            </div>
            <div class="directory-summary">
              <span>{{ users.length }} {{ tr("accounts", "个账号") }}</span
              ><button class="primary-button" @click="openCreate">
                {{ tr("Add person", "新增用户") }}
              </button>
            </div>
          </div>
          <section
            v-if="creating"
            class="modal-backdrop"
            @click.self="creating = false"
          >
            <section class="modal-card create-account-dialog">
              <div class="panel-heading">
                <div>
                  <p class="eyebrow">{{ tr("Create account", "创建账号") }}</p>
                  <h3>
                    {{
                      tr(
                        "Open a teacher or student account",
                        "新增老师或学生账号",
                      )
                    }}
                  </h3>
                </div>
                <div class="dialog-heading-actions">
                  <span class="secure-note">{{
                    tr("No email required", "无需邮箱")
                  }}</span
                  ><button
                    type="button"
                    class="text-button dialog-close"
                    :aria-label="tr('Close create account', '关闭新增用户')"
                    @click="creating = false"
                  >
                    ×
                  </button>
                </div>
              </div>
              <form class="account-form" @submit.prevent="createUser">
                <label
                  >{{ tr("Username", "登录账号")
                  }}<input
                    v-model="accountForm.username"
                    required
                    pattern="[A-Za-z0-9_.-]{3,40}" /></label
                ><label
                  >{{ tr("Temporary password", "临时密码")
                  }}<input
                    v-model="accountForm.password"
                    type="password"
                    minlength="8"
                    required /></label
                ><label
                  >{{ tr("Display name", "显示名称")
                  }}<input v-model="accountForm.displayName" required /></label
                ><label
                  >{{ tr("Role", "角色")
                  }}<select v-model="accountForm.role">
                    <option value="TEACHER">{{ tr("Teacher", "老师") }}</option>
                    <option value="STUDENT">{{ tr("Student", "学生") }}</option>
                  </select></label
                ><label
                  >{{ tr("Timezone", "时区")
                  }}<select v-model="accountForm.timezone">
                    <option v-for="zone in zones" :key="zone">
                      {{ zone }}
                    </option>
                  </select></label
                ><button class="primary-button" :disabled="busy">
                  {{ tr("Create account", "创建账号") }}
                </button>
              </form>
            </section>
          </section>
          <section class="panel directory-panel">
            <div class="directory-tools">
              <input
                v-model="search"
                :placeholder="
                  tr(
                    'Search name, username or timezone',
                    '搜索姓名、账号或时区',
                  )
                "
              /><select v-model="roleFilter">
                <option value="ALL">{{ tr("All roles", "所有角色") }}</option>
                <option value="TEACHER">{{ tr("Teachers", "老师") }}</option>
                <option value="STUDENT">{{ tr("Students", "学生") }}</option>
              </select>
            </div>
            <div v-if="filteredUsers.length" class="directory-list">
              <article
                v-for="user in filteredUsers"
                :key="user.id"
                class="directory-row"
              >
                <span
                  class="avatar"
                  :class="
                    user.role === 'TEACHER'
                      ? 'avatar-teal'
                      : user.role === 'STUDENT'
                        ? 'avatar-gold'
                        : 'avatar-user'
                  "
                  >{{ initials(user.display_name) }}</span
                >
                <div>
                  <strong>{{ user.display_name }}</strong
                  ><small
                    >@{{ user.username || "—" }} · {{ user.timezone }}</small
                  >
                </div>
                <span class="role-tag" :class="user.role.toLowerCase()">{{
                  roleLabel(user.role)
                }}</span
                ><small
                  >{{ user.default_lesson_minutes }}
                  {{ tr("min lesson", "分钟/节") }}</small
                ><button
                  v-if="user.role !== 'ADMIN'"
                  class="outline-button small"
                  @click="openEdit(user)"
                >
                  {{ tr("Edit", "编辑") }}</button
                ><span v-else class="protected">{{
                  tr("Protected", "受保护")
                }}</span>
              </article>
            </div>
            <div v-else class="empty-state compact">
              <span class="empty-glyph">+</span>
              <h3>{{ tr("No matching people", "没有匹配账号") }}</h3>
              <p>
                {{
                  tr(
                    "Try another filter or create a new account above.",
                    "请调整筛选条件，或使用上方表单创建账号。",
                  )
                }}
              </p>
            </div>
          </section>
        </section>
        <section v-else class="panel booking-list">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">{{ tr("Platform record", "平台记录") }}</p>
              <h3>{{ tr("Latest global bookings", "最新全局预约") }}</h3>
            </div>
            <span>{{ adminBookings.length }}</span>
          </div>
          <div v-if="adminBookings.length" class="booking-records">
            <article
              v-for="booking in adminBookings"
              :key="booking.id"
              class="booking-record"
            >
              <div>
                <strong
                  >{{ booking.student?.display_name || "—" }} →
                  {{ booking.teacher?.display_name || "—" }}</strong
                ><small
                  >{{ dateInZone(booking.start_at_utc) }} ·
                  {{ tr("teacher", "老师") }}
                  {{ booking.teacher?.timezone }}</small
                >
              </div>
              <span class="status-pill" :class="booking.status.toLowerCase()">{{
                statusLabel(booking.status)
              }}</span>
            </article>
          </div>
          <div v-else class="empty-state">
            <span class="empty-glyph">○</span>
            <h3>{{ tr("No bookings yet", "还没有预约") }}</h3>
            <p>
              {{
                tr(
                  "Platform booking history will remain visible here.",
                  "平台预约历史会保留在这里。",
                )
              }}
            </p>
          </div>
        </section></template
      >
      <template v-else-if="profile.role === 'TEACHER'"
        ><section
          v-if="activeNav === 'teacher-overview'"
          class="operations-layout"
        >
          <div class="overview-hero">
            <div>
              <p class="eyebrow">{{ tr("Teaching desk", "授课工作台") }}</p>
              <h2>
                {{
                  tr(
                    "Your calendar stays open until you protect time.",
                    "默认开放你的时间，直到你主动保护它。",
                  )
                }}
              </h2>
              <p>
                {{
                  tr(
                    "Students can request any future 15-minute start. Add blackouts only for the time you need to keep free.",
                    "学生可预约任意未来的 15 分钟档位；仅需把需要保留的时间设置为不可预约。",
                  )
                }}
              </p>
            </div>
            <button
              class="outline-button light"
              @click="activeNav = 'settings'"
            >
              {{ tr("Set blackout", "设置不可预约") }}
            </button>
          </div>
          <div class="stat-grid">
            <article class="stat-card">
              <span>{{ tr("Pending", "待确认") }}</span
              ><strong>{{ pendingTeacherBookings.length }}</strong
              ><small>{{ tr("Requests to decide", "等待你处理") }}</small>
            </article>
            <article class="stat-card">
              <span>{{ tr("Upcoming", "即将开始") }}</span
              ><strong>{{ upcomingTeacherBookings.length }}</strong
              ><small>{{ tr("Confirmed lessons", "已确认课程") }}</small>
            </article>
            <article class="stat-card">
              <span>{{ tr("Lesson length", "课程时长") }}</span
              ><strong>{{ profile.default_lesson_minutes }}</strong
              ><small>{{ tr("minutes", "分钟") }}</small>
            </article>
          </div>
          <section class="panel activity-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">{{ tr("Next lesson", "下一节课程") }}</p>
                <h3>{{ tr("Confirmed teaching", "已确认授课") }}</h3>
              </div>
              <button class="text-button" @click="activeNav = 'requests'">
                {{ tr("Open requests", "打开申请") }}
              </button>
            </div>
            <div v-if="upcomingTeacherBookings[0]" class="next-lesson">
              <span class="avatar avatar-teal">{{
                initials(
                  upcomingTeacherBookings[0].student?.display_name ||
                    tr("Student", "学生"),
                )
              }}</span>
              <div>
                <strong>{{
                  upcomingTeacherBookings[0].student?.display_name ||
                  tr("Student", "学生")
                }}</strong
                ><small
                  >{{ dateInZone(upcomingTeacherBookings[0].start_at_utc) }} –
                  {{ dateInZone(upcomingTeacherBookings[0].end_at_utc) }}</small
                >
              </div>
            </div>
            <div v-else class="empty-state compact">
              <span class="empty-glyph">○</span>
              <h3>{{ tr("No confirmed lessons", "还没有已确认课程") }}</h3>
              <p>
                {{
                  tr(
                    "New student requests will appear in your inbox.",
                    "新的学生预约会出现在申请列表中。",
                  )
                }}
              </p>
            </div>
          </section>
        </section>
        <section v-else-if="activeNav === 'settings'" class="settings-layout">
          <section class="panel setting-card">
            <p class="eyebrow">{{ tr("Lesson duration", "课程时长") }}</p>
            <h3>{{ tr("Default lesson length", "默认每节课时长") }}</h3>
            <p>
              {{
                tr(
                  "Every new request must use this exact duration.",
                  "每一条新预约都会使用这个时长。",
                )
              }}
            </p>
            <div class="duration-row">
              <input
                v-model.number="profile.default_lesson_minutes"
                type="number"
                min="5"
                max="240"
                step="5"
              /><span>min</span
              ><button class="primary-button" @click="saveMinutes">
                {{ tr("Save", "保存") }}
              </button>
            </div>
          </section>
          <section class="panel setting-card">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">{{ tr("Protected time", "保护时间") }}</p>
                <h3>{{ tr("Blackout periods", "不可预约时段") }}</h3>
              </div>
              <span>{{ blocked.length }}</span>
            </div>
            <p>
              {{
                tr(
                  "These are the only times students cannot request by default.",
                  "这是默认开放规则下，学生不能预约的唯一时间。",
                )
              }}
            </p>
            <form class="blocked-form" @submit.prevent="addBlocked">
              <input
                v-model="blockedForm.start"
                type="datetime-local"
                required
              /><input
                v-model="blockedForm.end"
                type="datetime-local"
                required
              /><input
                v-model="blockedForm.reason"
                :placeholder="tr('Reason (optional)', '原因（可选）')"
              /><button class="primary-button">
                {{ tr("Add blackout", "新增不可预约") }}
              </button>
            </form>
            <div v-if="blocked.length" class="setting-list">
              <article
                v-for="period in blocked"
                :key="period.id"
                class="setting-row"
              >
                <div>
                  <strong
                    >{{ dateInZone(period.start_at_utc) }} –
                    {{ dateInZone(period.end_at_utc) }}</strong
                  ><small>{{
                    period.reason || tr("No reason supplied", "未填写原因")
                  }}</small>
                </div>
                <button
                  class="text-button danger"
                  @click="removeBlocked(period.id)"
                >
                  {{ tr("Remove", "移除") }}
                </button>
              </article>
            </div>
          </section>
        </section>
        <section v-else class="panel booking-list">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">{{ tr("Decision queue", "待处理队列") }}</p>
              <h3>{{ tr("Student booking requests", "学生预约申请") }}</h3>
            </div>
            <span
              >{{ pendingTeacherBookings.length }}
              {{ tr("pending", "待处理") }}</span
            >
          </div>
          <div v-if="teacherBookings.length" class="booking-records">
            <article
              v-for="booking in teacherBookings"
              :key="booking.id"
              class="booking-record"
            >
              <div>
                <strong>{{
                  booking.student?.display_name || tr("Student", "学生")
                }}</strong
                ><small
                  >{{ dateInZone(booking.start_at_utc) }} –
                  {{ dateInZone(booking.end_at_utc) }}</small
                >
              </div>
              <span class="status-pill" :class="booking.status.toLowerCase()">{{
                statusLabel(booking.status)
              }}</span>
              <div class="row-actions">
                <button
                  v-if="booking.status === 'PENDING'"
                  class="mini-button"
                  @click="action(booking.id, 'confirm')"
                >
                  {{ copy.confirm }}</button
                ><button
                  v-if="booking.status === 'PENDING'"
                  class="mini-button ghost"
                  @click="action(booking.id, 'reject')"
                >
                  {{ copy.reject }}</button
                ><button
                  v-if="booking.status === 'CONFIRMED'"
                  class="mini-button ghost"
                  @click="action(booking.id, 'cancel')"
                >
                  {{ copy.cancel }}
                </button>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <span class="empty-glyph">○</span>
            <h3>{{ tr("No requests yet", "还没有预约申请") }}</h3>
            <p>
              {{
                tr(
                  "New requests will arrive here when a student chooses an open time.",
                  "学生选择可预约时间后，申请会显示在这里。",
                )
              }}
            </p>
          </div>
        </section></template
      >
      <template v-else
        ><section v-if="activeNav === 'history'" class="panel booking-list">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">{{ tr("Learning record", "学习记录") }}</p>
              <h3>{{ tr("Your bookings", "你的预约") }}</h3>
            </div>
          </div>
          <div v-if="studentBookings.length" class="booking-records">
            <article
              v-for="booking in studentBookings"
              :key="booking.id"
              class="booking-record"
            >
              <div>
                <strong>{{
                  booking.teacher?.display_name || tr("Teacher", "老师")
                }}</strong
                ><small
                  >{{ dateInZone(booking.start_at_utc) }} –
                  {{ dateInZone(booking.end_at_utc) }}</small
                >
              </div>
              <span class="status-pill" :class="booking.status.toLowerCase()">{{
                statusLabel(booking.status)
              }}</span>
            </article>
          </div>
          <div v-else class="empty-state">
            <span class="empty-glyph">○</span>
            <h3>{{ tr("No bookings yet", "还没有预约") }}</h3>
            <p>
              {{
                tr(
                  "Choose a teacher and a future time to send your first request.",
                  "选择一位老师和未来时间，即可发送第一条预约申请。",
                )
              }}
            </p>
          </div>
        </section>
        <section v-else class="booking-workspace">
          <div class="booking-intro">
            <p class="eyebrow">
              {{ tr("Shown in", "当前显示时区") }} · {{ viewerTimezone }}
            </p>
            <h2>
              {{
                tr(
                  "Choose a teacher, then a time that fits.",
                  "选择老师，再挑选适合你的时间。",
                )
              }}
            </h2>
            <p>
              {{
                tr(
                  "Teachers are open by default. Select any future 15-minute start; existing lessons and teacher blackouts are unavailable.",
                  "老师默认可被预约。请选择任意未来的 15 分钟档位；已有课程和老师设置的不可预约时段会被拦截。",
                )
              }}
            </p>
          </div>
          <div v-if="!teachers.length" class="empty-state full-empty">
            <span class="empty-glyph">+</span>
            <h3>{{ tr("No teachers yet", "还没有老师") }}</h3>
            <p>
              {{
                tr(
                  "An administrator needs to create a teaching account first.",
                  "管理员需要先创建老师账号。",
                )
              }}
            </p>
          </div>
          <template v-else
            ><div class="teacher-picker">
              <button
                v-for="teacher in teachers"
                :key="teacher.id"
                class="teacher-card"
                :class="{ chosen: currentTeacher?.id === teacher.id }"
                @click="selectTeacher(teacher.id)"
              >
                <span class="avatar avatar-teal">{{
                  initials(teacher.display_name)
                }}</span
                ><span
                  ><strong>{{ teacher.display_name }}</strong
                  ><small
                    >{{ teacher.default_lesson_minutes }} min ·
                    {{ teacher.timezone }}</small
                  ></span
                ><span class="teacher-check">{{
                  currentTeacher?.id === teacher.id ? "✓" : ""
                }}</span>
              </button>
            </div>
            <div class="availability-layout">
              <section class="panel time-panel">
                <p class="eyebrow">{{ tr("Pick a start", "选择开始时间") }}</p>
                <h3>{{ currentTeacher?.display_name }}</h3>
                <p class="timezone-note">
                  {{
                    tr(
                      "Enter a time in your timezone. Starts are available every 15 minutes.",
                      "按你的时区输入时间。每 15 分钟可选一个开始档位。",
                    )
                  }}
                </p>
                <label class="datetime-field"
                  ><span>{{ viewerTimezone }}</span
                  ><input
                    v-model="bookingStart"
                    type="datetime-local"
                    step="900"
                    @change="refreshProposal" /></label
                ><button class="outline-button" @click="refreshProposal">
                  {{ tr("Check availability", "检查是否可约") }}
                </button>
                <div
                  v-if="proposal"
                  class="proposal-state"
                  :class="{ available: proposal.available }"
                >
                  <strong>{{
                    proposal.available
                      ? tr("This time is available", "该时间可以预约")
                      : tr("This time is unavailable", "该时间不可预约")
                  }}</strong
                  ><span
                    >{{ proposal.viewerStart }} – {{ proposal.viewerEnd }}</span
                  >
                </div>
              </section>
              <aside class="booking-summary">
                <p class="eyebrow">{{ tr("Request review", "预约确认") }}</p>
                <h3>
                  {{
                    selectedSlot?.available
                      ? tr("Ready to request?", "确认提交预约？")
                      : tr("Choose an available time", "请选择可预约时间")
                  }}
                </h3>
                <template v-if="selectedSlot"
                  ><div class="summary-detail">
                    <span>{{ tr("Teacher", "老师") }}</span
                    ><strong>{{ currentTeacher?.display_name }}</strong>
                  </div>
                  <div class="summary-detail">
                    <span>{{ tr("Your time", "你的时间") }}</span
                    ><strong
                      >{{ selectedSlot.viewerStart }} –
                      {{ selectedSlot.viewerEnd }}</strong
                    >
                  </div>
                  <div class="summary-detail">
                    <span>{{ tr("Teacher local time", "老师当地时间") }}</span
                    ><strong
                      >{{ selectedSlot.localDate }} ·
                      {{ selectedSlot.localStart }} –
                      {{ selectedSlot.localEnd }}</strong
                    >
                  </div></template
                >
                <p v-else class="summary-placeholder">
                  {{
                    tr(
                      "Check a time to review the lesson before submitting.",
                      "检查时间后，即可在提交前确认课程详情。",
                    )
                  }}
                </p>
                <button
                  class="primary-button"
                  :disabled="!selectedSlot?.available || busy"
                  @click="book"
                >
                  {{ busy ? copy.submitting : copy.submit }}</button
                ><small>{{
                  tr(
                    "A pending request reserves this time until the teacher responds.",
                    "待确认申请会占用该时间，直到老师处理。",
                  )
                }}</small>
              </aside>
            </div></template
          >
        </section></template
      >
    </section>
    <div v-if="editing" class="modal-backdrop" @click.self="editing = null">
      <section class="modal-card">
        <div class="panel-heading">
          <div>
            <p class="eyebrow">{{ tr("Account settings", "账号设置") }}</p>
            <h3>{{ editing.display_name }}</h3>
          </div>
          <button class="text-button" @click="editing = null">×</button>
        </div>
        <form class="edit-form" @submit.prevent="saveAccount">
          <label
            >{{ tr("Display name", "显示名称")
            }}<input v-model="editForm.displayName" required /></label
          ><label
            >{{ tr("Role", "角色")
            }}<select v-model="editForm.role">
              <option value="TEACHER">{{ tr("Teacher", "老师") }}</option>
              <option value="STUDENT">{{ tr("Student", "学生") }}</option>
            </select></label
          ><label
            >{{ tr("Timezone", "时区")
            }}<select v-model="editForm.timezone">
              <option v-for="zone in zones" :key="zone">{{ zone }}</option>
            </select></label
          ><label
            >{{ tr("Lesson duration (minutes)", "课程时长（分钟）")
            }}<input
              v-model.number="editForm.defaultLessonMinutes"
              type="number"
              min="5"
              max="240"
              step="5"
              required /></label
          ><label
            >{{ tr("New password (optional)", "新密码（可选）")
            }}<input
              v-model="editForm.password"
              type="password"
              minlength="8"
              :placeholder="
                tr('Leave blank to keep current password', '留空则保持原密码')
              "
          /></label>
          <div class="modal-actions">
            <button
              type="button"
              class="text-button danger"
              @click="deleteAccount(editing)"
            >
              {{ tr("Delete account", "删除账号") }}</button
            ><button class="primary-button" :disabled="busy">
              {{ tr("Save changes", "保存修改") }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
  <div v-if="toast" class="toast" role="status">{{ toast }}</div>
</template>
