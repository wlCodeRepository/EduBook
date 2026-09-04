<script setup lang="ts">
import { computed } from "vue";
import { teacherWeek } from "../lib/teacher-week";
import type { Booking } from "../lib/types";
const props = defineProps<{
  bookings: Booking[];
  timezone: string;
  language: string;
}>();
const days = computed(() => teacherWeek(props.bookings, props.timezone));
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
          {{ label(day.key)
          }}<span v-if="day.today">{{ zh ? "今天" : "Today" }}</span>
        </h4>
        <div
          v-for="booking in day.bookings"
          :key="booking.id"
          class="week-lesson"
          :class="booking.status.toLowerCase()"
        >
          <strong
            >{{ time(booking.start_at_utc) }} –
            {{ time(booking.end_at_utc) }}</strong
          >
          <span>{{
            booking.student?.display_name || (zh ? "学生" : "Student")
          }}</span>
          <small>{{
            booking.status === "PENDING"
              ? zh
                ? "待确认"
                : "Pending"
              : booking.status === "COMPLETED"
                ? zh
                  ? "已完成"
                  : "Completed"
                : zh
                  ? "已确认"
                  : "Confirmed"
          }}</small>
        </div>
        <p v-if="!day.bookings.length" class="week-empty">
          {{ zh ? "暂无课程" : "No lessons" }}
        </p>
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
