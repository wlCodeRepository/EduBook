<script setup lang="ts">
import { computed, ref } from "vue";
const props = defineProps<{
  name?: string;
  language: string;
  minutes?: number;
}>();
const turned = ref(false);
const zh = computed(() => props.language === "zh");
</script>
<template>
  <section class="learning-room" :class="{ turned }">
    <div class="room-copy">
      <p class="room-kicker">
        EDUBOOK / {{ zh ? "学习空间" : "LEARNING SPACE" }}
      </p>
      <h2>
        {{ zh ? "留一点时间，" : "A little time." }}<br /><em>{{
          zh ? "给新的可能。" : "A new perspective."
        }}</em>
      </h2>
      <p>
        {{
          zh
            ? "选择你的老师，在这里安排下一次见面。"
            : "Choose your teacher. Make room for your next lesson."
        }}
      </p>
      <div class="room-name">
        <span class="room-dot" /><span>{{
          name || (zh ? "你的下一堂课" : "Your next lesson")
        }}</span
        ><small v-if="minutes"
          >{{ minutes }} {{ zh ? "分钟 / 节" : "min / lesson" }}</small
        >
      </div>
    </div>
    <div class="room-art">
      <div class="room-perspective" aria-hidden="true">
        <div class="room-model">
          <div class="room-floor" />
          <div class="room-wall wall-back">
            <div class="room-window"><i /><i /><i /><i /></div>
            <span class="wall-poster">STAY<br />CURIOUS.</span>
          </div>
          <div class="room-wall wall-side" />
          <div class="room-rug" />
          <div class="desk-top">
            <span class="desk-book book-a" /><span
              class="desk-book book-b"
            /><span class="desk-paper" /><span class="desk-cup" />
          </div>
          <div class="desk-leg leg-a" />
          <div class="desk-leg leg-b" />
          <div class="chair-seat" />
          <div class="chair-back" />
          <div class="chair-leg" />
          <div class="room-plant"><i /><i /><i /><span /></div>
          <div class="room-lamp"><span /><i /></div>
        </div>
      </div>
      <button
        class="room-view-button"
        type="button"
        :aria-pressed="turned"
        @click="turned = !turned"
      >
        ↻ {{ zh ? "换个视角" : "Another perspective" }}
      </button>
    </div>
  </section>
</template>
<style scoped>
.learning-room {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  min-height: 350px;
  background: #e6ece7;
  border-radius: 26px;
  overflow: hidden;
  position: relative;
  padding: 34px 44px;
  margin-bottom: 28px;
  color: #252c2d;
}
.room-copy {
  position: relative;
  z-index: 2;
}
.room-kicker {
  font: 11px/1.5 monospace;
  letter-spacing: 0.13em;
  margin-bottom: 24px;
  color: #5b706a;
}
.room-copy h2 {
  font-family: "Trebuchet MS", "Microsoft YaHei", sans-serif;
  font-size: clamp(28px, 3vw, 46px);
  line-height: 1.2;
  font-weight: 500;
  letter-spacing: -0.04em;
}
.room-copy h2 em {
  font-style: normal;
  color: #427268;
}
.room-copy > p:last-of-type {
  font-size: 13px;
  line-height: 1.8;
  color: #597069;
  margin: 20px 0;
}
.room-name {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
  font-size: 14px;
}
.room-name small {
  color: #647670;
}
.room-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #32786d;
}
.room-art {
  position: relative;
  height: 300px;
  min-width: 0;
}
.room-perspective {
  perspective: 1100px;
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.room-model {
  position: relative;
  width: 300px;
  height: 260px;
  transform-style: preserve-3d;
  transform: rotateX(55deg) rotateZ(-35deg);
  transition: transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.turned .room-model {
  transform: rotateX(55deg) rotateZ(-10deg);
}
.room-model > * {
  position: absolute;
  transform-style: preserve-3d;
}
.room-floor {
  inset: 0;
  background: #e0c49f;
  border: 8px solid #ecd9bc;
  box-shadow:
    0 12px 0 #ba9d78,
    10px 32px 35px #35484030;
}
.room-wall {
  background: #fbfaf5;
  box-shadow: inset 0 0 0 5px #e4e7de;
}
.wall-back {
  width: 300px;
  height: 155px;
  top: 0;
  left: 0;
  transform-origin: top;
  transform: rotateX(90deg);
}
.wall-side {
  height: 260px;
  width: 155px;
  left: 0;
  top: 0;
  transform-origin: left;
  transform: rotateY(-90deg);
  background: #d1ddd6;
}
.room-window {
  position: absolute;
  left: 32px;
  top: 28px;
  width: 98px;
  height: 92px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  background: #9fbbb8;
  padding: 6px;
  box-shadow: 3px 3px 0 #c0d1c9;
}
.room-window i {
  background: #d8eeec;
}
.wall-poster {
  position: absolute;
  right: 32px;
  top: 32px;
  padding: 12px;
  background: #c8e8df;
  font:
    600 17px/1.15 "Trebuchet MS",
    sans-serif;
  transform: rotate(180deg) scaleX(-1);
  color: #446b5e;
}
.room-rug {
  width: 195px;
  height: 160px;
  background: #abbeb2;
  border-radius: 48%;
  left: 56px;
  top: 66px;
  transform: translateZ(2px);
  border: 3px solid #c1cfc2;
}
.desk-top {
  width: 168px;
  height: 88px;
  left: 62px;
  top: 70px;
  background: #f4eee1;
  border-radius: 10px;
  box-shadow: 0 5px 0 #c5bca9;
  transform: translateZ(72px);
}
.desk-leg {
  height: 70px;
  width: 9px;
  background: #8f9b8d;
  top: 84px;
  transform-origin: top;
  transform: translateZ(70px) rotateX(-90deg);
}
.leg-a {
  left: 75px;
}
.leg-b {
  left: 208px;
}
.desk-book {
  position: absolute;
  width: 39px;
  height: 50px;
  border-radius: 2px;
  box-shadow: 2px 3px 0 #ece9dc;
}
.book-a {
  left: 18px;
  top: 19px;
  background: #63d9ce;
  transform: rotate(-8deg) translateZ(3px);
}
.book-b {
  left: 62px;
  top: 16px;
  background: #567569;
  transform: rotate(4deg) translateZ(3px);
}
.desk-paper {
  position: absolute;
  right: 20px;
  top: 23px;
  width: 32px;
  height: 43px;
  background: white;
  transform: rotate(-5deg) translateZ(2px);
}
.desk-cup {
  position: absolute;
  right: 14px;
  bottom: 9px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #b98157;
  border: 4px solid #fff;
  transform: translateZ(8px);
  box-shadow: 2px 4px 0 #d2c9b7;
}
.chair-seat {
  width: 55px;
  height: 53px;
  left: 130px;
  top: 179px;
  border-radius: 10px;
  background: #659a8c;
  transform: translateZ(38px);
}
.chair-back {
  width: 55px;
  height: 55px;
  left: 130px;
  top: 225px;
  background: #79b4a3;
  border-radius: 14px 14px 5px 5px;
  transform-origin: bottom;
  transform: translateZ(38px) rotateX(-90deg);
}
.chair-leg {
  width: 8px;
  height: 38px;
  left: 154px;
  top: 203px;
  background: #65766a;
  transform-origin: top;
  transform: translateZ(38px) rotateX(-90deg);
}
.room-plant {
  left: 247px;
  top: 28px;
  width: 35px;
  height: 80px;
  transform: rotateX(-90deg);
  transform-origin: bottom;
}
.room-plant span {
  position: absolute;
  bottom: 0;
  width: 34px;
  height: 32px;
  background: #c98963;
  border-radius: 3px 3px 12px 12px;
}
.room-plant i {
  position: absolute;
  width: 19px;
  height: 47px;
  border-radius: 90% 0;
  background: #527d55;
  bottom: 27px;
  left: 10px;
  transform: rotate(-20deg);
}
.room-plant i:nth-child(2) {
  transform: rotate(30deg);
  left: 17px;
  background: #6d9668;
}
.room-plant i:nth-child(3) {
  transform: rotate(-50deg);
  left: -3px;
}
.room-lamp {
  left: 26px;
  top: 136px;
  height: 108px;
  width: 40px;
  transform-origin: bottom;
  transform: rotateX(-90deg);
}
.room-lamp span {
  position: absolute;
  width: 5px;
  height: 94px;
  left: 18px;
  bottom: 0;
  background: #627b70;
}
.room-lamp i {
  position: absolute;
  width: 42px;
  height: 30px;
  top: 0;
  background: #fbefd1;
  border-radius: 50% 50% 5px 5px;
}
.room-view-button {
  position: absolute;
  bottom: -8px;
  right: 0;
  color: #41645c;
  background: #ffffff99;
  border: 1px solid #b9cdc3;
  border-radius: 30px;
  padding: 9px 14px;
  font-size: 12px;
}
@media (max-width: 900px) {
  .learning-room {
    padding: 28px;
    grid-template-columns: 1fr 1fr;
  }
  .room-model {
    scale: 0.8;
  }
  .room-copy h2 {
    font-size: 30px;
  }
}
@media (max-width: 600px) {
  .learning-room {
    grid-template-columns: 1fr;
    padding: 24px;
    min-height: 0;
    border-radius: 20px;
  }
  .room-copy h2 {
    font-size: 30px;
  }
  .room-copy > p:last-of-type {
    margin: 14px 0;
  }
  .room-kicker {
    margin-bottom: 16px;
  }
  .room-art {
    height: 210px;
  }
  .room-model {
    scale: 0.65;
  }
  .room-view-button {
    bottom: 0;
  }
  .room-name {
    font-size: 13px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .room-model {
    transition: none;
  }
}
</style>
