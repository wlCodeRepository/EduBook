import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { bookingDisplayStatus } from "./booking-groups";
import type { AdminBooking, Booking } from "./types";

export type CampusBooking = Booking | AdminBooking;

/** Matches the scoped mobile layout and releases the media listener when leaving a stage. */
export function useCampusMobile() {
  const mobile = ref(false);
  let media: MediaQueryList | undefined;
  const update = () => {
    mobile.value = !!media?.matches;
  };
  onMounted(() => {
    if (typeof window.matchMedia !== "function") return;
    media = window.matchMedia("(max-width: 760px)");
    update();
    media.addEventListener("change", update);
  });
  onBeforeUnmount(() => media?.removeEventListener("change", update));
  return mobile;
}

/** Keep dense records inside the stage; data refreshes clamp the current page. */
export function useCampusPagination<T>(
  items: Ref<T[]>,
  filters: Ref<unknown>[],
) {
  const mobile = useCampusMobile();
  const page = ref(1);
  const pageSize = computed(() => (mobile.value ? 2 : 4));
  const pageCount = computed(() =>
    Math.max(1, Math.ceil(items.value.length / pageSize.value)),
  );
  watch(
    [...filters, pageSize],
    () => {
      page.value = 1;
    },
    { flush: "sync" },
  );
  watch(
    pageCount,
    (count) => {
      page.value = Math.min(page.value, count);
    },
    { flush: "sync" },
  );
  const pageItems = computed(() =>
    items.value.slice(
      (page.value - 1) * pageSize.value,
      page.value * pageSize.value,
    ),
  );
  return { page, pageCount, pageItems };
}

/** Presentation clock: ended requests must leave actionable lanes while the page is open. */
export function useCampusClock() {
  const now = ref(new Date());
  let timer: ReturnType<typeof setInterval> | undefined;
  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date();
    }, 30000);
  });
  onBeforeUnmount(() => clearInterval(timer));
  return now;
}

export function campusTime(value: string, timezone: string, language: string) {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

/** Use the booking snapshot, never the teacher's current default. Legacy rows use elapsed duration. */
export function campusDuration(booking: CampusBooking, language: string) {
  const zh = language === "zh";
  const elapsed = Math.round(
    (Date.parse(booking.end_at_utc) - Date.parse(booking.start_at_utc)) / 60000,
  );
  if (booking.lesson_count && booking.lesson_minutes) {
    if (booking.break_minutes) return zh ? `${booking.lesson_count} 节 · 每节50分钟 · 课间10分钟 · 总时段${elapsed}分钟` : `${booking.lesson_count} lessons · 50 min each · 10 min between · ${elapsed} min reserved`;
    return zh
      ? `${booking.lesson_count} 节 · ${booking.lesson_minutes} 分钟/节 · ${booking.lesson_count * booking.lesson_minutes} 分钟`
      : `${booking.lesson_count} lessons · ${booking.lesson_minutes} min each · ${booking.lesson_count * booking.lesson_minutes} min`;
  }
  return `${elapsed} ${zh ? "分钟" : "min"}`;
}

export function campusStatus(
  booking: CampusBooking,
  now: Date,
  language: string,
) {
  const labels = {
    PENDING: ["待确认", "Pending"],
    CONFIRMED: ["已确认", "Confirmed"],
    COMPLETED: ["已结束", "Ended"],
    CANCELLED: ["已取消", "Cancelled"],
    REJECTED: ["已拒绝", "Declined"],
    EXPIRED: ["已过期", "Expired"],
  };
  return labels[bookingDisplayStatus(booking, now)][language === "zh" ? 0 : 1];
}
