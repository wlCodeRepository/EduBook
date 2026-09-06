<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import AppSelect from "./components/AppSelect.vue";
import CampusShell from "./components/CampusShell.vue";
import CampusDrawer from "./components/CampusDrawer.vue";
import AdminCampus from "./components/AdminCampus.vue";
import PeopleDirectory from "./components/PeopleDirectory.vue";
import TeacherCampus from "./components/TeacherCampus.vue";
import TeacherSettings from "./components/TeacherSettings.vue";
import CampusLessons from "./components/CampusLessons.vue";
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
const accountMode = ref<"edit" | "reset" | "delete">("edit");
const resetPassword = ref("");
function openAccountAction(user: AdminUser, mode: "edit" | "reset" | "delete") {
  if (busy.value || user.role === "ADMIN" || user.id === profile.value?.id)
    return;
  openEdit(user);
  accountMode.value = mode;
  resetPassword.value = "";
  errorMessage.value = "";
}
async function resetAccountPassword() {
  if (!editing.value || busy.value || resetPassword.value.length < 8) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    await adminOperation("reset_password", {
      userId: editing.value.id,
      password: resetPassword.value,
    });
    resetPassword.value = "";
    editing.value = null;
    showToast(
      tr(
        "Password reset. Share it securely.",
        "密码已重置，请安全地交付新密码。",
      ),
    );
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
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
function toggleLanguage() {
  language.value = language.value === "en" ? "zh" : "en";
  localStorage.setItem("edubook-language", language.value);
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
    start_time_must_be_teacher_hour: tr('Choose an hourly start in the teacher’s timezone.','请选择老师时区的整点开始时间。'),
    invalid_lesson_duration: tr('Each lesson is 50 minutes, with 10 minutes between lessons. Please select again.','每节50分钟，课间10分钟，请重新选择。'),
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
  if (busy.value) return;
  errorMessage.value = "";
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
  if (busy.value) return;
  errorMessage.value = "";
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
  if (!editing.value || busy.value) return;
  errorMessage.value = "";
  busy.value = true;
  try {
    await adminOperation("update", {
      userId: editing.value.id,
      displayName: editForm.value.displayName,
      timezone: editForm.value.timezone,
      defaultLessonMinutes: 50,
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
  if (busy.value || user.role === "ADMIN" || user.id === profile.value?.id)
    return;
  errorMessage.value = "";
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
  if (
    !profile.value ||
    !blockedForm.value.start ||
    !blockedForm.value.end ||
    busy.value
  )
    return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const start = studioLocalInstant(
      blockedForm.value.start,
      viewerTimezone.value,
    );
    const end = studioLocalInstant(blockedForm.value.end, viewerTimezone.value);
    if (Date.parse(end) <= Date.parse(start))
      throw new Error(
        tr("End time must be after start time.", "结束时间必须晚于开始时间。"),
      );
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
  } finally {
    busy.value = false;
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
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const result = await supabase
      .from("teacher_blocked_periods")
      .delete()
      .eq("id", id);
    if (result.error) throw result.error;
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
  }
}
async function saveMinutes(minutes: number) {
  if (!profile.value || busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const result = await supabase.rpc("update_my_profile", {
      p_display_name: profile.value.display_name,
      p_timezone: profile.value.timezone,
      p_default_lesson_minutes: minutes,
    });
    if (result.error) throw result.error;
    profile.value = result.data as Profile;
    showToast(tr("Lesson duration saved.", "课程时长已保存。"));
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
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
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = "";
  try {
    const result = await supabase.functions.invoke("booking-action", {
      body: { bookingId: id, action: value },
    });
    if (result.error) throw result.error;
    showToast(tr("Booking updated.", "预约已更新。"));
    await loadData();
  } catch (error) {
    await setError(error);
  } finally {
    busy.value = false;
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
  <main v-if="!session || !profile" class="campus-login">
    <section class="campus-login-story">
      <a class="campus-brand" href="#"
        ><span class="campus-monogram">E<span>·</span></span
        ><strong>EduBook<small>DIGITAL CAMPUS</small></strong></a
      >
      <div>
        <p class="eyebrow">{{ tr("A SHARED CLASSROOM", "共享课堂") }}</p>
        <h1>
          {{ tr("Your world.\nYour next lesson.", "世界很大，\n课堂很近。") }}
        </h1>
        <p>
          {{
            tr(
              "Find a teacher. Make time. Keep learning, wherever you are.",
              "找到你的老师，留一段时间，让学习在任何地方发生。",
            )
          }}
        </p>
      </div>
      <LearningRoom :language="language" />
      <footer>
        {{
          tr(
            "Different time zones. One place to learn.",
            "不同的时区，同一个学习空间。",
          )
        }}
      </footer>
    </section>
    <section class="campus-login-form">
      <button class="language-button" @click="toggleLanguage">
        {{ copy.language }}
      </button>
      <div>
        <p class="eyebrow">{{ tr("WELCOME TO CAMPUS", "欢迎回到校园") }}</p>
        <h2>{{ tr("Come on in.", "进入你的空间。") }}</h2>
        <p>
          {{
            tr(
              "Use the account provided by your administrator.",
              "使用管理员为你创建的账号登录。",
            )
          }}
        </p>
        <p v-if="!supabaseConfigured" class="alert" role="status">
          {{ copy.setupMissing }}
        </p>
        <form @submit.prevent="signIn">
          <label
            >{{ tr("Username", "登录账号")
            }}<input
              v-model="auth.username"
              autocomplete="username"
              required
              :disabled="busy" /></label
          ><label
            >{{ tr("Password", "密码")
            }}<input
              v-model="auth.password"
              type="password"
              autocomplete="current-password"
              required
              :disabled="busy"
          /></label>
          <p v-if="errorMessage" class="alert alert-error" role="alert">
            {{ errorMessage }}
          </p>
          <button
            class="primary-button"
            :disabled="busy || !supabaseConfigured"
          >
            {{
              busy
                ? tr("Signing in…", "登录中…")
                : tr("Enter campus →", "进入校园 →")
            }}
          </button>
        </form>
        <p class="field-hint">
          {{
            tr(
              "No email registration. Contact your administrator if you need an account or password reset.",
              "无需邮箱注册。如需账号或重置密码，请联系管理员。",
            )
          }}
        </p>
      </div>
    </section>
  </main>
  <CampusShell
    v-else
    :role="profile.role"
    :active="activeNav"
    :language="language"
    :name="profile.display_name"
    :username="profile.username"
    :timezone="viewerTimezone"
    :title="title"
    :pending="pendingTeacherBookings.length"
    @navigate="activeNav = $event"
    @account="accountSection = $event"
    @signout="signOut"
    @language="toggleLanguage"
  >
    <div
      v-if="errorMessage && !creating && !editing"
      class="alert alert-error"
      role="alert"
    >
      <span>{{ errorMessage }}</span
      ><button class="text-button" @click="loadData">{{ copy.retry }}</button>
    </div>
    <p v-if="loading" class="campus-loading" role="status">
      {{ tr("Refreshing your campus…", "正在加载校园数据…") }}
    </p>
    <template v-if="profile.role === 'ADMIN'">
      <AdminCampus
        v-if="activeNav === 'overview'"
        :dashboard="dashboard"
        :bookings="adminBookings"
        :timezone="viewerTimezone"
        :language="language"
        :loading="loading"
        @navigate="activeNav = $event"
        @create="openCreate"
      />
      <PeopleDirectory
        v-else-if="activeNav === 'people'"
        :users="users"
        :current-user-id="profile.id"
        :language="language"
        :busy="busy"
        :loading="loading"
        @create="openCreate"
        @edit="openAccountAction($event, 'edit')"
        @reset="openAccountAction($event, 'reset')"
        @delete="openAccountAction($event, 'delete')"
      />
      <CampusLessons
        v-else
        :bookings="adminBookings"
        :timezone="viewerTimezone"
        :language="language"
        mode="admin"
        :loading="loading"
      />
    </template>
    <template v-else-if="profile.role === 'TEACHER'">
      <TeacherCampus
        v-if="activeNav === 'teacher-overview'"
        :bookings="teacherBookings"
        :timezone="viewerTimezone"
        :language="language"
        :lesson-minutes="50"
        :loading="loading"
        @requests="activeNav = 'requests'"
        @settings="activeNav = 'settings'"
        @block-date="blockDate"
      />
      <TeacherSettings
        v-else-if="activeNav === 'settings'"
        :minutes="50"
        :blocked="blocked"
        :timezone="viewerTimezone"
        :language="language"
        :busy="busy"
        :draft="blockedForm"
        @save="saveMinutes"
        @add="
          blockedForm = $event;
          addBlocked();
        "
        @remove="removeBlocked"
      />
      <TeacherBookings
        v-else
        :bookings="teacherBookings"
        :timezone="viewerTimezone"
        :language="language"
        :loading="loading || busy"
        :error="errorMessage"
        @action="action"
      />
    </template>
    <template v-else>
      <CampusLessons
        v-if="activeNav === 'history'"
        :bookings="studentBookings"
        :timezone="viewerTimezone"
        :language="language"
        mode="student"
        :loading="loading"
        @book="activeNav = 'book'"
      />
      <section v-else class="campus-reservation">
        <div class="campus-reservation-intro">
          <div>
            <p class="eyebrow">
              {{ tr("YOUR NEXT CHAPTER", "下一段学习时光") }}
            </p>
            <h2>
              {{
                tr("A classroom, wherever you are.", "把课堂，放进你的日程。")
              }}
            </h2>
            <p>
              {{
                tr(
                  "Pick your teacher, a start time, and how long you would like to learn.",
                  "选择老师、开始时间和连续课时，一次提交完整预约。",
                )
              }}
            </p>
          </div>
          <LearningRoom
            :name="currentTeacher?.display_name"
            :minutes="50"
            :language="language"
          />
        </div>
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
        />
      </section>
    </template>
    <AccountCenter
      v-if="accountSection"
      :profile="profile"
      :section="accountSection"
      :language="language"
      :zones="zoneOptions"
      @close="accountSection = null"
      @updated="profileUpdated"
    />
    <CampusDrawer
      v-if="creating"
      :title="tr('Welcome someone new', '邀请新成员')"
      :subtitle="tr('CAMPUS / NEW ACCOUNT', '校园 / 新增账号')"
      :language="language"
      :busy="busy"
      @close="creating = false"
    >
      <p>
        {{
          tr(
            "Choose an account type first. The username and role cannot be changed after creation.",
            "先选择账号类型，创建后登录账号与角色不可修改。",
          )
        }}
      </p>
      <form @submit.prevent="createUser">
        <fieldset :disabled="busy">
          <div class="campus-role-choice">
            <button
              v-for="option in roleOptions"
              :key="option.value"
              type="button"
              :aria-pressed="accountForm.role === option.value"
              @click="accountForm.role = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <label
            >{{ tr("Display name", "显示名称")
            }}<input
              v-model="accountForm.displayName"
              maxlength="120"
              autocomplete="off"
              required /></label
          ><label
            >{{ tr("Username", "登录账号")
            }}<input
              v-model="accountForm.username"
              pattern="[A-Za-z0-9_.-]{3,40}"
              autocomplete="off"
              required
            /><small>{{
              tr(
                "3–40 letters, numbers, dots, underscores or hyphens.",
                "3–40 位字母、数字、点、下划线或连字符。",
              )
            }}</small></label
          ><label
            >{{ tr("Initial password", "初始密码")
            }}<input
              v-model="accountForm.password"
              type="password"
              minlength="8"
              autocomplete="new-password"
              required /></label
          ><label
            >{{ tr("Timezone", "时区")
            }}<AppSelect
              v-model="accountForm.timezone"
              :options="zoneOptions"
              :label="tr('Search timezone', '搜索时区')"
              searchable
          /></label>
        </fieldset>
        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>
        <button class="primary-button" :disabled="busy">
          {{
            busy ? tr("Creating…", "创建中…") : tr("Create account", "创建账号")
          }}
        </button>
      </form>
    </CampusDrawer>
    <CampusDrawer
      v-if="editing"
      :title="
        accountMode === 'edit'
          ? tr('Edit profile', '编辑资料')
          : accountMode === 'reset'
            ? tr('Reset password', '重置密码')
            : tr('Delete account', '删除账号')
      "
      :subtitle="editing.display_name + ' · @' + editing.username"
      :language="language"
      :busy="busy"
      @close="
        editing = null;
        resetPassword = '';
      "
    >
      <form v-if="accountMode === 'edit'" @submit.prevent="saveAccount">
        <fieldset :disabled="busy">
          <div class="campus-identity-note">
            <strong>@{{ editing.username }}</strong
            ><span>{{ roleLabel(editing.role) }}</span
            ><small>{{
              tr("Username and role are fixed.", "登录账号与角色不可修改。")
            }}</small>
          </div>
          <label
            >{{ tr("Display name", "显示名称")
            }}<input
              v-model="editForm.displayName"
              maxlength="120"
              required /></label
          ><label
            >{{ tr("Timezone", "时区")
            }}<AppSelect
              v-model="editForm.timezone"
              :options="zoneOptions"
              :label="tr('Search timezone', '搜索时区')"
              searchable /></label
          ><p v-if="editing.role === 'TEACHER'">{{tr('Fixed: 50 minutes per lesson, hourly starts.','统一每节50分钟，整点开始。')}}</p>
        </fieldset>
        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>
        <button class="primary-button" :disabled="busy">
          {{ tr("Save profile", "保存资料") }}
        </button>
      </form>
      <form
        v-else-if="accountMode === 'reset'"
        @submit.prevent="resetAccountPassword"
      >
        <p>
          {{
            tr(
              "Set a new password and share it securely. The current password will stop working.",
              "设置新密码并通过安全方式交付，原密码将无法使用。",
            )
          }}
        </p>
        <label
          >{{ tr("New password", "新密码")
          }}<input
            v-model="resetPassword"
            type="password"
            minlength="8"
            autocomplete="new-password"
            :disabled="busy"
            required
        /></label>
        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>
        <button class="primary-button" :disabled="busy">
          {{ tr("Reset password", "重置密码") }}
        </button>
      </form>
      <div v-else class="campus-delete-confirm">
        <span aria-hidden="true">!</span>
        <h3>
          {{ tr("Remove this person from campus?", "确定移除这位成员？") }}
        </h3>
        <p>
          {{
            tr(
              "Deletion is permanent. Accounts with booking history cannot be deleted; their course records are protected.",
              "删除后不可恢复。存在预约历史的账号不可删除，以保护课程记录。",
            )
          }}
        </p>
        <p v-if="errorMessage" class="alert alert-error" role="alert">
          {{ errorMessage }}
        </p>
        <button
          class="primary-button danger"
          :disabled="busy"
          @click="deleteAccount(editing)"
        >
          {{ tr("Permanently delete account", "永久删除账号") }}
        </button>
      </div>
    </CampusDrawer>
  </CampusShell>
  <div v-if="toast" class="toast" role="status">{{ toast }}</div>
</template>
