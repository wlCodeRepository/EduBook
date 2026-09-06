<script setup lang="ts">
// Fictional, offline data. No API calls and no production authentication bypass.
import { computed, ref } from "vue";
import CampusShell from "../../src/components/CampusShell.vue";
import CampusDrawer from "../../src/components/CampusDrawer.vue";
import AccountCenter from "../../src/components/AccountCenter.vue";
import AdminCampus from "../../src/components/AdminCampus.vue";
import PeopleDirectory from "../../src/components/PeopleDirectory.vue";
import TeacherCampus from "../../src/components/TeacherCampus.vue";
import TeacherSettings from "../../src/components/TeacherSettings.vue";
import TeacherBookings from "../../src/components/TeacherBookings.vue";
import CampusLessons from "../../src/components/CampusLessons.vue";
import BookingStudio from "../../src/components/BookingStudio.vue";
import type { Profile, Booking, Role } from "../../src/lib/types";
import type { BookingSlot } from "../../src/lib/booking";
const role = ref<Role>("TEACHER");
const active = ref("teacher-overview");
const language = ref("en");
const drawer = ref("");
const teachers: Profile[] = [
  {
    id: "t",
    username: "mia",
    display_name: "Mia Laurent",
    email: "",
    role: "TEACHER",
    timezone: "Europe/Paris",
    default_lesson_minutes: 30,
  },
];
const student: Profile = {
  ...teachers[0],
  id: "s",
  username: "alex",
  display_name: "Alex Chen",
  role: "STUDENT",
};
const selected = ref("t");
const receipt = ref<BookingSlot | null>(null);
const bookings = ref<Booking[]>(
  Array.from({ length: 12 }, (_, i) => {
    const start = new Date();
    start.setDate(start.getDate() + Math.floor(i / 2));
    start.setHours(10 + (i % 2) * 4, 0, 0, 0);
    return {
      id: String(i),
      teacher_id: "t",
      student_id: "s",
      start_at_utc: start.toISOString(),
      end_at_utc: new Date(+start + 3600000).toISOString(),
      status: i % 3 === 0 ? "PENDING" : "CONFIRMED",
      cancellation_reason: null,
      teacher: teachers[0],
      student,
      lesson_minutes: 30,
      lesson_count: 2,
    };
  }),
);
const users = Array.from({ length: 10 }, (_, i) => ({
  ...(i % 2 ? student : teachers[0]),
  id: "user" + i,
  username: "member" + i,
  display_name: i % 2 ? "Alex Chen " + i : "Mia Laurent " + i,
  created_at: new Date().toISOString(),
}));
const title = computed(
  () =>
    ({
      people: "People directory",
      book: "Reservation studio",
      history: "My lessons",
      settings: "Your availability",
      requests: "Request inbox",
      bookings: "Campus schedule",
      overview: "Campus",
      "teacher-overview": "Your teaching week",
    })[active.value] || "Campus",
);
function changeRole(r: Role) {
  role.value = r;
  active.value =
    r === "ADMIN" ? "overview" : r === "TEACHER" ? "teacher-overview" : "book";
}
</script>
<template>
  <CampusShell
    :role="role"
    :active="active"
    :language="language"
    name="Preview account"
    username="fictional"
    timezone="Asia/Shanghai"
    :title="title"
    @navigate="active = $event"
    @language="language = language === 'en' ? 'zh' : 'en'"
    @account="drawer = $event"
    @signout="drawer = 'Offline preview — no session'"
  >
    <AdminCampus
      v-if="active === 'overview'"
      :dashboard="{
        teachers: 5,
        students: 5,
        pending: 4,
        confirmed: 8,
        completed: 0,
        upcoming: 12,
      }"
      :bookings="bookings"
      timezone="Asia/Shanghai"
      :language="language"
      @navigate="active = $event"
      @create="drawer = 'Create user'"
    />
    <PeopleDirectory
      v-else-if="active === 'people'"
      :users="users"
      current-user-id="preview"
      :language="language"
      @create="drawer = 'Create user'"
      @edit="drawer = 'Edit profile'"
      @reset="drawer = 'Reset password'"
      @delete="drawer = 'Delete user'"
    />
    <TeacherCampus
      v-else-if="active === 'teacher-overview'"
      :bookings="bookings"
      timezone="Asia/Shanghai"
      :language="language"
      :lesson-minutes="30"
      @requests="active = 'requests'"
      @settings="active = 'settings'"
      @block-date="active = 'settings'"
    />
    <TeacherBookings
      v-else-if="active === 'requests'"
      :bookings="bookings"
      timezone="Asia/Shanghai"
      :language="language"
      @action="drawer = 'Offline action preview'"
    />
    <TeacherSettings
      v-else-if="active === 'settings'"
      :minutes="30"
      :blocked="[]"
      timezone="Asia/Shanghai"
      :language="language"
      :busy="false"
      :draft="{ start: '', end: '', reason: '' }"
      @save="drawer = 'Offline save preview'"
    />
    <div v-else-if="active === 'book'" class="campus-reservation">
      <BookingStudio
        :teachers="teachers"
        :selected-teacher-id="selected"
        :busy-slots="[]"
        :blocked="[]"
        timezone="Asia/Shanghai"
        :language="language"
        :busy="false"
        :loading="false"
        :receipt="receipt"
        @select-teacher="selected = $event"
        @submit="receipt = $event"
      />
    </div>
    <CampusLessons
      v-else
      :bookings="bookings"
      timezone="Asia/Shanghai"
      :language="language"
      :mode="role === 'ADMIN' ? 'admin' : 'student'"
      @book="active = 'book'"
    />
  </CampusShell>
  <div class="preview-controls" aria-label="Fictional preview role">
    <span>OFFLINE</span
    ><button
      v-for="r in ['ADMIN', 'TEACHER', 'STUDENT'] as const"
      :key="r"
      @click="changeRole(r)"
    >
      {{ r }}
    </button>
  </div>
  <div v-if="drawer==='profile' || drawer==='password'" @submit.capture.prevent.stop>
    <AccountCenter :profile="{...student,role,display_name:'Preview account',username:'fictional'}" :section="drawer" :language="language" :zones="[{value:'Asia/Shanghai',label:'Asia/Shanghai'},{value:'Europe/Paris',label:'Europe/Paris'}]" @close="drawer=''" />
  </div>
  <CampusDrawer
    v-else-if="drawer"
    :title="drawer"
    subtitle="Fictional preview. No data is sent."
    :language="language"
    @close="drawer = ''"
    ><p>
      This preview checks the shared action surface. Real forms are connected in
      the authenticated app.
    </p></CampusDrawer
  >
</template>
<style scoped>
.preview-controls {
  position: fixed;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 3px;
  z-index: 3;
  background: #fcfdff;
  border: 1px solid #d5deeb;
  border-radius: 8px;
  padding: 3px;
  font: 9px sans-serif;
}
.preview-controls button {
  font: 9px sans-serif;
  padding: 5px;
  border: 0;
  background: #eaf0f7;
  color: #233957;
  border-radius: 4px;
}
@media (max-width: 700px) {
  .preview-controls {
    left: auto;
    right: 8px;
    transform: none;
    bottom: 12px;
  }
  .preview-controls span {
    display: none;
  }
}
</style>
