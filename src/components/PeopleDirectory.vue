<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import AppSelect from "./AppSelect.vue";
import type { AdminUser } from "../lib/types";

const props = defineProps<{
  users: AdminUser[];
  currentUserId: string;
  language: string;
  busy?: boolean;
  loading?: boolean;
}>();
const emit = defineEmits<{
  create: [];
  edit: [user: AdminUser];
  reset: [user: AdminUser];
  delete: [user: AdminUser];
}>();
const zh = computed(() => props.language.startsWith("zh"));
const query = ref("");
const role = ref("ALL");
const page = ref(1);
const selectedId = ref("");
const showDetail = ref(false);
const room = ref<HTMLElement>();
const backButton = ref<HTMLButtonElement>();
const mobile = ref(false);
let media: MediaQueryList | undefined;
function resize() {
  mobile.value = media?.matches ?? false;
}
onMounted(() => {
  if (typeof window.matchMedia !== "function") return;
  media = window.matchMedia("(max-width: 640px)");
  resize();
  media.addEventListener("change", resize);
});
onBeforeUnmount(() => media?.removeEventListener("change", resize));
const pageSize = computed(() => (mobile.value ? 4 : 6));
const filtered = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  return props.users.filter(
    (user) =>
      user.id !== props.currentUserId &&
      user.role !== "ADMIN" &&
      (role.value === "ALL" || user.role === role.value) &&
      `${user.display_name} ${user.username ?? ""}`
        .toLocaleLowerCase()
        .includes(needle),
  );
});
const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / pageSize.value)),
);
watch([query, role, pageSize], () => {
  page.value = 1;
  showDetail.value = false;
});
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count);
});
const visible = computed(() =>
  filtered.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value,
  ),
);
const selected = computed(
  () =>
    visible.value.find((user) => user.id === selectedId.value) ??
    visible.value[0],
);
// Task 2: bounded master/detail; six desktop rows, four mobile rows.
// The parent owns all writes and confirmations. Selection never exposes admins/self.
watch(selected, (user) => {
  if (!user) showDetail.value = false;
});
async function select(user: AdminUser) {
  selectedId.value = user.id;
  showDetail.value = true;
  await nextTick();
  if (mobile.value) backButton.value?.focus();
}
async function back() {
  showDetail.value = false;
  await nextTick();
  room.value
    ?.querySelector<HTMLButtonElement>('.person-select[aria-pressed="true"]')
    ?.focus();
}
function action(kind: "edit" | "reset" | "delete") {
  if (props.busy || props.loading || !selected.value) return;
  if (kind === "edit") emit("edit", selected.value);
  else if (kind === "reset") emit("reset", selected.value);
  else emit("delete", selected.value);
}
function roleName(user: AdminUser) {
  return user.role === "TEACHER"
    ? zh.value
      ? "教师"
      : "Teacher"
    : zh.value
      ? "学生"
      : "Student";
}
</script>

<template>
  <section
    ref="room"
    class="people-room"
    :aria-busy="busy || loading"
    :aria-label="zh ? '人员名册' : 'People directory'"
  >
    <header class="room-toolbar">
      <h2>{{ zh ? "人员名册" : "People directory" }}</h2>
      <button
        type="button"
        data-action="create"
        :disabled="busy || loading"
        @click="emit('create')"
      >
        {{ zh ? "新建账号" : "Create account" }}
      </button>
    </header>
    <p v-if="loading" class="room-state" role="status">
      {{ zh ? "正在加载人员…" : "Loading people…" }}
    </p>
    <div v-else class="directory-layout" :class="{ 'show-detail': showDetail }">
      <div class="roster-pane">
        <div class="roster-filters">
          <label
            ><span>{{ zh ? "搜索人员" : "Search people" }}</span
            ><input
              v-model="query"
              type="search"
              :placeholder="zh ? '姓名或用户名' : 'Name or username'"
              :disabled="busy"
          /></label>
          <fieldset :disabled="busy">
            <legend>{{ zh ? "身份" : "Role" }}</legend>
            <AppSelect
              v-model="role"
              :label="zh ? '身份' : 'Role'"
              :options="[
                { value: 'ALL', label: zh ? '全部' : 'All' },
                { value: 'TEACHER', label: zh ? '教师' : 'Teachers' },
                { value: 'STUDENT', label: zh ? '学生' : 'Students' },
              ]"
            />
          </fieldset>
        </div>
        <div class="roster-list">
          <p v-if="!filtered.length" class="room-state" role="status">
            {{
              zh
                ? "没有符合条件的人员。可调整搜索或新建账号。"
                : "No people found. Adjust your search or create an account."
            }}
          </p>
          <button
            v-for="user in visible"
            :key="user.id"
            type="button"
            class="person-select"
            :aria-pressed="selected?.id === user.id"
            :disabled="busy"
            @click="select(user)"
          >
            <span class="person-avatar" aria-hidden="true">{{
              user.display_name.slice(0, 1)
            }}</span
            ><span class="person-name"
              ><strong>{{ user.display_name }}</strong
              ><small>{{ user.username || "—" }}</small></span
            ><span class="person-role">{{ roleName(user) }}</span
            ><span aria-hidden="true">›</span>
          </button>
        </div>
        <nav class="pagination" :aria-label="zh ? '名册分页' : 'Roster pages'">
          <span
            >{{ filtered.length }} {{ zh ? "人" : "people" }} · {{ page }} /
            {{ pageCount }}</span
          >
          <div>
            <button
              type="button"
              data-action="previous"
              :disabled="busy || page <= 1"
              :aria-label="zh ? '上一页' : 'Previous page'"
              @click="page--"
            >
              ←</button
            ><button
              type="button"
              data-action="next"
              :disabled="busy || page >= pageCount"
              :aria-label="zh ? '下一页' : 'Next page'"
              @click="page++"
            >
              →
            </button>
          </div>
        </nav>
      </div>
      <section
        v-if="selected"
        class="person-detail"
        :aria-label="zh ? '人员详情' : 'Person details'"
      >
        <button
          ref="backButton"
          type="button"
          class="back-button"
          :disabled="busy"
          @click="back"
        >
          ← {{ zh ? "返回名册" : "Back to people" }}
        </button>
        <div class="detail-content">
          <span class="detail-role">{{ roleName(selected) }}</span>
          <h3>{{ selected.display_name }}</h3>
          <dl>
            <div>
              <dt>{{ zh ? "用户名" : "Username" }}</dt>
              <dd>{{ selected.username || "—" }}</dd>
            </div>
            <div>
              <dt>{{ zh ? "时区" : "Timezone" }}</dt>
              <dd>{{ selected.timezone }}</dd>
            </div>
            <div v-if="selected.role === 'TEACHER'">
              <dt>{{ zh ? "每课时长" : "Lesson duration" }}</dt>
              <dd>
                {{ selected.default_lesson_minutes }}
                {{ zh ? "分钟" : "minutes" }}
              </dd>
            </div>
          </dl>
        </div>
        <div class="person-actions">
          <button
            type="button"
            data-action="edit"
            :disabled="busy"
            @click="action('edit')"
          >
            {{ zh ? "编辑资料" : "Edit profile" }}</button
          ><button
            type="button"
            data-action="reset"
            :disabled="busy"
            @click="action('reset')"
          >
            {{ zh ? "重置密码" : "Reset password" }}</button
          ><button
            type="button"
            class="danger"
            data-action="delete"
            :disabled="busy"
            @click="action('delete')"
          >
            {{ zh ? "删除账号" : "Delete account" }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.people-room {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: auto;
  color: var(--campus-ink, #233957);
  background: var(--campus-paper, #fcfdff);
  font-family: var(--campus-body-font, "Segoe UI", sans-serif);
}
.room-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
h2 {
  margin: 0;
  font: 600 20px var(--campus-display-font, "Trebuchet MS", sans-serif);
}
button,
input,
select {
  font: inherit;
  color: inherit;
  border: 1px solid var(--campus-line, #d5deeb);
  border-radius: 8px;
  background: var(--campus-paper, #fcfdff);
  min-height: 40px;
}
button {
  cursor: pointer;
  padding: 8px 12px;
}
button:hover:not(:disabled) {
  background: var(--campus-mist, #eaf0f7);
}
button:disabled,
input:disabled,
select:disabled {
  cursor: default;
  opacity: 0.55;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--campus-blue, #5378b5);
  outline-offset: -3px;
}
.directory-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.85fr);
  min-height: 0;
  min-width: 0;
  overflow: auto;
}
.roster-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}
.roster-filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(85px, 0.4fr);
  gap: 10px;
  padding: 12px 18px;
}
label {
  display: grid;
  gap: 5px;
  min-width: 0;
  font-size: 12px;
}
input,
select {
  padding: 8px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
.roster-list {
  min-height: 0;
  overflow: auto;
  padding: 0 10px;
  overscroll-behavior: contain;
}
.person-select {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  border-color: transparent;
  text-align: start;
  padding: 10px 8px;
  border-radius: 6px;
  border-bottom: 1px solid var(--campus-line, #d5deeb);
}
.person-select[aria-pressed="true"] {
  background: var(--campus-mist, #eaf0f7);
  box-shadow: inset 3px 0 var(--campus-blue, #5378b5);
}
.person-avatar {
  flex: 0 0 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--campus-mist, #eaf0f7);
  font-family: var(--campus-display-font, "Trebuchet MS", sans-serif);
}
.person-name {
  display: grid;
  gap: 3px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.person-name strong {
  font-size: 14px;
}
.person-name small,
.person-role {
  font-size: 12px;
  color: var(--campus-muted, #526780);
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 18px;
  font-size: 12px;
  border-top: 1px solid var(--campus-line, #d5deeb);
}
.pagination > div {
  display: flex;
  gap: 6px;
}
.person-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding: 18px;
  background: var(--campus-mist, #eaf0f7);
  border-left: 1px solid var(--campus-line, #d5deeb);
}
.detail-content {
  flex: 1;
}
.detail-role {
  font-size: 12px;
  color: var(--campus-muted, #526780);
}
h3 {
  margin: 8px 0 18px;
  font: 600 22px var(--campus-display-font, "Trebuchet MS", sans-serif);
  overflow-wrap: anywhere;
}
dl {
  margin: 0;
}
dl > div {
  padding: 10px 0;
  border-top: 1px solid var(--campus-line, #d5deeb);
}
dt {
  font-size: 12px;
  color: var(--campus-muted, #526780);
}
dd {
  margin: 5px 0 0;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.person-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 16px;
}
.person-actions button {
  font-size: 13px;
}
.danger {
  color: var(--campus-coral, #c86454);
}
.back-button {
  display: none;
}
.room-state {
  margin: 0;
  padding: 24px 12px;
  font-size: 14px;
}
@media (max-width: 640px) {
  .room-toolbar {
    padding: 10px 12px;
  }
  h2 {
    font-size: 17px;
  }
  .directory-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .roster-filters {
    padding: 10px 12px;
  }
  .person-detail {
    display: none;
    border-left: 0;
    padding: 12px;
  }
  .show-detail .roster-pane {
    display: none;
  }
  .show-detail .person-detail {
    display: flex;
  }
  .back-button {
    display: block;
    align-self: flex-start;
    margin-bottom: 16px;
  }
  .person-select {
    min-height: 62px;
  }
  .person-actions {
    padding-top: 12px;
  }
  .pagination {
    padding: 8px 12px;
  }
}
</style>
