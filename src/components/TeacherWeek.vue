<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from "vue";
import { bookingDisplayStatus } from "../lib/booking-groups";
import { campusDuration, useCampusMobile } from "../lib/campus-teaching";
import { teacherWeek } from "../lib/teacher-week";
import type { Booking } from "../lib/types";
const props = defineProps<{
  bookings: Booking[];
  timezone: string;
  language: string;
  canBlock?: boolean;
}>();
const emit = defineEmits<{ "block-date": [date: string] }>();
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 30000);
});
onBeforeUnmount(() => clearInterval(timer));
const days = computed(() =>
  teacherWeek(props.bookings, props.timezone, now.value),
);
const zh = computed(() => props.language === "zh");
const mobile = useCampusMobile();
const selectedDate = ref("");
watch(
  () => [props.timezone, days.value[0].key],
  () => {
    selectedDate.value =
      days.value.find((day) => day.today)?.key || days.value[0].key;
  },
  { immediate: true },
);
const displayedDays = computed(() =>
  mobile.value
    ? days.value.filter((day) => day.key === selectedDate.value)
    : days.value,
);
function label(date: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
function time(value: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: props.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
function weekday(date: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00Z`));
}
</script>
<template>
  <section class="week-panel">
    <div class="week-heading">
      <div>
        <p class="week-kicker">{{ zh ? "本周课程" : "This week" }}</p>
        <h3>{{ label(days[0].key) }} — {{ label(days[6].key) }}</h3>
      </div>
      <small>{{ timezone }}</small>
    </div>
    <nav
      v-if="mobile"
      class="day-selector"
      :aria-label="zh ? '选择日期' : 'Select day'"
    >
      <button
        v-for="day in days"
        :key="day.key"
        type="button"
        :aria-pressed="selectedDate === day.key"
        :aria-label="label(day.key)"
        :aria-current="day.today ? 'date' : undefined"
        @click="selectedDate = day.key"
      >
        <span>{{ weekday(day.key) }}</span
        ><strong>{{ Number(day.key.slice(-2)) }}</strong
        ><small>{{ day.bookings.length }} {{ zh ? "课" : "class" }}</small>
      </button>
    </nav>
    <div
      class="week-days"
      tabindex="0"
      :aria-label="zh ? '课程日程' : 'Lesson schedule'"
    >
      <article
        v-for="day in displayedDays"
        :key="day.key"
        class="week-day"
        :class="{ 'is-today': day.today }"
      >
        <h4>
          <span class="weekday">{{ weekday(day.key) }}</span>
          <span class="day-number">{{ Number(day.key.slice(-2)) }}</span>
          <span v-if="day.today" class="today-label">{{
            zh ? "今天" : "Today"
          }}</span>
        </h4>
        <div class="week-day-lessons">
          <div
            v-for="booking in day.bookings"
            :key="booking.id"
            class="week-lesson"
            :class="bookingDisplayStatus(booking, now).toLowerCase()"
          >
            <strong
              >{{ time(booking.start_at_utc) }} –
              {{ time(booking.end_at_utc) }}</strong
            >
            <span>{{
              booking.student?.display_name || (zh ? "学生" : "Student")
            }}</span>
            <small>{{
              bookingDisplayStatus(booking, now) === "EXPIRED"
                ? zh
                  ? "已过期"
                  : "Expired"
                : bookingDisplayStatus(booking, now) === "PENDING"
                  ? zh
                    ? "待确认"
                    : "Pending"
                  : bookingDisplayStatus(booking, now) === "COMPLETED"
                    ? zh
                      ? "已结束"
                      : "Ended"
                    : zh
                      ? "已确认"
                      : "Confirmed"
            }}</small>
            <small>{{ campusDuration(booking, language) }}</small>
          </div>
          <p v-if="!day.bookings.length" class="week-empty">
            {{ zh ? "暂无课程" : "No lessons" }}
          </p>
          <button
            v-if="canBlock"
            class="week-block-button"
            type="button"
            @click="emit('block-date', day.key)"
          >
            {{ zh ? "设置禁约" : "Block time" }}
          </button>
        </div>
      </article>
    </div>
    <details class="week-help">
      <summary>{{ zh ? "预约规则" : "Booking rules" }}</summary>
      <p class="week-note">
        {{
          zh
            ? "待确认与已确认预约均占用时间；未禁约的空闲时段可预约。按老师时区整点开始，每节50分钟、课间10分钟。"
            : "Pending and confirmed bookings reserve time. Unblocked free time is bookable on the hour in teacher time: 50 minutes per lesson, 10 minutes between lessons."
        }}
      </p>
    </details>
  </section>
</template>
<style scoped>
.week-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  padding: 0;
  overflow: hidden;
  background: var(--campus-paper, #fcfdff);
  color: var(--campus-ink, #233957);
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 12px;
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
}
.week-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
.week-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--campus-blue, #5378b5);
}
.week-heading h3 {
  font: 600 16px var(--campus-display-font, "Trebuchet MS", sans-serif);
  margin: 0;
}
.week-heading small {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.week-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(100px, 1fr));
  flex: 1 1 0;
  min-height: 0;
  margin: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.week-day {
  display: flex;
  flex-direction: column;
  padding: 0;
  min-width: 0;
  border: 0;
  border-right: 1px solid var(--campus-line, #d5deeb);
  background: transparent;
}
.week-day:last-child {
  border-right: 0;
}
.week-day.is-today {
  background: var(--campus-mist, #eaf0f7);
}
.week-day h4 {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-height: 88px;
  margin: 0;
  padding: 12px 10px;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
  box-sizing: border-box;
}
.week-day .weekday {
  font-size: 12px;
  color: inherit;
}
.week-day .day-number {
  font:
    500 24px ui-monospace,
    monospace;
  color: inherit;
}
.week-day .today-label {
  font-size: 11px;
  color: var(--campus-blue, #5378b5);
}
.week-day-lessons {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.week-lesson {
  display: grid;
  gap: 5px;
  padding: 9px 7px;
  margin: 0;
  border: 1px solid var(--campus-line, #d5deeb);
  border-left: 3px solid var(--campus-blue, #5378b5);
  border-radius: 5px;
  background: var(--campus-paper, #fcfdff);
  color: var(--campus-ink, #233957);
  overflow-wrap: anywhere;
}
.week-lesson.pending {
  border-left-color: var(--campus-coral, #c86454);
  background: var(--campus-paper, #fcfdff);
  color: var(--campus-ink, #233957);
}
.week-lesson.completed,
.week-lesson.expired {
  border-left-color: var(--campus-line, #d5deeb);
  background: var(--campus-mist, #eaf0f7);
  color: var(--campus-ink, #233957);
  opacity: 1;
}
.week-lesson strong {
  font:
    600 12px/1.6 ui-monospace,
    monospace;
}
.week-lesson span {
  font-size: 13px;
}
.week-lesson small {
  font-size: 11px;
  line-height: 1.5;
}
.week-empty {
  font-size: 12px;
  text-align: center;
  margin: 16px 0;
  padding: 0;
  color: inherit;
}
.week-block-button {
  padding: 8px 4px;
  min-height: 44px;
  font: inherit;
  font-size: 12px;
  border: 1px dashed var(--campus-line, #d5deeb);
  background: transparent;
  color: var(--campus-ink, #233957);
  border-radius: 5px;
  width: 100%;
  cursor: pointer;
}
.week-block-button:hover {
  background: var(--campus-mist, #eaf0f7);
}
.week-help {
  flex: 0 0 auto;
  border-top: 1px solid var(--campus-line, #d5deeb);
  padding: 10px 16px;
  font-size: 12px;
  max-height: 100px;
  overflow: auto;
}
summary {
  cursor: pointer;
  min-height: 24px;
}
.week-note {
  color: inherit;
  margin: 6px 0;
  padding: 0;
  font-size: 12px;
  line-height: 1.6;
}
button:focus-visible,
summary:focus-visible,
.week-days:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: -3px;
}
@media (max-width: 760px) {
  .week-heading {
    padding: 10px 12px;
  }
  .week-heading h3 {
    font-size: 14px;
  }
  .week-heading small {
    max-width: 110px;
  }
  .day-selector {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    padding: 4px;
    gap: 2px;
    border-bottom: 1px solid var(--campus-line, #d5deeb);
  }
  .day-selector button {
    display: grid;
    gap: 3px;
    min-height: 62px;
    padding: 7px 0;
    font: inherit;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .day-selector span,
  .day-selector small {
    font-size: 10px;
  }
  .day-selector strong {
    font:
      600 18px ui-monospace,
      monospace;
  }
  .day-selector button[aria-pressed="true"] {
    background: var(--campus-ink, #233957);
    color: var(--campus-paper, #fcfdff);
  }
  .week-days {
    grid-template-columns: minmax(0, 1fr);
  }
  .week-day {
    display: flex;
    border: 0;
  }
  .week-day h4 {
    flex-direction: row;
    align-items: center;
    min-height: 0;
    padding: 8px 12px;
    gap: 10px;
  }
  .week-day .day-number {
    font-size: 18px;
  }
  .week-day-lessons {
    padding: 8px 12px;
  }
  .week-lesson {
    grid-template-columns: 1fr 1fr;
    padding: 10px;
  }
  .week-lesson strong {
    font-size: 13px;
  }
  .week-empty {
    margin: 20px 0;
  }
  .week-help {
    padding: 5px 12px;
  }
}
</style>
