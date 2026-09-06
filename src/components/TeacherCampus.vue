<script setup lang="ts">
import { computed } from "vue";
import TeacherWeek from "./TeacherWeek.vue";
import { bookingGroup } from "../lib/booking-groups";
import {
  campusDuration,
  campusTime,
  useCampusClock,
} from "../lib/campus-teaching";
import type { Booking } from "../lib/types";

const props = defineProps<{
  bookings: Booking[];
  timezone: string;
  language: string;
  lessonMinutes: number;
  loading?: boolean;
}>();
const emit = defineEmits<{
  requests: [];
  settings: [];
  "block-date": [date: string];
}>();
const now = useCampusClock();
const zh = computed(() => props.language === "zh");
const ordered = computed(() =>
  [...props.bookings].sort(
    (a, b) => Date.parse(a.start_at_utc) - Date.parse(b.start_at_utc),
  ),
);
const next = computed(() =>
  ordered.value.find(
    (booking) => bookingGroup(booking, now.value) === "upcoming",
  ),
);
const pending = computed(() =>
  ordered.value.filter(
    (booking) => bookingGroup(booking, now.value) === "pending",
  ),
);
const time = (value: string) =>
  campusTime(value, props.timezone, props.language);
</script>

<template>
  <section class="teacher-campus" :aria-busy="!!loading">
    <header class="campus-heading">
      <div>
        <h1>{{ zh ? "教学日程" : "Teaching schedule" }}</h1>
        <p>
          {{ lessonMinutes }}
          {{ zh ? "分钟 / 标准课时" : "min / standard lesson" }}
        </p>
      </div>
      <button type="button" data-action="settings" @click="emit('settings')">
        {{ zh ? "课时与禁约设置" : "Lesson & availability settings" }}
        <span aria-hidden="true">↗</span>
      </button>
    </header>
    <p v-if="loading" class="loading" role="status">
      {{ zh ? "正在加载教学日程…" : "Loading teaching schedule…" }}
    </p>
    <div v-else class="calendar-stage">
      <TeacherWeek
        :bookings="bookings"
        :timezone="timezone"
        :language="language"
        can-block
        @block-date="emit('block-date', $event)"
      />
      <div class="teaching-lanes">
        <section class="next-lesson" data-testid="next-lesson">
          <p class="kicker">
            {{
              next && Date.parse(next.start_at_utc) <= now.getTime()
                ? zh
                  ? "正在进行"
                  : "In progress"
                : zh
                  ? "下一节课"
                  : "Next lesson"
            }}
          </p>
          <template v-if="next">
            <h2>
              {{ next.student?.display_name || (zh ? "学生" : "Student") }}
            </h2>
            <p class="lesson-time">
              <time :datetime="next.start_at_utc">{{
                time(next.start_at_utc)
              }}</time>
              —
              <time :datetime="next.end_at_utc">{{
                time(next.end_at_utc)
              }}</time>
            </p>
            <p class="next-duration">{{ campusDuration(next, language) }}</p>
          </template>
          <template v-else
            ><h2>{{ zh ? "暂无即将开始的课程" : "No upcoming lesson" }}</h2>
            <p>
              {{
                zh
                  ? "确认学生请求后，课程会显示在课表中。"
                  : "Confirm a student request to add it to your schedule."
              }}
            </p></template
          >
        </section>
        <section class="request-lane">
          <header>
            <div>
              <p class="kicker">{{ zh ? "预约收件箱" : "Request inbox" }}</p>
              <h2>
                {{ pending.length }}
                {{ zh ? "项待处理" : "awaiting your reply" }}
              </h2>
            </div>
            <button
              type="button"
              data-action="requests"
              @click="emit('requests')"
            >
              {{ zh ? "处理请求" : "Review requests" }}
              <span aria-hidden="true">→</span>
            </button>
          </header>
          <ol v-if="pending.length">
            <li
              v-for="booking in pending.slice(0, 2)"
              :key="booking.id"
              class="request-lane-item"
            >
              <strong>{{
                booking.student?.display_name || (zh ? "学生" : "Student")
              }}</strong
              ><time :datetime="booking.start_at_utc">{{
                time(booking.start_at_utc)
              }}</time
              ><small>{{ campusDuration(booking, language) }}</small>
            </li>
          </ol>
          <p v-else>
            {{
              zh
                ? "已处理所有请求。新请求会出现在这里。"
                : "All requests reviewed. New requests will appear here."
            }}
          </p>
          <p v-if="pending.length > 2" class="more">
            {{
              zh
                ? `另有 ${pending.length - 2} 项`
                : `${pending.length - 2} more in your inbox.`
            }}
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.teacher-campus {
  color: var(--campus-ink, #233957);
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: var(--campus-stage-height, calc(100dvh - 150px));
  overflow: auto;
  overscroll-behavior: contain;
}
.campus-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}
h1,
h2,
p {
  margin: 0;
}
h1,
h2 {
  font-family: var(--campus-display-font, "Trebuchet MS", sans-serif);
}
h1 {
  font-size: 22px;
  margin: 0 0 4px;
}
h2 {
  font-size: 18px;
  margin: 6px 0 10px;
}
.campus-heading p {
  font-size: 12px;
}
.kicker {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--campus-blue, #5378b5);
}
button {
  cursor: pointer;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 10px;
  padding: 12px 16px;
  background: var(--campus-paper, #fcfdff);
  color: inherit;
  font: inherit;
  font-size: 14px;
}
button:hover {
  border-color: var(--campus-blue, #5378b5);
}
button:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: 3px;
}
.calendar-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 230px;
  gap: 12px;
  flex: 1 1 0;
  min-height: 240px;
}
.teaching-lanes {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  border-left: 1px solid var(--campus-line, #d5deeb);
  padding-left: 14px;
}
.next-lesson,
.request-lane {
  display: block;
  padding: 14px 0;
  min-width: 0;
  font-size: 13px;
  line-height: 1.5;
}
.next-lesson {
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
.request-lane .kicker {
  color: var(--campus-coral, #c86454);
}
.request-lane header button {
  width: 100%;
  margin-bottom: 10px;
}
.lesson-time {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 8px;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}
.request-lane-item {
  display: grid;
  gap: 4px;
  padding: 10px 0;
  border-top: 1px solid var(--campus-line, #d5deeb);
}
.request-lane-item time {
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
.loading {
  padding: 32px 16px;
  background: var(--campus-paper, #fcfdff);
  border-radius: 12px;
}
.more {
  margin-top: 8px;
  font-size: 12px;
}
strong,
h2 {
  overflow-wrap: anywhere;
}
@media (min-width: 761px) and (max-width: 1150px) {
  .calendar-stage {
    grid-template-columns: minmax(0, 1fr) 190px;
  }
}
@media (max-width: 760px) {
  .teacher-campus {
    gap: 8px;
  }
  h1 {
    font-size: 18px;
  }
  .campus-heading button {
    font-size: 12px;
    padding: 10px;
    min-height: 44px;
    max-width: 170px;
  }
  .calendar-stage {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(180px, 1fr) auto;
    gap: 8px;
    min-height: 290px;
  }
  .teaching-lanes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-left: 0;
    border-top: 1px solid var(--campus-line, #d5deeb);
    padding: 6px 0 0;
    gap: 12px;
    max-height: 125px;
  }
  .next-lesson,
  .request-lane {
    padding: 0;
    border: 0;
  }
  .next-lesson h2,
  .request-lane h2 {
    font-size: 14px;
    margin: 3px 0;
  }
  .kicker {
    font-size: 11px;
  }
  .lesson-time {
    margin: 0;
    font-size: 11px;
  }
  .next-duration {
    font-size: 11px;
  }
  .request-lane ol,
  .request-lane .more,
  .request-lane > p {
    display: none;
  }
  .request-lane header button {
    padding: 8px;
    min-height: 44px;
    font-size: 12px;
    margin: 4px 0 0;
  }
}
</style>
