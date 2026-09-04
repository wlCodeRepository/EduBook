<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
defineProps<{
  displayName: string;
  username?: string | null;
  roleLabel: string;
  language: string;
}>();
const emit = defineEmits<{
  open: [section: "profile" | "password"];
  signout: [];
}>();
const opened = ref(false);
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
function close(restore = false) {
  opened.value = false;
  document.removeEventListener("pointerdown", outside);
  if (restore) trigger.value?.focus();
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) close();
}
async function toggle() {
  if (opened.value) {
    close();
    return;
  }
  opened.value = true;
  document.addEventListener("pointerdown", outside);
  await nextTick();
  root.value?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
}
function select(section: "profile" | "password") {
  close(true);
  emit("open", section);
}
function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close(true);
  }
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const items = Array.from(
      root.value?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") || [],
    );
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length;
    items[index]?.focus();
  }
}
function focusout(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node)) close();
}
onBeforeUnmount(() => close());
</script>
<template>
  <div ref="root" class="account-anchor" @focusout="focusout">
    <button
      ref="trigger"
      class="account-trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="opened"
      :aria-label="language === 'zh' ? '打开个人菜单' : 'Open account menu'"
      @click="toggle"
    >
      <span class="avatar avatar-user">{{
        displayName.slice(0, 2).toUpperCase()
      }}</span>
      <span class="account-identity"
        ><strong>{{ displayName }}</strong
        ><small>{{ roleLabel }}</small></span
      >
    </button>
    <div
      v-if="opened"
      class="account-popover"
      role="menu"
      :aria-label="language === 'zh' ? '我的账号' : 'My account'"
      @keydown="keydown"
    >
      <div class="account-caption">
        <strong>{{ displayName }}</strong
        ><small>@{{ username || "—" }}</small>
      </div>
      <button
        type="button"
        role="menuitem"
        data-action="profile"
        @click="select('profile')"
      >
        {{ language === "zh" ? "个人资料" : "Personal information" }}
      </button>
      <button
        type="button"
        role="menuitem"
        data-action="password"
        @click="select('password')"
      >
        {{ language === "zh" ? "修改密码" : "Change password" }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="account-signout"
        @click="
          close();
          emit('signout');
        "
      >
        {{ language === "zh" ? "退出登录" : "Sign out" }}
      </button>
    </div>
  </div>
</template>
