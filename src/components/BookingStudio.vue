<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { Profile, BusySlot, BlockedPeriod } from "../lib/types";
import type { BookingSlot } from "../lib/booking";
import {
  shiftStudioDate,
  studioDate,
  studioSlot,
  studioStarts,
} from "../lib/booking-studio";

const props = defineProps<{
  teachers: Profile[];
  selectedTeacherId: string;
  busySlots: BusySlot[];
  blocked: BlockedPeriod[];
  timezone: string;
  language: string;
  busy: boolean;
  loading: boolean;
  error?: string;
  receipt?: BookingSlot | null;
}>();
const emit = defineEmits<{
  "select-teacher": [id: string];
  "range-change": [range: { from: string; until: string }];
  submit: [slot: BookingSlot];
}>();
const teacherId = computed(() => props.selectedTeacherId);
const teacher = computed(() =>
  props.teachers.find((t) => t.id === teacherId.value),
);
const now = ref(new Date());
const today = computed(() => studioDate(now.value, props.timezone));
const page = ref(today.value);
const date = ref(today.value);
const periods = ["night", "morning", "afternoon", "evening"] as const;
function defaultPeriod() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: props.timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now.value),
  );
  return date.value === today.value ? periods[Math.floor(hour / 6)] : "morning";
}
const activePeriod = ref<(typeof periods)[number]>(defaultPeriod());
watch([date, () => props.timezone], () => {
  activePeriod.value = defaultPeriod();
});
const start = ref("");
const lessons = ref(1);
const sent = ref(false);
watch(
  () => props.receipt,
  (receipt) => {
    if (receipt) {
      start.value = "";
      sent.value = false;
    }
  },
);
const zh = computed(() => props.language.startsWith("zh"));
const tr = (cn: string, en: string) => (zh.value ? cn : en);
const timer = setInterval(() => {
  now.value = new Date();
}, 30_000);
onBeforeUnmount(() => clearInterval(timer));
watch(today, (value) => {
  if (page.value < value) page.value = value;
  if (date.value < value) {
    date.value = value;
    start.value = "";
  }
});
watch(
  () => props.timezone,
  () => {
    page.value = today.value;
    date.value = today.value;
    start.value = "";
  },
);
watch(teacher, () => {
  start.value = "";
  sent.value = false;
});
// UTC half-open bounds: viewer-local seven-day page plus two trailing days.
function requestRange() {
  const days = Array.from({ length: 9 }, (_, i) =>
    studioStarts(shiftStudioDate(page.value, i), props.timezone),
  ).flat();
  if (days.length)
    emit("range-change", {
      from: days[0].utc,
      until: new Date(Date.parse(days.at(-1)!.utc) + 15 * 60_000).toISOString(),
    });
}
watch([page, date, () => props.timezone], requestRange, { immediate: true });
watch(
  () => props.busy,
  (value, previous) => {
    if (previous && !value) sent.value = false;
  },
);
watch([start, lessons], () => {
  sent.value = false;
});
function selectTeacher(id: string) {
  if (id === teacherId.value || props.busy) return;
  start.value = "";
  sent.value = false;
  emit("select-teacher", id);
}
const dates = computed(() =>
  Array.from({ length: 7 }, (_, index) => shiftStudioDate(page.value, index)),
);
function turnPage(direction: number) {
  page.value = [today.value, shiftStudioDate(page.value, direction * 7)]
    .sort()
    .at(-1)!;
  date.value = page.value;
  start.value = "";
}
function selectDate(value: string) {
  date.value = value;
  start.value = "";
}
const ranges = computed(() => [
  ...props.busySlots,
  ...props.blocked.filter((b) => b.teacher_id === teacherId.value),
]);
function slot(utc: string, count: number) {
  return teacher.value
    ? studioSlot(
        utc,
        teacher.value.default_lesson_minutes,
        count,
        props.timezone,
        teacher.value.timezone,
        ranges.value,
        props.language,
        now.value,
      )
    : null;
}
const starts = computed(() =>
  studioStarts(date.value, props.timezone).map((item) => ({
    ...item,
    single: slot(item.utc, 1)?.available ?? false,
    full: slot(item.utc, lessons.value)?.available ?? false,
  })),
);
const repeatedTimes = computed(() => {
  const counts = new Map<string, number>();
  starts.value.forEach((item) =>
    counts.set(item.time, (counts.get(item.time) || 0) + 1),
  );
  return new Set(
    [...counts].filter(([, count]) => count > 1).map(([time]) => time),
  );
});
const lengths = computed(() =>
  Array.from({ length: 8 }, (_, i) => ({
    count: i + 1,
    available: !start.value || !!slot(start.value, i + 1)?.available,
  })),
);
const selected = computed(() =>
  start.value ? slot(start.value, lessons.value) : null,
);
const locked = computed(() => props.busy || props.loading || !!props.error);
const canSubmit = computed(
  () => !locked.value && !sent.value && selected.value?.available,
);
function periodLabel(period: (typeof periods)[number]) {
  return period === "night"
    ? tr("凌晨 · 00–06", "Night · 00–06")
    : period === "morning"
      ? tr("上午 · 06–12", "Morning · 06–12")
      : period === "afternoon"
        ? tr("下午 · 12–18", "Afternoon · 12–18")
        : tr("晚上 · 18–24", "Evening · 18–24");
}
function teacherTime(value: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: teacher.value?.timezone || props.timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).format(new Date(value));
}
function dateLabel(value: string, weekday: boolean) {
  return new Intl.DateTimeFormat(
    zh.value ? "zh-CN" : "en-GB",
    weekday
      ? { timeZone: "UTC", weekday: "short" }
      : { timeZone: "UTC", month: "short", day: "numeric" },
  ).format(new Date(`${value}T12:00:00Z`));
}
function submit() {
  // Re-evaluate wall time at the action boundary, including after suspended tabs.
  now.value = new Date();
  if (!canSubmit.value || !selected.value) return;
  sent.value = true;
  emit("submit", { ...selected.value });
}
</script>

<template>
  <section
    class="booking-studio"
    :aria-label="tr('预约课程', 'Book a lesson')"
    :aria-busy="!error && (loading || busy)"
  >
    <div v-if="receipt" class="booking-receipt" role="status">
      <strong>{{
        tr(
          "预约申请已提交 · 待老师确认",
          "Request received · awaiting teacher confirmation",
        )
      }}</strong>
      <p>{{ receipt.viewerStart }} — {{ receipt.viewerEnd }}</p>
      <small>{{
        tr(
          "整段时间已为你保留。无需重复提交。",
          "The whole interval is reserved. No need to submit again.",
        )
      }}</small>
    </div>
    <aside class="studio-teachers">
      <p class="eyebrow">{{ tr("学习空间 / 01", "LEARNING SPACE / 01") }}</p>
      <h2>{{ tr("跟谁一起学？", "Find your teacher") }}</h2>
      <p class="muted">
        {{
          tr("选择老师，安排下一次进步。", "Make room for your next lesson.")
        }}
      </p>
      <p v-if="!teachers.length" role="status">
        {{
          loading && !error
            ? tr("正在加载老师…", "Loading teachers…")
            : tr("暂无可预约老师。", "No teachers available.")
        }}
      </p>
      <div class="teacher-list">
        <button
          v-for="person in teachers"
          :key="person.id"
          type="button"
          class="teacher-choice"
          :aria-pressed="teacherId === person.id"
          :disabled="busy"
          @click="selectTeacher(person.id)"
        >
          <span class="avatar" aria-hidden="true">{{
            person.display_name.slice(0, 1)
          }}</span>
          <span
            ><strong>{{ person.display_name }}</strong
            ><small
              >{{ person.default_lesson_minutes }}
              {{ tr("分钟 / 节", "min / lesson") }}</small
            ><small>{{ person.timezone }}</small></span
          >
        </button>
      </div>
    </aside>

    <div class="studio-schedule">
      <p class="eyebrow">{{ tr("你的时间 / 02", "YOUR TIME / 02") }}</p>
      <div class="schedule-heading">
        <h2>{{ tr("留一段时间给自己", "A little time to learn") }}</h2>
        <span class="timezone">{{ timezone }}</span>
      </div>
      <nav class="date-navigation" :aria-label="tr('日期翻页', 'Date pages')">
        <button
          type="button"
          :disabled="page <= today || busy"
          @click="turnPage(-1)"
        >
          {{ tr("前7天", "Previous 7 days") }}
        </button>
        <span
          >{{ dateLabel(page, false) }} – {{ dateLabel(dates[6], false) }}</span
        >
        <button type="button" :disabled="busy" @click="turnPage(1)">
          {{ tr("后7天", "Next 7 days") }}
        </button>
      </nav>
      <div
        class="date-strip"
        role="group"
        :aria-label="tr('选择日期', 'Choose date')"
      >
        <button
          v-for="day in dates"
          :key="day"
          type="button"
          :data-date="day"
          :aria-pressed="date === day"
          :disabled="busy"
          @click="selectDate(day)"
        >
          <small>{{ dateLabel(day, true) }}</small
          ><strong>{{ dateLabel(day, false) }}</strong>
        </button>
      </div>
      <fieldset :disabled="locked || !teacher">
        <legend>
          {{ tr("连续课时", "Consecutive lessons") }}
          <span v-if="teacher"
            >· {{ teacher.default_lesson_minutes }}
            {{ tr("分钟 / 节", "min each") }}</span
          >
        </legend>
        <div class="lengths">
          <button
            v-for="option in lengths"
            :key="option.count"
            type="button"
            :data-lessons="option.count"
            :aria-pressed="lessons === option.count"
            :disabled="!option.available || locked || !teacher"
            @click="lessons = option.count"
          >
            {{ option.count
            }}<small v-if="!option.available">{{
              tr("冲突", "Conflict")
            }}</small>
          </button>
        </div>
      </fieldset>
      <p class="hint">
        {{
          tr(
            "可先选时间或节数。全天开放；标注“需缩短”的起点可选择后调整节数。",
            "Choose time or length first. All hours shown; select “Shorter only” starts to adjust the length.",
          )
        }}
      </p>
      <div v-if="error" class="availability-error" role="alert">
        <p>{{ error }}</p>
        <p>
          {{
            tr(
              "未能加载可预约时间，请重试。",
              "Could not load availability. Please retry.",
            )
          }}
        </p>
        <button type="button" :disabled="busy" @click="requestRange">
          {{ tr("重试", "Retry") }}
        </button>
      </div>
      <p v-else-if="loading" role="status">
        {{
          tr("正在加载老师的忙时段，请稍候…", "Loading teacher availability…")
        }}
      </p>
      <p v-else-if="!teacher" role="status">
        {{ tr("请先选择一位老师。", "Choose a teacher to see times.") }}
      </p>
      <template v-else>
        <p v-if="!starts.some((item) => item.single)" role="status">
          {{
            tr(
              "当天没有可预约起点，请换一天。",
              "No available starts on this date. Try another day.",
            )
          }}
        </p>
        <div
          class="period-switch"
          role="group"
          :aria-label="tr('选择时段', 'Choose time of day')"
        >
          <button
            v-for="period in periods"
            :key="period"
            type="button"
            :data-period="period"
            :aria-pressed="activePeriod === period"
            @click="activePeriod = period"
          >
            {{ periodLabel(period) }}
          </button>
        </div>
        <section class="time-section" :aria-label="periodLabel(activePeriod)">
          <div class="time-grid">
            <button
              v-for="item in starts.filter((s) => s.period === activePeriod)"
              :key="item.utc"
              type="button"
              :data-start="item.utc"
              :aria-label="`${date} ${item.time} ${item.offset}${!item.single ? tr(' 不可用', ' Unavailable') : !item.full ? tr(' 需缩短', ' Shorter only') : ''}`"
              :aria-pressed="start === item.utc"
              :disabled="!item.single || locked"
              :class="{ 'shorter-only': item.single && !item.full }"
              @click="start = item.utc"
            >
              <strong>{{ item.time }}</strong
              ><small v-if="repeatedTimes.has(item.time)" class="time-offset">{{
                item.offset
              }}</small
              ><small v-if="!item.single">{{
                tr("不可用", "Unavailable")
              }}</small
              ><small v-else-if="!item.full">{{
                tr("需缩短", "Shorter only")
              }}</small>
            </button>
          </div>
        </section>
      </template>
    </div>

    <aside class="lesson-ticket" :aria-label="tr('课程票', 'Lesson ticket')">
      <p class="eyebrow">{{ tr("课程票 / 03", "LESSON TICKET / 03") }}</p>
      <h2>
        {{ teacher?.display_name || tr("你的下一课", "Your next lesson") }}
      </h2>
      <p class="ticket-duration">
        {{ lessons }}
        <span>{{
          tr("节连续课程", lessons === 1 ? "lesson" : "consecutive lessons")
        }}</span>
      </p>
      <p v-if="teacher">
        {{ teacher.default_lesson_minutes * lessons }}
        {{ tr("分钟", "minutes") }}
      </p>
      <div class="ticket-time" aria-live="polite">
        <template v-if="selected"
          ><p>{{ selected.viewerStart }}</p>
          <span>↓</span>
          <p>{{ selected.viewerEnd }}</p>
          <small>{{ timezone }}</small>
          <template v-if="teacher && teacher.timezone !== timezone"
            ><small
              >{{ tr("老师当地时间", "Teacher local time") }} ·
              {{ teacher.timezone }}</small
            >
            <p>
              {{ teacherTime(selected.startAtUtc) }} —
              {{ teacherTime(selected.endAtUtc) }}
            </p></template
          ></template
        >
        <p v-else>
          {{
            tr(
              "选择日期、起点和节数，生成课程票。",
              "Choose a date, start and length to prepare your ticket.",
            )
          }}
        </p>
      </div>
      <p v-if="selected && !selected.available" class="conflict" role="status">
        {{
          tr(
            "所选整段不可用：请缩短节数或更换起点。",
            "This full interval is unavailable. Shorten the lesson count or choose another start.",
          )
        }}
      </p>
      <button
        type="button"
        class="submit-booking"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{
          error
            ? tr("请重试加载", "Retry availability")
            : busy
              ? tr("正在提交…", "Submitting…")
              : loading
                ? tr("加载中…", "Loading…")
                : sent
                  ? tr("已发送预约请求", "Request sent")
                  : tr("预约这段时间", "Request this lesson")
        }}
      </button>
      <p class="muted">
        {{
          tr(
            "一次提交完整连续时段，等待老师确认。",
            "One request for the whole interval, subject to teacher confirmation.",
          )
        }}
      </p>
    </aside>
  </section>
</template>

<style scoped>
.booking-studio {
  --ink: #252c2d;
  --paper: #fffefa;
  --teal: #16786f;
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(0, 2.5fr) minmax(
      220px,
      1fr
    );
  gap: 24px;
  color: var(--ink);
  background: #f7f5ee;
  padding: 24px;
  border: 1px solid #dedfd8;
  border-radius: 20px;
  font:
    14px/1.5 system-ui,
    sans-serif;
}
.booking-receipt {
  grid-column: 1/-1;
  padding: 18px 22px;
  background: #d8f1e9;
  border: 1px solid #8ab6a5;
  border-radius: 12px;
}
.booking-receipt p {
  margin: 10px 0 6px;
}
.booking-studio * {
  box-sizing: border-box;
}
h2,
h3,
p {
  margin: 0 0 12px;
}
h2 {
  font:
    600 23px/1.2 "Trebuchet MS",
    sans-serif;
}
h3 {
  font-size: 14px;
}
button {
  font: inherit;
  color: inherit;
  cursor: pointer;
  min-height: 44px;
  border: 1px solid #c9cec7;
  border-radius: 10px;
  background: var(--paper);
  padding: 9px 12px;
  touch-action: manipulation;
}
button:hover:not(:disabled) {
  border-color: var(--teal);
  background: #edf6f2;
}
button[aria-pressed="true"] {
  background: #d8f1e9;
  border-color: var(--teal);
  box-shadow: inset 0 0 0 1px var(--teal);
}
button:focus-visible {
  outline: 3px solid var(--teal);
  outline-offset: 3px;
}
button:disabled {
  cursor: not-allowed;
  color: #777e79;
  background: #eeeee8;
}
.eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.13em;
  color: #556762;
}
.muted,
.hint {
  color: #5b6560;
  font-size: 12px;
}
small {
  display: block;
  font-size: 11px;
}
.availability-error {
  border: 1px solid #d9b797;
  border-radius: 10px;
  padding: 14px;
  color: #754011;
  background: #fff5e9;
  overflow-wrap: anywhere;
}
.period-switch {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 18px;
}
.period-switch button {
  font-size: 12px;
  padding: 8px 4px;
}
.studio-teachers,
.studio-schedule,
.lesson-ticket {
  min-width: 0;
}
.teacher-list {
  display: grid;
  gap: 10px;
}
.teacher-choice {
  text-align: left;
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  overflow-wrap: anywhere;
}
.avatar {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  background: #dce7e3;
  border-radius: 50%;
  font-weight: 700;
}
.schedule-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}
.timezone {
  color: var(--teal);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.date-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 0;
  font-size: 12px;
}
.date-navigation span {
  text-align: center;
}
.date-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  margin-bottom: 22px;
}
.date-strip button {
  padding: 10px 2px;
}
.date-strip strong {
  font-size: 12px;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0 0 12px;
  min-width: 0;
}
legend {
  margin-bottom: 10px;
  font-weight: 600;
}
legend span {
  font-weight: 400;
  font-size: 12px;
}
.lengths {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
}
.lengths button {
  padding: 6px 2px;
}
.time-section {
  margin-top: 20px;
}
.time-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 7px;
}
.time-grid button {
  padding: 8px 3px;
  min-height: 65px;
}
.time-grid strong {
  font-family: ui-monospace, monospace;
  font-size: 14px;
}
.time-grid small {
  font-size: 10px;
}
.shorter-only {
  border-style: dashed;
}
.shorter-only small:last-child,
.conflict {
  color: #8b4a13;
}
.lesson-ticket {
  background: var(--paper);
  padding: 22px;
  border: 1px solid #d9ddd4;
  border-top: 4px solid var(--teal);
  border-radius: 8px;
  align-self: start;
  position: sticky;
  top: 20px;
}
.ticket-duration {
  margin-top: 25px;
  font-size: 38px;
  font-family: "Trebuchet MS", sans-serif;
}
.ticket-duration span {
  font: 14px system-ui;
}
.ticket-time {
  border-block: 1px dashed #c8cec4;
  margin: 20px 0;
  padding: 18px 0;
  font-family: ui-monospace, monospace;
  overflow-wrap: anywhere;
}
.ticket-time p {
  margin: 6px 0;
}
.submit-booking {
  width: 100%;
  background: var(--teal);
  color: white;
  font-weight: 600;
  margin: 8px 0 12px;
}
.submit-booking:hover:not(:disabled) {
  background: #105f58;
  color: white;
}
@media (max-width: 1100px) {
  .booking-studio {
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 18px;
  }
  .studio-teachers {
    grid-column: 1/-1;
  }
  .teacher-list {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }
}
@media (max-width: 700px) {
  .booking-studio {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
    gap: 24px;
    border-radius: 12px;
  }
  .studio-teachers {
    grid-column: auto;
  }
  .lesson-ticket {
    position: static;
  }
  .teacher-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .teacher-choice {
    padding: 8px;
  }
  .avatar {
    display: none;
  }
  .date-strip {
    overflow-x: auto;
    grid-template-columns: repeat(7, minmax(54px, 1fr));
    padding: 4px;
  }
  .date-navigation button {
    max-width: 100px;
  }
  .lengths {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
