<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import AppSelect from "./components/AppSelect.vue";
import TeacherWeek from "./components/TeacherWeek.vue";
import AccountMenu from "./components/AccountMenu.vue";
import AccountCenter from "./components/AccountCenter.vue";
import TeacherBookings from "./components/TeacherBookings.vue";
import { bookingGroup } from "./lib/booking-groups";
import type { BookingSlot } from "./lib/booking";
import BookingStudio from "./components/BookingStudio.vue";
import LearningRoom from "./components/LearningRoom.vue";
import { studioLocalInstant } from "./lib/booking-studio";
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
    ...((
      Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone") || []),
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
const bookingReceipt = ref<BookingSlot | null>(null);
const availabilityLoading = ref(false);
const availabilityReady = ref(false);
const availabilityRange = ref({
  from: new Date(Date.now() - 86400000).toISOString(),
  until: new Date(Date.now() + 10 * 86400000).toISOString(),
});
let availabilityRequest = 0;
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
  timezone: detectedTimezone,
  defaultLessonMinutes: 60,
  password: "",
});
const creating = ref(false);
const accountSection = ref<"profile" | "password" | null>(null);
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
  teacherBookings.value.filter((item) => bookingGroup(item) === "pending"),
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
      user.id !== profile.value?.id &&
      (roleFilter.value === "ALL" || user.role === roleFilter.value) &&
      (!search.value.trim() ||
        `${user.display_name} ${user.username || ""} ${user.timezone}`
          .toLowerCase()
          .includes(search.value.trim().toLowerCase())),
  ),
);
function tr(en: string, zh: string) {
  return language.value === "en" ? en : zh;
}
const zoneOptions = computed(() =>
  Array.from(
    new Set([...zones, profileForm.value.timezone, editForm.value.timezone]),
  ).map((value) => ({ value, label: value })),
);
const roleOptions = computed(() => [
  { value: "TEACHER" as const, label: tr("Teacher", "老师") },
  { value: "STUDENT" as const, label: tr("Student", "学生") },
]);
const filterOptions = computed(() => [
  { value: "ALL" as const, label: tr("All roles", "全部角色") },
  ...roleOptions.value,
]);
function toggleLanguage() {
  language.value = language.value === "en" ? "zh" : "en";
  localStorage.setItem("edubook-language", language.value);
}
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
function dateInZone(value: string, zone = viewerTimezone.value) {
  return new Intl.DateTimeFormat(language.value === "zh" ? "zh-CN" : "en-GB", {
    timeZone: zone,
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
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
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let authTimer: ReturnType<typeof setTimeout> | undefined;
let authSubscription: { unsubscribe: () => void } | undefined;
function showToast(value: string) {
  clearTimeout(toastTimer);
  toast.value = value;
  toastTimer = setTimeout(() => {
    toast.value = "";
  }, 3500);
}
const title = computed(
  () =>
    ({
      overview: tr("Platform overview", "平台总览"),
      people: tr("People & accounts", "人员与账号"),
      bookings: tr("Global bookings", "全局预约"),
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
  if (!code && error instanceof Error) code = error.message;
  const known: Record<string, string> = {
    invalid_or_ambiguous_local_time: tr(
      "Choose a 15-minute time in your display timezone. This time may be skipped or repeated by daylight saving time.",
      "请按显示时区选择15分钟档位。该时间可能因夏令时不存在或重复，请选择其他时间。",
    ),
    immutable_account_fields: tr(
      "Username and role cannot be changed.",
      "登录账号和角色不可修改。",
    ),
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
    invalid_lesson_duration: tr(
      "The teacher's lesson length has changed or this duration is invalid. Reload and choose again.",
      "老师的单节时长已变更或所选时长无效，请刷新后重新选择。",
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
  await loadAvailability();
}
async function loadAvailability() {
  const teacherId =
    profile.value?.role === "TEACHER"
      ? profile.value.id
      : selectedTeacherId.value;
  if (!teacherId) return;
  const requestId = ++availabilityRequest;
  availabilityLoading.value = true;
  availabilityReady.value = false;
  try {
    const [blockedResult, busyResult] = await Promise.all([
      supabase
        .from("teacher_blocked_periods")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("start_at_utc"),
      supabase.functions.invoke("teacher-busy-slots", {
        body: { teacherId, ...availabilityRange.value },
      }),
    ]);
    if (requestId !== availabilityRequest) return;
    if (blockedResult.error) throw blockedResult.error;
    if (busyResult.error) throw busyResult.error;
    blocked.value = blockedResult.data as BlockedPeriod[];
    busySlots.value = (busyResult.data?.slots || []) as BusySlot[];
    availabilityReady.value = true;
  } catch (error) {
    if (requestId === availabilityRequest) await setError(error);
  } finally {
    if (requestId === availabilityRequest) availabilityLoading.value = false;
  }
}
async function changeRange(range: { from: string; until: string }) {
  availabilityRange.value = range;
  await loadAvailability();
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
      start_at_utc: studioLocalInstant(
        blockedForm.value.start,
        viewerTimezone.value,
      ),
      end_at_utc: studioLocalInstant(
        blockedForm.value.end,
        viewerTimezone.value,
      ),
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
function blockDate(date: string) {
  blockedForm.value = {
    start: `${date}T09:00`,
    end: `${date}T10:00`,
    reason: "",
  };
  activeNav.value = "settings";
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
async function profileUpdated(value: Profile) {
  profile.value = value;
  profileForm.value = {
    displayName: value.display_name,
    timezone: value.timezone,
    defaultLessonMinutes: value.default_lesson_minutes,
  };
  await loadData();
}
async function book(slot: BookingSlot) {
  if (
    busy.value ||
    availabilityLoading.value ||
    !availabilityReady.value ||
    !slot.available ||
    !currentTeacher.value
  )
    return;
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
    bookingReceipt.value = { ...slot };
    showToast(
      tr(
        "Booking request sent. The time is now reserved while your teacher decides.",
        "预约申请已提交，该时段会保留至老师处理。",
      ),
    );

    await loadData();
  } catch (error) {
    await loadAvailability();
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
  bookingReceipt.value = null;
  selectedTeacherId.value = id;
  await loadAvailability();
}
onMounted(async () => {
  const result = await supabase.auth.getSession();
  session.value = result.data.session
    ? { user: { id: result.data.session.user.id } }
    : null;
  if (session.value) await restore(session.value.user.id);
  const { data } = supabase.auth.onAuthStateChange((_event, next) => {
    session.value = next ? { user: { id: next.user.id } } : null;
    clearTimeout(authTimer);
    if (!next) {
      profile.value = null;
      return;
    }
    // Auth callbacks run under the session lock; defer API calls until it is released.
    // Password changes and token refreshes must not reset navigation or unsaved forms.
    if (profile.value?.id !== next.user.id) {
      authTimer = setTimeout(() => {
        void restore(next.user.id).catch(setError);
      }, 0);
    }
  });
  authSubscription = data.subscription;
});
onBeforeUnmount(() => {
  clearTimeout(toastTimer);
  clearTimeout(authTimer);
  authSubscription?.unsubscribe();
});
</script>

<template>
  <main v-if="!session || !profile" class="auth-shell space-auth">
    <LearningRoom :language="language" />
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
      <h1>{{ tr("Welcome back.", "欢迎回来。") }}</h1>
      <p class="auth-intro">
        {{
          tr(
            "Sign in to your learning workspace.",
            "登录账号，进入你的课程工作台。",
          )
        }}
      </p>
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
  <div
    v-else
    class="app-shell"
    :class="{ 'learning-shell': profile.role !== 'ADMIN' }"
  >
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
        >
      </nav>
      <AccountMenu
        :display-name="profile.display_name"
        :username="profile.username"
        :role-label="roleLabel(profile.role)"
        :language="language"
        @open="accountSection = $event"
        @signout="signOut"
      />
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
        <div class="topbar-actions">
          <span class="page-timezone">{{ viewerTimezone }}</span
          ><button class="language-button" @click="toggleLanguage">
            {{ copy.language }}
          </button>
        </div>
      </header>
      <div v-if="errorMessage" class="alert alert-error">
        <span>{{ errorMessage }}</span
        ><button class="text-button" @click="loadData">{{ copy.retry }}</button>
      </div>
      <p v-if="loading" class="week-note" role="status">
        {{ tr("Loading your workspace…", "正在加载工作台…") }}
      </p>
      <AccountCenter
        v-if="accountSection"
        :profile="profile"
        :section="accountSection"
        :language="language"
        :zones="zoneOptions"
        @close="accountSection = null"
        @updated="profileUpdated"
      />
      <template v-if="profile.role === 'ADMIN'"
        ><section v-if="activeNav === 'overview'" class="operations-layout">
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
                  }}<AppSelect
                    v-model="accountForm.role"
                    :options="roleOptions"
                    :label="tr('Role', '角色')" /></label
                ><label
                  >{{ tr("Timezone", "时区")
                  }}<AppSelect
                    v-model="accountForm.timezone"
                    :options="zoneOptions"
                    :label="tr('Search timezone', '搜索时区')"
                    searchable
                    :empty-label="tr('No results', '无匹配结果')" /></label
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
              /><AppSelect
                v-model="roleFilter"
                :options="filterOptions"
                :label="tr('Filter by role', '按角色筛选')"
              />
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
          class="teacher-layout"
        >
          <TeacherWeek
            :bookings="teacherBookings"
            :timezone="viewerTimezone"
            :language="language"
            can-block
            @block-date="blockDate"
          />
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
                step="900"
                :aria-label="
                  tr('Start time', '开始时间') + ' · ' + viewerTimezone
                "
                required
              /><input
                v-model="blockedForm.end"
                type="datetime-local"
                step="900"
                :aria-label="
                  tr('End time', '结束时间') + ' · ' + viewerTimezone
                "
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
        <TeacherBookings
          v-else
          :bookings="teacherBookings"
          :timezone="viewerTimezone"
          :language="language"
          :loading="loading"
          :error="errorMessage"
          @action="action"
      /></template>
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
        <div v-else>
          <LearningRoom
            :name="currentTeacher?.display_name"
            :minutes="currentTeacher?.default_lesson_minutes"
            :language="language"
          />
          <BookingStudio
            :receipt="bookingReceipt"
            :teachers="teachers"
            :selected-teacher-id="selectedTeacherId"
            :busy-slots="busySlots"
            :blocked="blocked"
            :timezone="viewerTimezone"
            :language="language"
            :busy="busy"
            :loading="loading || availabilityLoading"
            :error="
              !availabilityReady && !availabilityLoading ? errorMessage : ''
            "
            @select-teacher="selectTeacher"
            @range-change="changeRange"
            @submit="book"
          /></div
      ></template>
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
            }}<input :value="roleLabel(editing.role)" readonly /></label
          ><label
            >{{ tr("Username (cannot be changed)", "登录账号（不可修改）")
            }}<input :value="editing.username || ''" readonly /></label
          ><label
            >{{ tr("Timezone", "时区")
            }}<AppSelect
              v-model="editForm.timezone"
              :options="zoneOptions"
              :label="tr('Search timezone', '搜索时区')"
              searchable
              :empty-label="tr('No results', '无匹配结果')" /></label
          ><label v-if="editing.role === 'TEACHER'"
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
