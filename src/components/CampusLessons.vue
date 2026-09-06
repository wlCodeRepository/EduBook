<script setup lang="ts">
import { computed, ref } from "vue";
import {
  bookingDisplayStatus,
  bookingGroup,
  type BookingGroup,
} from "../lib/booking-groups";
import {
  campusDuration,
  campusStatus,
  campusTime,
  useCampusClock,
  useCampusPagination,
} from "../lib/campus-teaching";
import type { AdminBooking, Booking } from "../lib/types";

const props = defineProps<{
  bookings: (Booking | AdminBooking)[];
  timezone: string;
  language: string;
  mode: "student" | "admin";
  loading?: boolean;
}>();
const emit = defineEmits<{ book: [] }>();
const tab = ref<BookingGroup | "all">("upcoming");
const search = ref("");
const now = useCampusClock();
const zh = computed(() => props.language === "zh");
const tabs = computed(() => [
  { value: "upcoming" as const, label: zh.value ? "即将上课" : "Upcoming" },
  { value: "pending" as const, label: zh.value ? "待确认" : "Pending" },
  { value: "history" as const, label: zh.value ? "历史记录" : "History" },
  { value: "all" as const, label: zh.value ? "全部" : "All" },
]);
const time = (value: string) =>
  campusTime(value, props.timezone, props.language);
const visible = computed(() =>
  props.bookings
    .filter((booking) => {
      const names = [
        booking.teacher?.display_name,
        props.mode === "admin" ? booking.student?.display_name : "",
        time(booking.start_at_utc),
        campusStatus(booking, now.value, props.language),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (tab.value === "all" ||
          bookingGroup(booking, now.value) === tab.value) &&
        names.includes(search.value.trim().toLocaleLowerCase())
      );
    })
    .sort((a, b) =>
      tab.value === "history"
        ? Date.parse(b.start_at_utc) - Date.parse(a.start_at_utc)
        : Date.parse(a.start_at_utc) - Date.parse(b.start_at_utc),
    ),
);
const { page, pageCount, pageItems } = useCampusPagination(visible, [
  tab,
  search,
]);
function dateParts(value: string) {
  const date = new Date(value);
  return {
    day: new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
      timeZone: props.timezone,
      day: "2-digit",
    }).format(date),
    month: new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
      timeZone: props.timezone,
      month: "short",
      year: "numeric",
    }).format(date),
  };
}
</script>

<template>
  <section class="campus-lessons" :aria-busy="!!loading">
    <header class="itinerary-heading">
      <div>
        <h1>
          {{
            mode === "admin"
              ? zh
                ? "全校课程"
                : "Campus lessons"
              : zh
                ? "课程记录"
                : "Your lessons"
          }}
        </h1>
        <p>{{ timezone }}</p>
      </div>
      <button
        v-if="mode === 'student'"
        type="button"
        class="book-button"
        data-action="book"
        @click="emit('book')"
      >
        {{ zh ? "预约课程" : "Book a lesson" }}
        <span aria-hidden="true">↗</span>
      </button>
    </header>
    <div class="itinerary-toolbar">
      <nav :aria-label="zh ? '课程分类' : 'Course categories'">
        <button
          v-for="item in tabs"
          :key="item.value"
          type="button"
          :data-group="item.value"
          :aria-pressed="tab === item.value"
          @click="tab = item.value"
        >
          {{ item.label }}
          <span>{{
            loading
              ? "—"
              : bookings.filter(
                  (b) =>
                    item.value === "all" || bookingGroup(b, now) === item.value,
                ).length
          }}</span>
        </button>
      </nav>
      <input
        v-model="search"
        type="search"
        :aria-label="zh ? '搜索课程' : 'Search lessons'"
        :placeholder="
          mode === 'admin'
            ? zh
              ? '搜索老师、学生或日期'
              : 'Teacher, student or date'
            : zh
              ? '搜索老师或日期'
              : 'Teacher or date'
        "
      />
    </div>
    <p v-if="loading" class="itinerary-empty" role="status">
      {{ zh ? "正在加载课程…" : "Loading lessons…" }}
    </p>
    <div v-else-if="!visible.length" class="itinerary-empty" role="status">
      <h2>
        {{
          search.trim()
            ? zh
              ? "没有匹配的课程"
              : "No matching lessons"
            : zh
              ? "此分类暂无课程"
              : "No lessons in this category"
        }}
      </h2>
      <p>
        {{
          search.trim()
            ? zh
              ? "试试其他姓名或清空搜索。"
              : "Try another name or clear your search."
            : zh
              ? "切换分类查看其他课程记录。"
              : "Choose another category to see your other lessons."
        }}
      </p>
    </div>
    <ol
      v-else
      class="itinerary-list"
      tabindex="0"
      :aria-label="zh ? '课程列表' : 'Lesson list'"
    >
      <li v-for="booking in pageItems" :key="booking.id" class="itinerary-row">
        <div class="date-marker" aria-hidden="true">
          <strong>{{ dateParts(booking.start_at_utc).day }}</strong
          ><span>{{ dateParts(booking.start_at_utc).month }}</span>
        </div>
        <div class="lesson-detail">
          <h2>
            <span class="participant-label">{{ zh ? "老师" : "Teacher" }}</span>
            {{
              booking.teacher?.display_name ||
              (zh ? "未提供姓名" : "Name unavailable")
            }}<template v-if="mode === 'admin'"
              ><span class="participant-divider" aria-hidden="true"> / </span
              ><span class="participant-label">{{
                zh ? "学生" : "Student"
              }}</span>
              {{
                booking.student?.display_name ||
                (zh ? "未提供姓名" : "Name unavailable")
              }}</template
            >
          </h2>
          <p class="lesson-time">
            <time :datetime="booking.start_at_utc">{{
              time(booking.start_at_utc)
            }}</time>
            —
            <time :datetime="booking.end_at_utc">{{
              time(booking.end_at_utc)
            }}</time>
          </p>
          <p class="duration">{{ campusDuration(booking, language) }}</p>
        </div>
        <span
          class="lesson-status"
          :class="bookingDisplayStatus(booking, now).toLowerCase()"
          >{{ campusStatus(booking, now, language) }}</span
        >
      </li>
    </ol>
    <nav
      v-if="!loading && visible.length"
      class="itinerary-pagination"
      :aria-label="zh ? '课程分页' : 'Lesson pages'"
    >
      <button
        type="button"
        data-page="previous"
        :disabled="page === 1"
        @click="page--"
      >
        {{ zh ? "上一页" : "Previous" }}</button
      ><span role="status"
        >{{ page }} / {{ pageCount }} · {{ visible.length }}
        {{ zh ? "项" : "lessons" }}</span
      ><button
        type="button"
        data-page="next"
        :disabled="page === pageCount"
        @click="page++"
      >
        {{ zh ? "下一页" : "Next" }}
      </button>
    </nav>
  </section>
</template>

<style scoped>
.campus-lessons {
  color: var(--campus-ink, #233957);
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: var(--campus-stage-height, calc(100dvh - 150px));
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  overscroll-behavior: contain;
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
.itinerary-heading p {
  font-size: 12px;
}
.itinerary-heading,
.itinerary-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}
.itinerary-toolbar {
  flex-wrap: wrap;
  margin: 0;
}
button,
input {
  font: inherit;
  color: inherit;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 9px;
  padding: 12px 16px;
  background: var(--campus-paper, #fcfdff);
  min-height: 44px;
}
button {
  cursor: pointer;
}
.book-button {
  background: var(--campus-ink, #233957);
  color: var(--campus-paper, #fcfdff);
}
nav {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  background: var(--campus-mist, #eaf0f7);
  border-radius: 12px;
}
nav button {
  background: transparent;
  border-color: transparent;
  font-size: 14px;
}
nav button[aria-pressed="true"] {
  background: var(--campus-paper, #fcfdff);
  border-color: var(--campus-line, #d5deeb);
}
nav span {
  margin-left: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}
button:focus-visible,
input:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: 3px;
}
input {
  width: min(100%, 290px);
  box-sizing: border-box;
}
.itinerary-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 12px;
  overflow: auto;
  flex: 1 1 0;
  min-height: 100px;
  background: var(--campus-paper, #fcfdff);
  overscroll-behavior: contain;
}
.itinerary-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
}
.itinerary-row + .itinerary-row {
  border-top: 1px solid var(--campus-line, #d5deeb);
}
.date-marker {
  display: grid;
  text-align: center;
  gap: 3px;
  border-right: 1px solid var(--campus-line, #d5deeb);
  padding-right: 24px;
  font-family: ui-monospace, monospace;
}
.date-marker strong {
  font-size: 30px;
  font-weight: 500;
}
.date-marker span {
  font-size: 11px;
}
.lesson-detail h2 {
  font-size: 16px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.participant-label {
  font: 12px var(--campus-body-font, "Segoe UI", sans-serif);
}
.participant-divider {
  margin: 0 8px;
  color: var(--campus-blue, #5378b5);
}
.lesson-time {
  margin-top: 4px;
  font:
    12px/1.6 ui-monospace,
    monospace;
}
.duration {
  font-size: 12px;
  margin-top: 4px;
}
.lesson-status {
  padding: 7px 12px;
  border-radius: 6px;
  background: var(--campus-mist, #eaf0f7);
  font-size: 12px;
  white-space: nowrap;
}
.lesson-status.pending {
  color: var(--campus-coral, #c86454);
  border: 1px solid currentColor;
  background: transparent;
}
.lesson-status.confirmed {
  border-left: 3px solid var(--campus-blue, #5378b5);
}
.itinerary-empty {
  padding: 56px 24px;
  background: var(--campus-paper, #fcfdff);
  border: 1px dashed var(--campus-line, #d5deeb);
  border-radius: 16px;
  text-align: center;
}
.itinerary-empty h2 {
  font-size: 22px;
  margin-bottom: 12px;
}
.itinerary-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  background: transparent;
  padding: 0;
  gap: 10px;
}
.itinerary-pagination span {
  font-size: 12px;
  margin: 0;
}
.itinerary-pagination button {
  background: var(--campus-paper, #fcfdff);
  border-color: var(--campus-line, #d5deeb);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.itinerary-list:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: -3px;
}
@media (max-width: 760px) {
  .campus-lessons {
    gap: 8px;
  }
  h1 {
    font-size: 18px;
  }
  .itinerary-heading {
    align-items: center;
  }
  .itinerary-heading button {
    padding: 10px;
    font-size: 13px;
  }
  .itinerary-toolbar {
    align-items: stretch;
    gap: 6px;
  }
  nav {
    width: auto;
    flex: 1 1 auto;
  }
  nav button {
    flex: 1 1 auto;
    padding: 8px 6px;
    font-size: 12px;
  }
  input {
    width: 100%;
    padding: 8px 12px;
    min-height: 40px;
  }
  .itinerary-row {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 6px 12px;
    padding: 10px 12px;
  }
  .date-marker {
    padding-right: 10px;
  }
  .date-marker strong {
    font-size: 22px;
  }
  .lesson-status {
    grid-column: 2;
    justify-self: start;
    padding: 4px 8px;
    font-size: 11px;
  }
  .lesson-detail h2 {
    font-size: 14px;
  }
  .itinerary-pagination {
    flex: 0 0 auto;
  }
  .itinerary-pagination button {
    flex: 0 0 auto;
    min-width: 80px;
  }
}
</style>
