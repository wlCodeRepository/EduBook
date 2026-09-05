<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { bookingDisplayStatus } from "../lib/booking-groups";
import { teacherWeek } from "../lib/teacher-week";
import type { Booking } from "../lib/types";
const props = defineProps<{
  bookings: Booking[];
  timezone: string;
  language: string;
}>();
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
  <section class="panel week-panel">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">{{ zh ? "本周课程" : "This week" }}</p>
        <h3>{{ label(days[0].key) }} — {{ label(days[6].key) }}</h3>
      </div>
      <small>{{ timezone }}</small>
    </div>
    <div class="week-days">
      <article
        v-for="day in days"
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
          </div>
          <p v-if="!day.bookings.length" class="week-empty">
            {{ zh ? "暂无课程" : "No lessons" }}
          </p>
        </div>
      </article>
    </div>
    <p class="week-note">
      {{
        zh
          ? "待确认与已确认预约均占用时间；其余未来时段如未设置禁约，学生可按 15 分钟档位发起预约。"
          : "Pending and confirmed bookings reserve time. Other future times are open for requests at 15-minute starts unless blocked."
      }}
    </p>
  </section>
</template>
