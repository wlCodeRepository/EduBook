<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { BlockedPeriod } from "../lib/types";
const props = defineProps<{
  minutes: number;
  blocked: BlockedPeriod[];
  timezone: string;
  language: string;
  busy: boolean;
  draft: { start: string; end: string; reason: string };
}>();
const emit = defineEmits<{
  save: [minutes: number];
  add: [draft: { start: string; end: string; reason: string }];
  remove: [id: string];
}>();
const section = ref<"length" | "blocked">(props.draft.start ? "blocked" : "length");
const adding = ref(Boolean(props.draft.start));
const page = ref(0);
const pages = computed(() => Math.max(1, Math.ceil(props.blocked.length / 3)));
const visibleBlocked = computed(() =>
  props.blocked.slice(page.value * 3, page.value * 3 + 3),
);
watch(pages, (n) => (page.value = Math.min(page.value, n - 1)));

const draft = ref({ ...props.draft });
watch(
  () => props.draft,
  (v) => {
    draft.value = { ...v };
    if (v.start) { section.value = 'blocked'; adding.value = true; }
    else { adding.value = false; }
  },
  { deep: true },
);
const zh = computed(() => props.language === "zh");
function date(v: string) {
  return new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: props.timezone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(v));
}
</script>
<template>
  <section class="campus-settings">
    <div class="campus-policy">
      <span aria-hidden="true">◷</span>
      <div>
        <h2>
          {{ zh ? "开放时间，由你掌握" : "An open door. On your terms." }}
        </h2>
        <p>
          {{
            zh
              ? "默认可预约。已有待确认或已确认课程、以及你设置的禁约时间不可预约。"
              : "Available by default. Pending lessons, confirmed lessons and your blocked periods reserve the time."
          }}
        </p>
      </div>
    </div>
    <nav class="settings-tabs" aria-label="Settings">
      <button
        type="button"
        :aria-pressed="section === 'length'"
        @click="section = 'length'"
      >
        {{ zh ? "课程时长" : "Lesson length" }}</button
      ><button
        type="button"
        :aria-pressed="section === 'blocked'"
        @click="section = 'blocked'"
      >
        {{ zh ? "禁约时间" : "Blocked time" }} · {{ blocked.length }}
      </button>
    </nav>
    <div class="campus-settings-grid" v-if="section === 'length'">
      <section class="campus-surface">
        <p class="eyebrow">{{ zh ? "课程单位" : "LESSON UNIT" }}</p>
        <h2>{{ zh ? "一节课，多长时间？" : "How long is one lesson?" }}</h2>
        <p>
          {{
            zh
              ? "学生可一次预约1–8节。历史预约保持原时间。"
              : "Students can book 1–8 lessons in one request. Existing bookings keep their original times."
          }}
        </p>
        <div class="campus-duration-example"><strong>50 min</strong><span>{{zh?'每节课程，统一时长':'Every lesson. One standard length.'}}</span></div><p>{{zh?'按老师时区整点开始，课间休息10分钟。连约两节：09:00–09:50、10:00–10:50。':'Starts on the hour in teacher time, with 10 minutes between lessons. Two lessons: 09:00–09:50 and 10:00–10:50.'}}</p>
      </section>
    </div>
    <div v-else class="settings-blocked">
      <section v-if="adding" class="campus-surface">
        <button type="button" class="outline-button" @click="adding = false">
          {{ zh ? "返回列表" : "Back to list" }}
        </button>
        <p class="eyebrow">{{ zh ? "留给自己的时间" : "TIME FOR YOU" }}</p>
        <h2>{{ zh ? "新增不可预约时间" : "Block some time" }}</h2>
        <p>
          {{ timezone }} ·
          {{
            zh
              ? "可跨天设置，不会取消已有课程。"
              : "Can span multiple days. Existing lessons are not cancelled."
          }}
        </p>
        <form @submit.prevent="emit('add', { ...draft })">
          <fieldset :disabled="busy">
            <label
              >{{ zh ? "开始时间" : "Start time"
              }}<input
                v-model="draft.start"
                type="datetime-local"
                step="900"
                required /></label
            ><label
              >{{ zh ? "结束时间" : "End time"
              }}<input
                v-model="draft.end"
                type="datetime-local"
                step="900"
                :min="draft.start"
                required /></label
            ><label
              >{{ zh ? "备注（可选）" : "Note (optional)"
              }}<input v-model="draft.reason" maxlength="500" /></label
            ><button class="primary-button">
              {{ zh ? "添加禁约时段" : "Add blocked time" }}
            </button>
          </fieldset>
        </form>
      </section>
      <section v-else class="campus-surface">
        <button type="button" class="primary-button" @click="adding = true">
          {{ zh ? "新增禁约时间" : "Block some time" }}
        </button>
        <div class="campus-section-heading">
          <h2>{{ zh ? "已保护的时间" : "Your blocked time" }}</h2>
          <span>{{ blocked.length }}</span>
        </div>
        <div v-if="!blocked.length" class="campus-empty">
          {{
            zh
              ? "尚未设置禁约时间。没有课程占用的未来时间可被预约。"
              : "No blocked time yet. Future time without a lesson is available to book."
          }}
        </div>
        <article
          v-for="period in visibleBlocked"
          :key="period.id"
          class="campus-block-row"
        >
          <span aria-hidden="true">◷</span>
          <div>
            <strong
              >{{ date(period.start_at_utc) }} —
              {{ date(period.end_at_utc) }}</strong
            >
            <p>{{ period.reason || (zh ? "个人安排" : "Personal time") }}</p>
          </div>
          <button
            class="outline-button"
            :disabled="busy"
            @click="emit('remove', period.id)"
          >
            {{ zh ? "解除禁约" : "Unblock" }}
          </button>
        </article>
        <nav v-if="pages > 1" class="settings-tabs" aria-label="Pagination">
          <button :disabled="page === 0" @click="page--">
            {{ zh ? "上一页" : "Previous" }}</button
          ><span>{{ page + 1 }} / {{ pages }}</span
          ><button :disabled="page + 1 === pages" @click="page++">
            {{ zh ? "下一页" : "Next" }}
          </button>
        </nav>
      </section>
    </div>
  </section>
</template>
<style scoped>
.campus-settings {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}
.settings-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.settings-tabs button {
  border: 1px solid var(--campus-line);
  border-radius: 12px;
  padding: 10px 16px;
  min-height: 44px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.settings-tabs button[aria-pressed="true"] {
  background: var(--campus-ink);
  color: white;
}
.campus-settings-grid,
.settings-blocked {
  min-height: 0;
  overflow: auto;
  display: block;
  flex: 1;
}
.campus-surface {
  max-width: 720px;
  margin: 0 auto;
}
.campus-duration-example {
  margin: 12px 0;
}
@media (max-width: 700px) {
  .campus-settings {
    gap: 8px;
  }
  .campus-policy p {
    margin: 4px 0;
  }
  .campus-surface {
    padding: 12px;
  }
  .campus-surface > p {
    font-size: 12px;
  }
  .campus-policy h2 {
    font-size: 17px;
  }
  .campus-block-row {
    flex-wrap: wrap;
  }
}
</style>
