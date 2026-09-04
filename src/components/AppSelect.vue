<script setup lang="ts" generic="T extends string">
import { computed, nextTick, onBeforeUnmount, ref, useId } from "vue";
const props = defineProps<{
  modelValue: T;
  options: { value: T; label: string }[];
  label: string;
  searchable?: boolean;
  emptyLabel?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: T] }>();
const id = useId();
const open = ref(false);
const query = ref("");
const active = ref(0);
const root = ref<HTMLElement>();
const trigger = ref<HTMLButtonElement>();
const searchInput = ref<HTMLInputElement>();
const filtered = computed(() =>
  props.options.filter((option) =>
    option.label.toLowerCase().includes(query.value.toLowerCase()),
  ),
);
const selected = computed(
  () =>
    props.options.find((option) => option.value === props.modelValue)?.label ||
    props.modelValue,
);
function close() {
  open.value = false;
  document.removeEventListener("pointerdown", outside);
}
function outside(event: Event) {
  if (!root.value?.contains(event.target as Node)) close();
}
async function toggle() {
  if (open.value) {
    close();
    return;
  }
  query.value = "";
  open.value = true;
  active.value = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.modelValue),
  );
  document.addEventListener("pointerdown", outside);
  await nextTick();
  searchInput.value?.focus();
  scrollActive();
}
function scrollActive() {
  root.value
    ?.querySelector(`[id="${id}-${active.value}"]`)
    ?.scrollIntoView?.({ block: "nearest" });
}
function choose(value: T) {
  emit("update:modelValue", value);
  close();
  trigger.value?.focus();
}
async function keydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    trigger.value?.focus();
    return;
  }
  if (event.key === "Tab") {
    close();
    return;
  }
  if (
    !["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key) ||
    (event.target === searchInput.value && event.key === " ")
  )
    return;
  event.preventDefault();
  if (!open.value) {
    await toggle();
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    const option = filtered.value[active.value];
    if (option) choose(option.value);
    return;
  }
  active.value = Math.max(
    0,
    Math.min(
      filtered.value.length - 1,
      active.value + (event.key === "ArrowDown" ? 1 : -1),
    ),
  );
  await nextTick();
  scrollActive();
}
onBeforeUnmount(close);
</script>
<template>
  <div ref="root" class="app-select" @keydown="keydown">
    <button
      ref="trigger"
      type="button"
      class="select-trigger"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="`${id}-list`"
      :aria-activedescendant="
        open && !searchable ? `${id}-${active}` : undefined
      "
      @click="toggle"
    >
      <span>{{ selected }}</span
      ><span aria-hidden="true">⌄</span>
    </button>
    <div v-if="open" class="select-popover">
      <input
        v-if="searchable"
        ref="searchInput"
        v-model="query"
        type="search"
        :aria-label="label"
        :placeholder="label"
        :aria-controls="`${id}-list`"
        :aria-activedescendant="`${id}-${active}`"
        @input="active = 0"
      />
      <ul :id="`${id}-list`" role="listbox" :aria-label="label">
        <li
          v-for="(option, index) in filtered"
          :id="`${id}-${index}`"
          :key="option.value"
          role="option"
          :aria-selected="option.value === modelValue"
          :class="{ highlighted: index === active }"
          @pointermove="active = index"
          @click.prevent.stop="choose(option.value)"
        >
          <span>{{ option.label }}</span
          ><span v-if="option.value === modelValue" aria-hidden="true">✓</span>
        </li>
        <li v-if="!filtered.length" class="select-empty">
          {{ emptyLabel || "No results" }}
        </li>
      </ul>
    </div>
  </div>
</template>
