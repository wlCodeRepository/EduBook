<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Profile } from "../lib/types";
import { supabase } from "../lib/supabase";
import AppSelect from "./AppSelect.vue";
import PasswordSettings from "./PasswordSettings.vue";
const props = defineProps<{
  profile: Profile;
  section: "profile" | "password";
  language: string;
  zones: { value: string; label: string }[];
}>();
const emit = defineEmits<{ close: []; updated: [profile: Profile] }>();
const section = ref(props.section);
const dialog = ref<HTMLDialogElement>();
const saving = ref(false);
const passwordBusy = ref(false);
const message = ref<"saved" | "error" | null>(null);
const name = ref(props.profile.display_name);
const timezone = ref(props.profile.timezone);
const locked = computed(() => saving.value || passwordBusy.value);
const zh = computed(() => props.language === "zh");
const role = computed(() =>
  props.profile.role === "ADMIN"
    ? zh.value
      ? "管理员"
      : "Administrator"
    : props.profile.role === "TEACHER"
      ? zh.value
        ? "老师"
        : "Teacher"
      : zh.value
        ? "学生"
        : "Student",
);
let previousOverflow = "";
let previousFocus: HTMLElement | null = null;
onMounted(() => {
  previousFocus = document.activeElement as HTMLElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  document.body.style.overflow = previousOverflow;
  previousFocus?.focus();
});
function close() {
  if (!locked.value) emit("close");
}
async function save() {
  if (saving.value || !name.value.trim()) return;
  saving.value = true;
  message.value = null;
  try {
    const { data, error } = await supabase.rpc("update_my_profile", {
      p_display_name: name.value.trim(),
      p_timezone: timezone.value,
      p_default_lesson_minutes: props.profile.default_lesson_minutes,
    });
    if (error || !data) throw error || new Error("Missing profile");
    emit("updated", data as Profile);
    message.value = "saved";
  } catch {
    message.value = "error";
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <dialog
    ref="dialog"
    class="account-dialog"
    aria-labelledby="account-title"
    @cancel.prevent="close"
  >
    <header class="account-dialog-heading">
      <div>
        <h2 id="account-title">{{ zh ? "账号设置" : "Account settings" }}</h2>
        <p>{{ profile.display_name }} · @{{ profile.username }}</p>
      </div>
      <button
        type="button"
        class="outline-button"
        :disabled="locked"
        @click="close"
      >
        {{ zh ? "关闭" : "Close" }}
      </button>
    </header>
    <nav
      class="account-tabs"
      :aria-label="zh ? '账号设置分类' : 'Account settings sections'"
    >
      <button
        type="button"
        :aria-pressed="section === 'profile'"
        :disabled="locked"
        @click="section = 'profile'"
      >
        {{ zh ? "个人资料" : "Profile" }}
      </button>
      <button
        type="button"
        :aria-pressed="section === 'password'"
        :disabled="locked"
        @click="section = 'password'"
      >
        {{ zh ? "密码与安全" : "Password & security" }}
      </button>
    </nav>
    <form
      v-if="section === 'profile'"
      class="account-details-form"
      @submit.prevent="save"
    >
      <div class="account-readonly">
        <div>
          <span>{{ zh ? "登录账号" : "Username" }}</span
          ><strong>{{ profile.username }}</strong>
        </div>
        <div>
          <span>{{ zh ? "角色" : "Role" }}</span
          ><strong>{{ role }}</strong>
        </div>
      </div>
      <p class="field-hint">
        {{
          zh
            ? "账号与角色在创建后不可修改。"
            : "Username and role are fixed at account creation."
        }}
      </p>
      <label
        >{{ zh ? "显示名称" : "Display name"
        }}<input
          v-model="name"
          required
          maxlength="120"
          :disabled="saving"
          autocomplete="name"
      /></label>
      <label
        >{{ zh ? "显示时区" : "Display timezone"
        }}<AppSelect
          v-model="timezone"
          :options="zones"
          :label="zh ? '搜索时区' : 'Search timezone'"
          searchable
          :empty-label="zh ? '无匹配结果' : 'No matches'"
      /></label>
      <p class="field-hint">
        {{
          zh
            ? "课程时间将按此时区显示。课程时长请在课程设置中调整。"
            : "Lesson times use this timezone. Teachers can adjust lesson duration in lesson settings."
        }}
      </p>
      <p
        v-if="message"
        role="status"
        :class="{ 'field-error': message === 'error' }"
      >
        {{
          message === "saved"
            ? zh
              ? "个人资料已保存。"
              : "Profile saved."
            : zh
              ? "保存失败，请重试。"
              : "Could not save your profile. Please retry."
        }}
      </p>
      <footer>
        <button class="primary-button" :disabled="saving || !name.trim()">
          {{
            zh
              ? saving
                ? "保存中…"
                : "保存修改"
              : saving
                ? "Saving…"
                : "Save changes"
          }}
        </button>
      </footer>
    </form>
    <PasswordSettings
      v-else
      :language="language"
      @busy="passwordBusy = $event"
    />
  </dialog>
</template>
