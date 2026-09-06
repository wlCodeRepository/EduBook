<script setup lang="ts">
import { computed, ref } from "vue";
import {
  campusDuration,
  useCampusClock,
  useCampusPagination,
} from "../lib/campus-teaching";
import type { Booking } from "../lib/types";
import {
  bookingDisplayStatus,
  bookingGroup,
  type BookingGroup,
} from "../lib/booking-groups";
const props = defineProps<{
  bookings: Booking[];
  timezone: string;
  language: string;
  loading?: boolean;
  error?: string;
  busy?: boolean;
}>();
const emit = defineEmits<{
  action: [id: string, action: "confirm" | "reject" | "cancel"];
}>();
const tab = ref<BookingGroup>("pending");
const search = ref("");
const now = useCampusClock();
const zh = computed(() => props.language === "zh");
const tabs = computed(() => [
  { value: "pending" as const, label: zh.value ? "待处理" : "Pending" },
  { value: "upcoming" as const, label: zh.value ? "已确认" : "Confirmed" },
  { value: "history" as const, label: zh.value ? "历史记录" : "History" },
]);
const visible = computed(() =>
  props.bookings
    .filter(
      (b) =>
        bookingGroup(b, now.value) === tab.value &&
        (b.student?.display_name || "")
          .toLowerCase()
          .includes(search.value.trim().toLowerCase()),
    )
    .sort((a, b) =>
      tab.value === "history"
        ? b.start_at_utc.localeCompare(a.start_at_utc)
        : a.start_at_utc.localeCompare(b.start_at_utc),
    ),
);
const { page, pageCount, pageItems } = useCampusPagination(visible, [
  tab,
  search,
]);
function act(booking: Booking, action: "confirm" | "reject" | "cancel") {
  if (props.loading || props.busy || props.error) return;
  const group = bookingGroup(booking, new Date());
  if (
    group === "history" ||
    (action === "cancel" ? group !== "upcoming" : group !== "pending")
  )
    return;
  emit("action", booking.id, action);
}
function time(value: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: props.timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
function status(b: Booking) {
  const value = bookingDisplayStatus(b, now.value);
  return {
    PENDING: zh.value ? "待确认" : "Pending",
    CONFIRMED: zh.value ? "已确认" : "Confirmed",
    COMPLETED: zh.value ? "已结束" : "Ended",
    CANCELLED: zh.value ? "已取消" : "Cancelled",
    REJECTED: zh.value ? "已拒绝" : "Declined",
    EXPIRED: zh.value ? "已过期" : "Expired",
  }[value];
}
</script>
<template>
  <section class="request-workspace" :aria-busy="!!(loading || busy)">
    <header class="inbox-heading">
      <div>
        <h1>{{ zh ? "预约收件箱" : "Request inbox" }}</h1>
        <p>
          {{
            zh
              ? "核对学生与时段，再确认或拒绝请求。"
              : "Review the student and time, then confirm or decline."
          }}
        </p>
      </div>
      <small>{{ timezone }}</small>
    </header>
    <div class="request-toolbar">
      <nav
        class="queue-tabs"
        :aria-label="zh ? '预约分类' : 'Booking categories'"
      >
        <button
          v-for="item in tabs"
          :key="item.value"
          type="button"
          :aria-pressed="tab === item.value"
          @click="tab = item.value"
        >
          {{ item.label
          }}<span>{{
            bookings.filter((b) => bookingGroup(b, now) === item.value).length
          }}</span>
        </button>
      </nav>
      <input
        v-model="search"
        type="search"
        :aria-label="zh ? '搜索学生' : 'Search students'"
        :placeholder="zh ? '搜索学生姓名' : 'Search students'"
      />
    </div>
    <p v-if="loading" class="queue-empty" role="status">
      {{ zh ? "正在加载预约…" : "Loading bookings…" }}
    </p>
    <p v-else-if="error" class="queue-empty" role="alert">
      {{
        zh
          ? "预约加载失败，请使用上方重试按钮。"
          : "Bookings could not be loaded. Use Retry above."
      }}
    </p>
    <template v-else>
      <div class="request-table-heading">
        <span>{{ zh ? "学生 / 课程时间" : "Student / lesson time" }}</span
        ><span>{{ timezone }}</span>
      </div>
      <p v-if="busy" role="status" class="busy-note">
        {{ zh ? "正在保存，请稍候…" : "Saving your decision…" }}
      </p>
      <div
        class="request-list"
        tabindex="0"
        :aria-label="zh ? '预约列表' : 'Booking list'"
      >
        <article
          v-for="booking in pageItems"
          :key="booking.id"
          class="request-row"
        >
          <span class="request-avatar" aria-hidden="true">{{
            (booking.student?.display_name || "S").slice(0, 2)
          }}</span>
          <div class="request-person">
            <strong>{{
              booking.student?.display_name || (zh ? "学生" : "Student")
            }}</strong
            ><small
              >{{ time(booking.start_at_utc) }} —
              {{ time(booking.end_at_utc) }}</small
            >
            <small>{{ campusDuration(booking, language) }}</small>
          </div>
          <span
            class="request-status"
            :class="bookingDisplayStatus(booking, now).toLowerCase()"
            >{{ status(booking) }}</span
          >
          <div class="row-actions" v-if="tab !== 'history'">
            <template v-if="tab === 'pending'"
              ><button
                type="button"
                class="decision-button"
                :disabled="busy"
                @click="act(booking, 'confirm')"
              >
                {{ zh ? "确认预约" : "Confirm" }}</button
              ><button
                type="button"
                class="decision-button secondary"
                :disabled="busy"
                @click="act(booking, 'reject')"
              >
                {{ zh ? "拒绝" : "Decline" }}
              </button></template
            ><button
              v-else
              type="button"
              class="decision-button secondary"
              :disabled="busy"
              @click="act(booking, 'cancel')"
            >
              {{ zh ? "取消预约" : "Cancel" }}
            </button>
          </div>
        </article>
        <div v-if="!visible.length" class="queue-empty" role="status">
          <h3>
            {{
              search
                ? zh
                  ? "没有匹配的学生"
                  : "No matching students"
                : tab === "pending"
                  ? zh
                    ? "没有待处理的预约"
                    : "You’re all caught up"
                  : zh
                    ? "此分类暂无课程"
                    : "No lessons in this category"
            }}
          </h3>
          <p>
            {{
              zh
                ? "切换上方分类查看已确认课程和历史记录。"
                : "Use the tabs above to view confirmed lessons and history."
            }}
          </p>
        </div>
      </div>
      <nav
        v-if="visible.length"
        class="inbox-pagination"
        :aria-label="zh ? '预约分页' : 'Booking pages'"
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
          {{ zh ? "项" : "bookings" }}</span
        ><button
          type="button"
          data-page="next"
          :disabled="page === pageCount"
          @click="page++"
        >
          {{ zh ? "下一页" : "Next" }}
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.request-workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  max-height: var(--campus-stage-height, calc(100dvh - 150px));
  min-height: 0;
  min-width: 0;
  overflow: auto;
  overscroll-behavior: contain;
  color: var(--campus-ink, #233957);
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
}
.inbox-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: 0 0 auto;
}
.inbox-heading h1 {
  font: 600 22px var(--campus-display-font, "Trebuchet MS", sans-serif);
  margin: 0 0 4px;
}
.inbox-heading p,
.inbox-heading small {
  font-size: 12px;
  margin: 0;
}
.request-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0;
  flex: 0 0 auto;
}
.queue-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  background: var(--campus-mist, #eaf0f7);
  padding: 4px;
  border-radius: 10px;
  margin: 0;
  border: 0;
}
button,
input {
  font: inherit;
  color: inherit;
  min-height: 44px;
  box-sizing: border-box;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--campus-paper, #fcfdff);
}
button {
  cursor: pointer;
}
button:disabled {
  cursor: default;
  opacity: 0.45;
}
button:focus-visible,
input:focus-visible,
.request-list:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: -3px;
}
.queue-tabs button {
  background: transparent;
  color: var(--campus-ink, #233957);
  border: 1px solid transparent;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 7px;
}
.queue-tabs button[aria-pressed="true"] {
  background: var(--campus-paper, #fcfdff);
  color: var(--campus-ink, #233957);
  border-color: var(--campus-line, #d5deeb);
}
.queue-tabs button span {
  padding: 0;
  margin-left: 7px;
  background: transparent;
  color: inherit;
  font:
    12px ui-monospace,
    monospace;
}
.request-toolbar input {
  width: min(100%, 260px);
}
.request-table-heading {
  display: flex;
  justify-content: space-between;
  border: 0;
  padding: 0 14px;
  margin: 0;
  font-size: 12px;
  color: inherit;
  flex: 0 0 auto;
}
.request-list {
  flex: 1 1 0;
  min-height: 100px;
  overflow: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 12px;
  background: var(--campus-paper, #fcfdff);
}
.request-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
  margin: 0;
  background: transparent;
}
.request-row:last-child {
  border-bottom: 0;
}
.request-avatar {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--campus-mist, #eaf0f7);
  font-size: 13px;
}
.request-person {
  display: grid;
  gap: 4px;
  min-width: 0;
  grid-column: auto;
}
.request-person strong {
  font-size: 15px;
  color: inherit;
  overflow-wrap: anywhere;
}
.request-person small {
  font-size: 12px;
  color: inherit;
  line-height: 1.5;
}
.request-status {
  font-size: 12px;
  border-left: 3px solid var(--campus-line, #d5deeb);
  padding: 5px 8px;
  white-space: nowrap;
}
.request-status.pending {
  border-color: var(--campus-coral, #c86454);
}
.request-status.confirmed {
  border-color: var(--campus-blue, #5378b5);
}
.request-row .row-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
  grid-column: auto;
}
.decision-button {
  background: var(--campus-ink, #233957);
  color: var(--campus-paper, #fcfdff);
  border-color: var(--campus-ink, #233957);
  font-size: 13px;
}
.decision-button.secondary {
  background: transparent;
  color: var(--campus-ink, #233957);
  border-color: var(--campus-line, #d5deeb);
}
.queue-empty {
  text-align: center;
  padding: 30px 20px;
  color: inherit;
}
.queue-empty h3 {
  font: 600 20px var(--campus-display-font, "Trebuchet MS", sans-serif);
  margin: 0 0 8px;
  color: inherit;
}
.queue-empty p {
  font-size: 13px;
  color: inherit;
}
.busy-note {
  font-size: 13px;
  margin: 0;
  color: var(--campus-blue, #5378b5);
}
.inbox-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
}
.inbox-pagination span {
  font:
    12px ui-monospace,
    monospace;
}
.inbox-pagination button {
  font-size: 13px;
}
@media (max-width: 760px) {
  .request-workspace {
    gap: 8px;
  }
  .inbox-heading h1 {
    font-size: 18px;
  }
  .inbox-heading p {
    display: none;
  }
  .inbox-heading small {
    max-width: 130px;
    overflow-wrap: anywhere;
  }
  .request-toolbar {
    gap: 6px;
    flex-direction: column;
    align-items: stretch;
  }
  .queue-tabs {
    width: auto;
    overflow: visible;
  }
  .queue-tabs button {
    flex: 1;
    padding: 8px;
  }
  .request-toolbar input {
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
  }
  .request-table-heading {
    display: none;
  }
  .request-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    padding: 10px 12px;
  }
  .request-avatar {
    display: none;
  }
  .request-row .row-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
  .request-person strong {
    font-size: 14px;
  }
  .request-person small {
    font-size: 11px;
  }
  .decision-button {
    padding: 8px 12px;
  }
  .request-status {
    font-size: 11px;
  }
}
</style>
