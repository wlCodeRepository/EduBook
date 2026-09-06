<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { AdminBooking, AdminDashboardCounts } from "../lib/types";

const props = defineProps<{
  dashboard: AdminDashboardCounts;
  bookings: AdminBooking[];
  timezone: string;
  language: string;
  loading?: boolean;
}>();
// Task 2: seven viewer-local calendar dates, beginning today. Supplied bookings
// may be a partial dataset: only roster facts use dashboard aggregates. Keep
// the timetable inside the parent's bounded stage; no body-level scroll lock.
const emit = defineEmits<{
  navigate: [page: "people" | "bookings"];
  create: [];
}>();
const zh = computed(() => props.language.startsWith("zh"));
const now = ref(new Date());
const selectedDate = ref("");
let clock: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  clock = setInterval(() => {
    now.value = new Date();
  }, 30000);
});
onBeforeUnmount(() => clearInterval(clock));
function localDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: props.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join("-");
}
const days = computed(() => {
  const today = localDate(now.value);
  const anchor = new Date(`${today}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      date: key.slice(5),
      // Count booking starts, once per booking, in the viewer's calendar timezone.
      bookings: props.bookings
        .filter((booking) => localDate(booking.start_at_utc) === key)
        .sort(
          (a, b) => Date.parse(a.start_at_utc) - Date.parse(b.start_at_utc),
        ),
    };
  });
});
const selected = computed(
  () =>
    days.value.find((day) => day.key === selectedDate.value) ?? days.value[0]!,
);
const peak = computed(() =>
  Math.max(1, ...days.value.map((day) => day.bookings.length)),
);
function time(value: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: props.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
function status(booking: AdminBooking) {
  return {
    PENDING: zh.value ? "待确认" : "Pending",
    CONFIRMED: zh.value ? "已确认" : "Confirmed",
    COMPLETED: zh.value ? "已完成" : "Completed",
    REJECTED: zh.value ? "已拒绝" : "Declined",
    CANCELLED: zh.value ? "已取消" : "Cancelled",
  }[booking.status];
}
</script>

<template>
  <section
    class="admin-campus"
    :aria-busy="loading"
    :aria-label="zh ? '校区日程' : 'Campus timetable'"
  >
    <header class="room-toolbar">
      <h2>{{ zh ? "校区日程" : "Campus timetable" }}</h2>
      <button
        type="button"
        data-action="bookings"
        @click="emit('navigate', 'bookings')"
      >
        {{ zh ? "全部预约" : "All bookings" }} <span aria-hidden="true">↗</span>
      </button>
    </header>
    <p v-if="loading" class="room-state" role="status">
      {{ zh ? "正在加载日程…" : "Loading timetable…" }}
    </p>
    <template v-else>
      <div class="timetable-stage">
        <div class="board-caption">
          <span>{{
            zh
              ? "未来七天 · 已载入预约的开始日分布（含全部状态）"
              : "Next seven days · Loaded booking starts, all statuses"
          }}</span
          ><span class="zone">{{ timezone }}</span>
        </div>
        <div class="distribution" :aria-label="zh ? '选择日期' : 'Select date'">
          <button
            v-for="day in days"
            :key="day.key"
            type="button"
            :data-day="day.key"
            :aria-pressed="selected.key === day.key"
            :aria-label="`${day.key} · ${day.bookings.length} ${zh ? '条预约' : 'bookings'}`"
            @click="selectedDate = day.key"
          >
            <span class="weekday">{{ day.label }}</span
            ><time :datetime="day.key">{{ day.date }}</time>
            <span class="bar-track" aria-hidden="true"
              ><span
                :style="{ height: `${(day.bookings.length / peak) * 100}%` }"
            /></span>
            <strong class="day-count">{{ day.bookings.length }}</strong>
          </button>
        </div>
        <div class="day-caption">
          <h3>{{ selected.key }}</h3>
          <span
            >{{ selected.bookings.length }}
            {{ zh ? "条已载入预约" : "loaded bookings" }}</span
          >
        </div>
        <div
          class="day-records"
          tabindex="0"
          :aria-label="zh ? '当日预约' : 'Day bookings'"
        >
          <p v-if="!selected.bookings.length" class="room-state" role="status">
            {{
              zh
                ? "这一天没有已载入的预约。可查看全部预约。"
                : "No loaded bookings on this day. View all bookings for more."
            }}
          </p>
          <article
            v-for="booking in selected.bookings"
            :key="booking.id"
            class="booking-row"
          >
            <div class="booking-time">
              <time :datetime="booking.start_at_utc"
                >{{ localDate(booking.start_at_utc) }} ·
                {{ time(booking.start_at_utc) }}</time
              ><time :datetime="booking.end_at_utc"
                >{{ zh ? "至" : "to" }} {{ localDate(booking.end_at_utc) }} ·
                {{ time(booking.end_at_utc) }}</time
              >
            </div>
            <div class="booking-people">
              <strong>{{
                booking.teacher?.display_name ||
                (zh ? "教师信息不可用" : "Teacher unavailable")
              }}</strong
              ><span>{{
                booking.student?.display_name ||
                (zh ? "学生信息不可用" : "Student unavailable")
              }}</span>
            </div>
            <span
              class="booking-status"
              :class="{ pending: booking.status === 'PENDING' }"
              >{{ status(booking) }}</span
            >
          </article>
        </div>
      </div>
      <footer class="roster-facts">
        <p>
          <strong>{{ dashboard.teachers }}</strong>
          {{ zh ? "位教师" : "teachers" }} <span aria-hidden="true"> / </span
          ><strong>{{ dashboard.students }}</strong>
          {{ zh ? "位学生" : "students" }}
        </p>
        <div>
          <button
            type="button"
            data-action="people"
            @click="emit('navigate', 'people')"
          >
            {{ zh ? "人员名册" : "People" }}</button
          ><button
            type="button"
            class="primary"
            data-action="create"
            @click="emit('create')"
          >
            {{ zh ? "新建账号" : "Create account" }}
          </button>
        </div>
      </footer>
    </template>
  </section>
</template>

<style scoped>
.admin-campus {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: auto;
  color: var(--campus-ink, #233957);
  background: var(--campus-paper, #fcfdff);
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
}
.room-toolbar,
.roster-facts,
.board-caption,
.day-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.room-toolbar {
  padding: 12px 18px;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
h2,
h3,
p {
  margin: 0;
}
h2 {
  font: 600 20px var(--campus-display-font, "Trebuchet MS", sans-serif);
}
h3 {
  font-size: 14px;
}
button {
  color: inherit;
  font: inherit;
  cursor: pointer;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 8px;
  background: var(--campus-paper, #fcfdff);
  padding: 8px 12px;
  min-height: 40px;
}
button:focus-visible,
[tabindex]:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: -3px;
}
button:hover {
  background: var(--campus-mist, #eaf0f7);
}
.timetable-stage {
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  overflow: auto;
}
.board-caption {
  padding: 12px 18px 8px;
  font-size: 12px;
  color: var(--campus-muted, #526780);
}
.zone {
  overflow-wrap: anywhere;
}
.distribution {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  padding: 0 18px 12px;
}
.distribution button {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 8px 2px;
  min-width: 0;
  border-color: transparent;
  background: var(--campus-mist, #eaf0f7);
}
.distribution button[aria-pressed="true"] {
  border-color: var(--campus-blue, #5378b5);
  box-shadow: inset 0 -3px var(--campus-blue, #5378b5);
}
.weekday {
  font-size: 12px;
}
.distribution time,
.day-count,
.booking-time,
.day-caption h3 {
  font-family: var(--campus-data-font, ui-monospace, monospace);
}
.distribution time {
  font-size: 12px;
}
.bar-track {
  height: clamp(18px, 5vh, 48px);
  display: flex;
  align-items: end;
  width: 16px;
}
.bar-track > span {
  width: 100%;
  background: var(--campus-blue, #5378b5);
  border-radius: 3px 3px 0 0;
}
.day-count {
  font-size: 14px;
}
.day-caption {
  padding: 10px 18px;
  background: var(--campus-mist, #eaf0f7);
  font-size: 12px;
}
.day-records {
  overflow: auto;
  min-height: 0;
  padding: 0 18px;
  overscroll-behavior: contain;
}
.booking-row {
  display: grid;
  grid-template-columns: minmax(175px, 1fr) minmax(100px, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
.booking-time,
.booking-people {
  display: grid;
  gap: 4px;
  overflow-wrap: anywhere;
}
.booking-time {
  font-size: 12px;
}
.booking-people {
  font-size: 14px;
}
.booking-people span {
  color: var(--campus-muted, #526780);
}
.booking-status {
  font-size: 12px;
}
.pending {
  color: var(--campus-coral, #c86454);
}
.roster-facts {
  border-top: 1px solid var(--campus-line, #d5deeb);
  padding: 10px 18px;
  font-size: 13px;
}
.roster-facts > div {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.primary {
  background: var(--campus-ink, #233957);
  color: var(--campus-paper, #fcfdff);
}
.primary:hover {
  background: var(--campus-blue, #5378b5);
}
.room-state {
  padding: 24px 12px;
  font-size: 14px;
}
@media (max-width: 640px) {
  .room-toolbar,
  .roster-facts {
    padding: 10px 12px;
  }
  h2 {
    font-size: 17px;
  }
  .board-caption {
    padding: 8px 12px;
    gap: 3px;
  }
  .distribution {
    padding: 0 10px 8px;
    gap: 3px;
  }
  .day-records {
    padding: 0 12px;
  }
  .booking-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }
  .booking-time {
    grid-column: 1 / -1;
  }
  .booking-time time {
    display: inline;
  }
  .booking-people {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .roster-facts {
    gap: 6px;
  }
  .roster-facts button {
    padding: 6px 10px;
  }
}
</style>
