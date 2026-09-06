<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue";
const props = defineProps<{
  title: string;
  subtitle?: string;
  busy?: boolean;
  language: string;
}>();
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();
let overflow = "";
let focused: HTMLElement | null = null;
function close() {
  if (!props.busy) emit("close");
}
onMounted(() => {
  focused = document.activeElement as HTMLElement;
  overflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value?.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  document.body.style.overflow = overflow;
  focused?.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="campus-drawer"
    :aria-label="title"
    @cancel.prevent="close"
    @click="$event.target === dialog && close()"
  >
    <header>
      <div>
        <p class="eyebrow">{{ subtitle || "EduBook" }}</p>
        <h2>{{ title }}</h2>
      </div>
      <button
        type="button"
        class="outline-button"
        :disabled="busy"
        @click="close"
      >
        {{ language === "zh" ? "关闭" : "Close" }}
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <div class="campus-drawer-body" :aria-busy="busy"><slot /></div>
  </dialog>
</template>
