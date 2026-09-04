<script setup lang="ts">
import { ref } from "vue";
import AccountMenu from "../../src/components/AccountMenu.vue";
import AccountCenter from "../../src/components/AccountCenter.vue";
import TeacherBookings from "../../src/components/TeacherBookings.vue";
import TeacherWeek from "../../src/components/TeacherWeek.vue";
import type { Profile, Booking } from "../../src/lib/types";
const profile: Profile = {
  id: "preview",
  username: "preview.teacher",
  display_name: "陈老师",
  role: "TEACHER",
  email: "",
  timezone: "Asia/Shanghai",
  default_lesson_minutes: 60,
};
const student: Profile = {
  ...profile,
  id: "preview-student",
  display_name: "Alex Chen",
  role: "STUDENT",
};
const bookings: Booking[] = [
  {
    id: "past",
    teacher_id: "preview",
    student_id: student.id,
    student,
    start_at_utc: "2026-09-04T06:00:00Z",
    end_at_utc: "2026-09-04T07:00:00Z",
    status: "CONFIRMED",
    cancellation_reason: null,
  },
  {
    id: "pending",
    teacher_id: "preview",
    student_id: student.id,
    student,
    start_at_utc: "2026-09-06T01:00:00Z",
    end_at_utc: "2026-09-06T02:00:00Z",
    status: "PENDING",
    cancellation_reason: null,
  },
];
const active = ref("requests");
const section = ref<"profile" | "password" | null>(null);
const language = ref("zh");
const zones = [
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "America/New_York", label: "America/New_York" },
];
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">E</span><span>EduBook</span>
      </div>
      <p class="workspace-label">授课工作台</p>
      <nav class="nav-list">
        <button
          class="nav-item"
          :class="{ active: active === 'week' }"
          @click="active = 'week'"
        >
          本周课程</button
        ><button
          class="nav-item"
          :class="{ active: active === 'requests' }"
          @click="active = 'requests'"
        >
          预约申请
        </button>
      </nav>
      <AccountMenu
        :display-name="profile.display_name"
        :username="profile.username"
        role-label="老师"
        :language="language"
        @open="section = $event"
      />
    </aside>
    <section class="main-content">
      <header class="topbar">
        <div>
          <p class="eyebrow">2026年9月5日 星期六 · 本地样例</p>
          <h1>{{ active === "week" ? "本周课程" : "预约申请" }}</h1>
        </div>
        <button
          class="language-button"
          @click="language = language === 'zh' ? 'en' : 'zh'"
        >
          {{ language === "zh" ? "EN" : "中文" }}
        </button>
      </header>
      <TeacherBookings
        v-if="active === 'requests'"
        :bookings="bookings"
        :timezone="profile.timezone"
        :language="language"
      /><TeacherWeek
        v-else
        :bookings="bookings"
        :timezone="profile.timezone"
        :language="language"
      /><AccountCenter
        v-if="section"
        :profile="profile"
        :section="section"
        :language="language"
        :zones="zones"
        @close="section = null"
      />
    </section>
  </div>
</template>
