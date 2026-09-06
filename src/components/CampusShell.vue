<script setup lang="ts">
import { computed } from "vue";
import AccountMenu from "./AccountMenu.vue";
import type { Role } from "../lib/types";
const props = defineProps<{
  role: Role;
  active: string;
  language: string;
  name: string;
  username?: string | null;
  timezone: string;
  title: string;
  pending?: number;
}>();
const emit = defineEmits<{
  navigate: [page: string];
  account: [section: "profile" | "password"];
  signout: [];
  language: [];
}>();
const zh = computed(() => props.language === "zh");
const destinations = computed(() =>
  props.role === "ADMIN"
    ? [
        ["overview", "Campus", "校园总览", "◈"],
        ["people", "People", "人员名册", "◌"],
        ["bookings", "Schedule", "全局课程", "▤"],
      ]
    : props.role === "TEACHER"
      ? [
          ["teacher-overview", "My week", "本周课表", "▦"],
          ["requests", "Requests", "预约申请", "↗"],
          ["settings", "Availability", "课程安排", "◷"],
        ]
      : [
          ["book", "Find a lesson", "预约课程", "↗"],
          ["history", "My lessons", "我的课程", "▤"],
        ],
);
const roleName = computed(() =>
  props.role === "ADMIN"
    ? zh.value
      ? "校园管理"
      : "Campus office"
    : props.role === "TEACHER"
      ? zh.value
        ? "教师空间"
        : "Teaching studio"
      : zh.value
        ? "学习空间"
        : "Learning studio",
);
const date = computed(() =>
  new Intl.DateTimeFormat(zh.value ? "zh-CN" : "en-GB", {
    timeZone: props.timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date()),
);
</script>
<template>
  <div class="campus-shell" :data-role="role">
    <a class="campus-skip" href="#campus-content">{{
      zh ? "跳到内容" : "Skip to content"
    }}</a>
    <header class="campus-rail">
      <a class="campus-brand" href="#campus-content" aria-label="EduBook"
        ><span class="campus-monogram">E<span>·</span></span
        ><strong
          >EduBook<small>{{
            zh ? "数字校园" : "DIGITAL CAMPUS"
          }}</small></strong
        ></a
      >
      <nav :aria-label="zh ? '校园导航' : 'Campus navigation'">
        <button
          v-for="item in destinations"
          :key="item[0]"
          :aria-current="active === item[0] ? 'page' : undefined"
          @click="emit('navigate', item[0])"
        >
          <span aria-hidden="true">{{ item[3] }}</span
          ><span>{{ item[zh ? 2 : 1] }}</span
          ><small v-if="item[0] === 'requests' && pending">{{ pending }}</small>
        </button>
      </nav>
      <button class="language-button" @click="emit('language')">
        {{ zh ? "EN" : "中文" }}
      </button>
    </header>
    <main id="campus-content" class="campus-content" tabindex="-1">
      <header class="campus-header">
        <div>
          <p>{{ roleName }}</p>
          <h1>{{ title }}</h1>
        </div>
        <div class="campus-header-tools">
          <span>{{ date }}</span
          ><small>{{ timezone }}</small>
        </div>
      </header>
      <div class="campus-stage"><slot /></div>
    </main>
    <footer class="campus-dock">
      <AccountMenu
        :display-name="name"
        :username="username"
        :role-label="roleName"
        :language="language"
        @open="emit('account', $event)"
        @signout="emit('signout')"
      />
      <p>
        <span aria-hidden="true">◌</span>
        {{
          zh
            ? "不同的时区，同一间课堂。"
            : "Different time zones. A shared classroom."
        }}
      </p>
      <span class="campus-dock-label">{{
        zh ? "你的校园空间" : "YOUR CAMPUS SPACE"
      }}</span>
    </footer>
  </div>
</template>
