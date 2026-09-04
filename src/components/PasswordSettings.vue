<script setup lang="ts">
import { ref, watch } from "vue";
import { supabase } from "../lib/supabase";
defineProps<{ language: string }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const password = ref("");
const confirmation = ref("");
const saving = ref(false);
watch(saving, (value) => emit("busy", value), { flush: "sync" });
const status = ref<"idle" | "mismatch" | "invalid" | "error" | "success">(
  "idle",
);
async function save() {
  if (saving.value) return;
  if (password.value.length < 8 || password.value.length > 128) {
    status.value = "invalid";
    return;
  }
  if (password.value !== confirmation.value) {
    status.value = "mismatch";
    return;
  }
  saving.value = true;
  status.value = "idle";
  try {
    const { error } = await supabase.auth.updateUser({
      password: password.value,
    });
    if (error) throw error;
    password.value = confirmation.value = "";
    status.value = "success";
  } catch {
    status.value = "error";
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <form class="panel profile-form password-settings" @submit.prevent="save">
    <div class="panel-heading">
      <h3>{{ language === "zh" ? "修改密码" : "Change password" }}</h3>
    </div>
    <label
      >{{
        language === "zh"
          ? "新密码（8–128 位）"
          : "New password (8–128 characters)"
      }}<input
        v-model="password"
        type="password"
        autocomplete="new-password"
        minlength="8"
        maxlength="128"
        required
        :disabled="saving"
    /></label>
    <label
      >{{ language === "zh" ? "确认新密码" : "Confirm new password"
      }}<input
        v-model="confirmation"
        type="password"
        autocomplete="new-password"
        required
        :disabled="saving"
    /></label>
    <p
      v-if="status !== 'idle'"
      role="status"
      :class="{ 'field-error': status !== 'success' }"
    >
      {{
        {
          mismatch:
            language === "zh" ? "两次密码不一致。" : "Passwords do not match.",
          invalid:
            language === "zh"
              ? "密码长度必须为 8–128 位。"
              : "Use 8–128 characters.",
          error:
            language === "zh"
              ? "密码未修改，请检查网络和登录状态后重试。"
              : "Password was not changed. Check your connection and sign-in session, then retry.",
          success:
            language === "zh"
              ? "密码已修改，下次登录请使用新密码。"
              : "Password changed. Use the new password next time you sign in.",
        }[status]
      }}
    </p>
    <button class="primary-button" :disabled="saving">
      {{
        language === "zh"
          ? saving
            ? "保存中…"
            : "修改密码"
          : saving
            ? "Saving…"
            : "Change password"
      }}
    </button>
  </form>
</template>
