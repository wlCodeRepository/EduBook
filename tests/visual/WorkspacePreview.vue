<script setup lang="ts">
// Visual coverage for docs/plans/2026-09-05-schoolhouse-redesign.md, step 4.
// All identities and actions are local fixtures. Capture submit events before
// AccountCenter/PasswordSettings handlers to prevent their backend calls.
import { computed, ref } from "vue";
import AccountMenu from "../../src/components/AccountMenu.vue";
import AccountCenter from "../../src/components/AccountCenter.vue";
import AppSelect from "../../src/components/AppSelect.vue";
import SchoolCover from "../../src/components/SchoolCover.vue";
import TeacherBookings from "../../src/components/TeacherBookings.vue";
import TeacherWeek from "../../src/components/TeacherWeek.vue";
import {
  createCustomBookingSlot,
  formatDateTimeInput,
} from "../../src/lib/booking";
import { messages, type Language } from "../../src/lib/i18n";
import type { Profile, Booking, Role } from "../../src/lib/types";

const language = ref<Language>("zh");
const copy = computed(() => messages[language.value]);
function tr(en: string, zh: string) {
  return language.value === "en" ? en : zh;
}
function toggleLanguage() {
  language.value = language.value === "zh" ? "en" : "zh";
}
const views = computed(() => [
  { value: "teacher-overview", label: tr("Teacher week", "老师周课表") },
  { value: "requests", label: tr("Booking requests", "预约申请") },
  { value: "book", label: tr("Student booking", "学生预约") },
  { value: "people", label: tr("People directory", "管理员人员目录") },
  { value: "login", label: tr("Sign in", "登录页") },
]);
const activeNav = ref("teacher-overview");
const title = computed(
  () => views.value.find((view) => view.value === activeNav.value)?.label,
);
const teacherProfile: Profile = {
  id: "preview-teacher",
  username: "lin.teacher",
  display_name: "林知夏",
  role: "TEACHER",
  email: "",
  timezone: "Asia/Shanghai",
  default_lesson_minutes: 60,
};
const teachers: Profile[] = [
  teacherProfile,
  {
    ...teacherProfile,
    id: "preview-teacher-2",
    username: "oliver.teacher",
    display_name: "Oliver Reed",
    timezone: "Europe/London",
    default_lesson_minutes: 45,
  },
];
const students: Profile[] = [
  {
    ...teacherProfile,
    id: "preview-student",
    username: "alex.student",
    display_name: "Alex Chen",
    role: "STUDENT",
  },
  {
    ...teacherProfile,
    id: "preview-student-2",
    username: "mia.student",
    display_name: "Mia Laurent",
    role: "STUDENT",
    timezone: "Europe/Paris",
  },
];
const administrator: Profile = {
  ...teacherProfile,
  id: "preview-admin",
  username: "school.admin",
  display_name: "许安宁",
  role: "ADMIN",
};
const profile = computed(() =>
  activeNav.value === "people"
    ? administrator
    : activeNav.value === "book"
      ? students[0]
      : teacherProfile,
);
const viewerTimezone = computed(() => profile.value.timezone);
function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}
function roleLabel(role: Role) {
  return role === "TEACHER"
    ? tr("Teacher", "老师")
    : role === "ADMIN"
      ? tr("Administrator", "管理员")
      : tr("Student", "学生");
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
// Relative dates keep the real TeacherWeek populated whenever the fixture opens.
const anchor = new Date();
anchor.setUTCHours(2, 0, 0, 0);
const bookings = ref<Booking[]>(
  [-2, -1, 0, 1, 2, 3].map((offset, index) => ({
    id: `preview-booking-${index}`,
    teacher_id: teacherProfile.id,
    student_id: students[index % 2].id,
    student: students[index % 2],
    teacher: teacherProfile,
    start_at_utc: new Date(anchor.getTime() + offset * 86400000).toISOString(),
    end_at_utc: new Date(
      anchor.getTime() + offset * 86400000 + 3600000,
    ).toISOString(),
    status: offset < 0 ? "COMPLETED" : offset === 2 ? "PENDING" : "CONFIRMED",
    cancellation_reason: null,
  })),
);
const teacherBookings = computed(() => bookings.value);
const pendingTeacherBookings = computed(() =>
  bookings.value.filter((item) => item.status === "PENDING"),
);
const upcomingTeacherBookings = computed(() =>
  bookings.value.filter(
    (item) =>
      item.status === "CONFIRMED" && new Date(item.end_at_utc) > new Date(),
  ),
);
const loading = ref(false);
const errorMessage = ref("");
const toast = ref("");
const busy = ref(false);
function previewAction() {
  toast.value = tr(
    "Local preview only. No data was sent.",
    "仅本地视觉预览，未发送任何数据。",
  );
}
const supabaseConfigured = true;
const auth = ref({ username: "preview.teacher", password: "" });
function signIn() {
  activeNav.value = "teacher-overview";
  previewAction();
}
const accountSection = ref<"profile" | "password" | null>(null);
const creating = ref(false);
const accountForm = ref({
  username: "demo.student",
  password: "",
  displayName: "夏星遥",
  role: "STUDENT" as "TEACHER" | "STUDENT",
  timezone: "Asia/Shanghai",
});
const roleOptions = computed(() => [
  { value: "TEACHER", label: tr("Teacher", "老师") },
  { value: "STUDENT", label: tr("Student", "学生") },
]);
const zoneOptions = [
  "Asia/Shanghai",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "UTC",
].map((value) => ({ value, label: value }));
function openCreate() {
  creating.value = true;
}
function openEdit(_user: Profile) {
  previewAction();
}
const users = [
  ...teachers,
  ...students,
  {
    ...administrator,
    id: "preview-admin-2",
    display_name: "周予安",
    username: "demo.admin",
  },
];
const search = ref("");
const roleFilter = ref("ALL");
const filterOptions = computed(() => [
  { value: "ALL", label: tr("All roles", "全部角色") },
  { value: "TEACHER", label: tr("Teacher", "老师") },
  { value: "STUDENT", label: tr("Student", "学生") },
]);
const filteredUsers = computed(() =>
  users.filter(
    (user) =>
      (roleFilter.value === "ALL" || user.role === roleFilter.value) &&
      `${user.display_name} ${user.username} ${user.timezone}`
        .toLowerCase()
        .includes(search.value.trim().toLowerCase()),
  ),
);
const selectedTeacherId = ref(teacherProfile.id);
const currentTeacher = computed(
  () =>
    teachers.find((item) => item.id === selectedTeacherId.value) || teachers[0],
);
const bookingStart = ref(
  formatDateTimeInput(
    new Date(anchor.getTime() + 86400000),
    students[0].timezone,
  ),
);
const proposal = computed(() =>
  createCustomBookingSlot(
    bookingStart.value,
    viewerTimezone.value,
    currentTeacher.value.timezone,
    currentTeacher.value.default_lesson_minutes,
    [],
    [],
  ),
);
const selectedSlot = ref<ReturnType<typeof createCustomBookingSlot>>(null);
function refreshProposal() {
  selectedSlot.value = proposal.value;
}
function selectTeacher(id: string) {
  selectedTeacherId.value = id;
  selectedSlot.value = null;
}
function book() {
  previewAction();
}
</script>
<template>
  <nav class="preview-toolbar" aria-label="视觉夹具页面切换">
    <span>Schoolhouse · {{ tr("Fictional samples", "虚构样例") }}</span>
    <button
      v-for="view in views"
      :key="view.value"
      class="outline-button small"
      :aria-pressed="activeNav === view.value"
      @click="
        activeNav = view.value;
        toast = '';
      "
    >
      {{ view.label }}
    </button>
  </nav>
  <main v-if="activeNav === 'login'" class="auth-shell">
    <SchoolCover :language="language" />
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
        <button
          v-for="view in views"
          :key="view.value"
          class="nav-item"
          :class="{ active: activeNav === view.value }"
          @click="
            activeNav = view.value;
            toast = '';
          "
        >
          {{ view.label
          }}<span
            v-if="view.value === 'requests' && pendingTeacherBookings.length"
            class="nav-count"
            >{{ pendingTeacherBookings.length }}</span
          >
        </button>
      </nav>
      <AccountMenu
        :display-name="profile.display_name"
        :username="profile.username"
        :role-label="roleLabel(profile.role)"
        :language="language"
        @open="accountSection = $event"
        @signout="activeNav = 'login'"
      />
    </aside>
    <section class="main-content" @submit.capture.prevent.stop="previewAction">
      <AccountCenter
        v-if="accountSection"
        :profile="profile"
        :section="accountSection"
        :language="language"
        :zones="zoneOptions"
        @close="accountSection = null"
      />
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
      <section v-if="activeNav === 'teacher-overview'" class="teacher-layout">
        <TeacherWeek
          :bookings="teacherBookings"
          :timezone="viewerTimezone"
          :language="language"
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

      <TeacherBookings
        v-else-if="activeNav === 'requests'"
        :bookings="teacherBookings"
        :timezone="viewerTimezone"
        :language="language"
        :loading="loading"
        :error="errorMessage"
        @action="previewAction"
      />
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
            <form class="account-form" @submit.prevent="previewAction">
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
                tr('Search name, username or timezone', '搜索姓名、账号或时区')
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
            <p class="step-heading">
              <span>01</span>{{ tr("Your teacher", "选择老师") }}
            </p>
            <button
              v-for="teacher in teachers"
              :key="teacher.id"
              class="teacher-card"
              :class="{ chosen: currentTeacher?.id === teacher.id }"
              :aria-pressed="currentTeacher?.id === teacher.id"
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
              <p class="step-heading">
                <span>02</span>{{ tr("Your time", "选择时间") }}
              </p>
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
              <p class="step-heading">
                <span>03</span>{{ tr("Your lesson", "确认课程") }}
              </p>
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
      </section>
    </section>
  </div>
  <div v-if="toast" class="toast" role="status" @click="toast = ''">
    {{ toast }}
  </div>
</template>

<style scoped>
/* Only the fixture switcher has custom styling; page styles come from src/styles.css. */
.preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #d8e0e8;
  background: #edf1f5;
}
.preview-toolbar > span {
  margin-right: auto;
  font-size: 12px;
}
.preview-toolbar button[aria-pressed="true"] {
  background: #182d4b;
  color: #fff;
}
</style>
