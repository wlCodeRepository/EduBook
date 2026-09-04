<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
}>();
const emit = defineEmits<{
  action: [id: string, action: "confirm" | "reject" | "cancel"];
}>();
const tab = ref<BookingGroup>("pending");
const search = ref("");
const now = ref(new Date());
let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date();
  }, 30000);
});
onBeforeUnmount(() => clearInterval(timer));
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
  <section class="request-workspace">
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
      <article v-for="booking in visible" :key="booking.id" class="request-row">
        <span class="avatar avatar-teal">{{
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
        </div>
        <span
          class="status-pill"
          :class="bookingDisplayStatus(booking, now).toLowerCase()"
          >{{ status(booking) }}</span
        >
        <div class="row-actions" v-if="tab !== 'history'">
          <template v-if="tab === 'pending'"
            ><button
              class="mini-button"
              @click="emit('action', booking.id, 'confirm')"
            >
              {{ zh ? "确认预约" : "Confirm" }}</button
            ><button
              class="mini-button ghost"
              @click="emit('action', booking.id, 'reject')"
            >
              {{ zh ? "拒绝" : "Decline" }}
            </button></template
          ><button
            v-else
            class="mini-button ghost"
            @click="emit('action', booking.id, 'cancel')"
          >
            {{ zh ? "取消预约" : "Cancel" }}
          </button>
        </div>
      </article>
      <div v-if="!visible.length" class="queue-empty">
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
    </template>
  </section>
</template>
