<script setup lang="ts">
defineProps<{ language: string }>();
</script>
<template>
  <section
    class="school-cover"
    :aria-label="
      language === 'zh' ? 'EduBook 课程预约' : 'EduBook lesson booking'
    "
  >
    <div class="cover-masthead">
      <span>EDUBOOK</span><span>LESSONS. CONNECTIONS. PROGRESS.</span>
    </div>
    <div class="cover-title">
      <p>
        {{
          language === "zh"
            ? "你的下一堂课，从这里开始。"
            : "A place for your next lesson."
        }}
      </p>
      <h2>Make time.<br /><em>Make progress.</em></h2>
    </div>
    <div class="cover-timetable" aria-hidden="true">
      <span class="cover-axis">YOUR NEXT CHAPTER</span>
      <div class="cover-rule"><span>01</span><strong>Meet.</strong></div>
      <div class="cover-rule"><span>02</span><strong>Learn.</strong></div>
      <div class="cover-rule"><span>03</span><strong>Repeat.</strong></div>
    </div>
    <footer>
      {{
        language === "zh"
          ? "跨越时区，让每一次相遇恰逢其时。"
          : "Different time zones. The same place to connect."
      }}<span>↗</span>
    </footer>
  </section>
</template>
