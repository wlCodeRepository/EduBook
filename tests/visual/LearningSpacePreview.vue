<script setup lang="ts">
// Offline visual fixture. Never writes to Supabase.
import { computed, ref } from "vue";
import BookingStudio from "../../src/components/BookingStudio.vue";
import LearningRoom from "../../src/components/LearningRoom.vue";
import TeacherWeek from "../../src/components/TeacherWeek.vue";
import type { Profile, Booking } from "../../src/lib/types";
import type { BookingSlot } from "../../src/lib/booking";
const language = ref("en");
const active = ref("book");
const teachers: Profile[] = [
  {
    id: "teacher-one",
    display_name: "Mia Laurent",
    username: "mia",
    role: "TEACHER",
    timezone: "Europe/Paris",
    default_lesson_minutes: 30,
    email: "",
  },
  {
    id: "teacher-two",
    display_name: "陈老师",
    username: "chen",
    role: "TEACHER",
    timezone: "Asia/Shanghai",
    default_lesson_minutes: 60,
    email: "",
  },
];
const selectedTeacherId = ref(teachers[0].id);
const current = computed(() =>
  teachers.find((t) => t.id === selectedTeacherId.value)!,
);
const bookings = ref<Booking[]>([]);
const sent = ref(false);
const receipt = ref<BookingSlot | null>(null);
function submit(slot: BookingSlot) {
  bookings.value.push({
    id: String(bookings.value.length),
    teacher_id: selectedTeacherId.value,
    student_id: "sample-student",
    start_at_utc: slot.startAtUtc,
    end_at_utc: slot.endAtUtc,
    status: "PENDING",
    cancellation_reason: null,
    student: { ...teachers[0], role: "STUDENT", display_name: "Alex Chen" },
  });
  receipt.value = { ...slot };
  sent.value = true;
}
</script>
<template>
  <div class="app-shell learning-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">E</span>EduBook</div>
      <nav class="nav-list">
        <button
          class="nav-item"
          :class="{ active: active === 'book' }"
          @click="active = 'book'"
        >
          {{ language === "en" ? "Find a lesson" : "预约课程" }}</button
        ><button
          class="nav-item"
          :class="{ active: active === 'week' }"
          @click="active = 'week'"
        >
          {{ language === "en" ? "Teaching calendar" : "授课日历" }}
        </button>
      </nav>
      <span class="avatar">AC</span>
    </aside>
    <main class="main-content">
      <header class="topbar">
        <div>
          <p class="eyebrow">
            {{
              language === "en"
                ? "Offline preview · fictional accounts"
                : "离线预览 · 虚构账号"
            }}
          </p>
          <h1>
            {{ language === "en" ? "Your learning space" : "你的学习空间" }}
          </h1>
        </div>
        <button
          class="language-button"
          @click="language = language === 'en' ? 'zh' : 'en'"
        >
          {{ language === "en" ? "中文" : "EN" }}
        </button>
      </header>
      <template v-if="active === 'book'"
        ><LearningRoom
          :name="current.display_name"
          :minutes="current.default_lesson_minutes"
          :language="language" />
        <p v-if="sent" class="alert" role="status">
          {{
            language === "en"
              ? "Preview request saved locally. See Teaching calendar. No data was sent."
              : "样例申请已保存在本地页面，可切换授课日历查看。未发送真实请求。"
          }}
        </p>
        <BookingStudio
          :receipt="receipt"
          :teachers="teachers"
          :selected-teacher-id="selectedTeacherId"
          :busy-slots="
            bookings.filter((b) => b.teacher_id === selectedTeacherId)
          "
          :blocked="[]"
          timezone="Asia/Shanghai"
          :language="language"
          :busy="false"
          :loading="false"
          @select-teacher="
            selectedTeacherId = $event;
            sent = false;
          "
          @submit="submit"
      /></template>
      <TeacherWeek
        v-else
        :bookings="bookings.filter((b) => b.teacher_id === selectedTeacherId)"
        timezone="Asia/Shanghai"
        :language="language"
      />
    </main>
  </div>
</template>
