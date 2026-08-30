<script setup lang="ts">
import { computed, ref } from 'vue'

type Role = 'student' | 'teacher'
type DemoState = 'success' | 'loading' | 'empty' | 'error'

const role = ref<Role>('student')
const demoState = ref<DemoState>('success')
const activeNav = ref('预约课程')
const selectedTeacher = ref('林若安')
const selectedDate = ref('2026-09-02')
const selectedSlot = ref('15:00')
const toast = ref('')

const teachers = [
  { name: '林若安', subject: '英语表达 · 雅思口语', meta: '本周 12 个可约时段', initials: 'LA', color: 'coral', next: '今天 15:00' },
  { name: '周知远', subject: '数学思维 · 高中', meta: '本周 8 个可约时段', initials: 'ZY', color: 'teal', next: '明天 10:30' },
  { name: '沈砚秋', subject: '物理竞赛 · 初高中', meta: '本周 5 个可约时段', initials: 'SY', color: 'ink', next: '周五 19:00' },
]

const week = [
  { day: '周一', date: '31', muted: true }, { day: '周二', date: '01', muted: true },
  { day: '周三', date: '02', muted: false }, { day: '周四', date: '03', muted: false },
  { day: '周五', date: '04', muted: false }, { day: '周六', date: '05', muted: false }, { day: '周日', date: '06', muted: false },
]
const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00']
const openSlots = new Set(['10:00', '11:00', '15:00', '16:00', '18:00'])

const currentTeacher = computed(() => teachers.find((teacher) => teacher.name === selectedTeacher.value) ?? teachers[0])
const bookingCopy = computed(() => demoState.value === 'empty' ? '本周暂无可预约时段' : demoState.value === 'error' ? '暂时无法加载预约数据' : '选择一个适合你的时间')

function showToast(message: string) {
  toast.value = message
  window.setTimeout(() => { toast.value = '' }, 2600)
}

function bookSlot() {
  if (!selectedSlot.value) return
  showToast(`已提交 ${selectedDate.value} ${selectedSlot.value} 的预约申请`)
}

function toggleRole(nextRole: Role) {
  role.value = nextRole
  activeNav.value = nextRole === 'student' ? '预约课程' : '预约管理'
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" aria-label="主导航">
      <div class="brand"><span class="brand-mark">E</span><span>EduBook</span></div>
      <div class="workspace-label">我的工作台</div>
      <nav class="nav-list">
        <button class="nav-item" :class="{ active: activeNav === '预约课程' }" @click="activeNav = '预约课程'">
          <span class="nav-icon calendar-icon" aria-hidden="true">□</span>预约课程
        </button>
        <button class="nav-item" :class="{ active: activeNav === '我的预约' }" @click="activeNav = '我的预约'">
          <span class="nav-icon" aria-hidden="true">↗</span>我的预约 <span class="nav-count">2</span>
        </button>
        <button v-if="role === 'teacher'" class="nav-item" :class="{ active: activeNav === '预约管理' }" @click="activeNav = '预约管理'">
          <span class="nav-icon" aria-hidden="true">≡</span>预约管理 <span class="nav-count warm">3</span>
        </button>
        <button v-if="role === 'teacher'" class="nav-item" :class="{ active: activeNav === '排期设置' }" @click="activeNav = '排期设置'">
          <span class="nav-icon" aria-hidden="true">＋</span>排期设置
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="nav-item"><span class="nav-icon" aria-hidden="true">?</span>帮助中心</button>
        <div class="profile-mini"><div class="avatar avatar-user">WL</div><div><strong>王老师</strong><small>成都 · UTC+8</small></div><span class="more">···</span></div>
      </div>
    </aside>

    <main class="main-content">
      <header class="topbar">
        <div><p class="eyebrow">星期三，2026年9月2日</p><h1>{{ role === 'student' ? '找到适合你的课堂' : '今天，掌握你的教学节奏' }}</h1></div>
        <div class="top-actions"><label class="state-control">演示状态 <select v-model="demoState" aria-label="切换演示状态"><option value="success">Success</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option></select></label><button class="icon-button" aria-label="通知">♧<span class="notification-dot"></span></button><button class="avatar avatar-user" aria-label="打开个人菜单">WL</button></div>
      </header>

      <div v-if="role === 'student' && activeNav === '预约课程'" class="content-grid">
        <section class="primary-column">
          <div class="role-switch" role="tablist" aria-label="角色切换"><button :class="{ selected: role === 'student' }" role="tab" @click="toggleRole('student')">学生视角</button><button :class="{ selected: role === 'teacher' }" role="tab" @click="toggleRole('teacher')">老师视角</button></div>
          <div class="section-heading"><div><span class="section-kicker">精选老师</span><h2>今天想学点什么？</h2></div><button class="text-button">查看全部 <span>→</span></button></div>
          <div class="teacher-list" aria-label="老师列表">
            <button v-for="teacher in teachers" :key="teacher.name" class="teacher-card" :class="{ chosen: selectedTeacher === teacher.name }" @click="selectedTeacher = teacher.name">
              <span class="avatar" :class="`avatar-${teacher.color}`">{{ teacher.initials }}</span><span class="teacher-info"><strong>{{ teacher.name }}</strong><span>{{ teacher.subject }}</span><small>{{ teacher.meta }}</small></span><span class="teacher-arrow">→</span>
            </button>
          </div>
          <div class="section-heading calendar-heading"><div><span class="section-kicker">预约日历</span><h2>{{ currentTeacher.name }}的可约时间</h2><p class="subtle">时区：Asia/Shanghai（UTC+8） · 课程时长 60 分钟</p></div><div class="calendar-nav"><button aria-label="上周">‹</button><span>2026年 9月</span><button aria-label="下周">›</button></div></div>
          <div class="calendar-card">
            <div class="week-row"><div class="week-spacer">时间</div><div v-for="item in week" :key="item.date" class="week-day" :class="{ muted: item.muted, today: item.date === '02' }"><span>{{ item.day }}</span><strong>{{ item.date }}</strong></div></div>
            <div v-if="demoState === 'loading'" class="state-panel loading-state"><span class="spinner"></span><strong>正在加载可预约时段…</strong><small>正在读取老师的最新排期</small></div>
            <div v-else-if="demoState === 'empty'" class="state-panel"><span class="state-symbol">○</span><strong>本周暂无可预约时段</strong><small>试试查看下一周的课程安排</small><button class="outline-button">查看下一周</button></div>
            <div v-else-if="demoState === 'error'" class="state-panel error-state"><span class="state-symbol">!</span><strong>排期加载失败</strong><small>网络似乎开了个小差，请稍后再试</small><button class="outline-button" @click="demoState = 'success'">重新加载</button></div>
            <div v-else class="calendar-body"><div v-for="time in slots" :key="time" class="time-row"><div class="time-label">{{ time }}</div><div v-for="item in week" :key="`${item.date}-${time}`" class="slot-cell" :class="{ muted: item.muted, booked: item.date === '03' && time === '15:00', available: item.date === '02' && openSlots.has(time), selected: selectedSlot === time && item.date === '02' }" @click="item.date === '02' && openSlots.has(time) ? selectedSlot = time : null">{{ item.date === '03' && time === '15:00' ? '已约' : item.date === '02' && openSlots.has(time) ? '可预约' : '' }}</div></div></div>
          </div>
        </section>
        <aside class="booking-summary"><div class="summary-top"><span class="section-kicker">预约确认</span><span class="status-pill">待确认</span></div><h3>{{ bookingCopy }}</h3><div class="summary-person"><span class="avatar avatar-coral">{{ currentTeacher.initials }}</span><div><strong>{{ currentTeacher.name }}</strong><span>{{ currentTeacher.subject }}</span></div></div><div class="summary-details"><div><span>日期</span><strong>9月2日 · 星期三</strong></div><div><span>时间</span><strong>{{ selectedSlot || '请选择时段' }} — {{ selectedSlot ? `${String(Number(selectedSlot.slice(0, 2)) + 1).padStart(2, '0')}:00` : '--' }}</strong></div><div><span>你的时区</span><strong>成都（UTC+8）</strong></div></div><button class="primary-button" :disabled="demoState !== 'success' || !selectedSlot" @click="bookSlot">提交预约申请 <span>→</span></button><p class="summary-note">老师确认后，你会收到邮件通知。提交申请不会产生费用。</p></aside>
      </div>

      <div v-else class="teacher-view">
        <div class="role-switch" role="tablist"><button :class="{ selected: role === 'student' }" @click="toggleRole('student')">学生视角</button><button :class="{ selected: role === 'teacher' }" @click="toggleRole('teacher')">老师视角</button></div>
        <div class="teacher-hero"><div><span class="section-kicker">老师工作台 / {{ activeNav }}</span><h2>{{ activeNav === '排期设置' ? '安排你的授课时间' : '预约申请，一目了然' }}</h2><p>用清晰的排期，把每一次专注的教学留给真正重要的事。</p></div><button class="primary-button">＋ 新增时间段</button></div>
        <div class="teacher-panels"><div class="panel wide"><div class="panel-head"><div><strong>本周预约</strong><span>2026年 9月 1日 — 7日</span></div><span class="status-pill confirmed">已确认 6</span></div><div v-for="booking in [{time:'今天 15:00', name:'陈思齐', subject:'雅思口语 · 第 3 节', status:'待确认'},{time:'今天 17:00', name:'李沐阳', subject:'英语表达 · 第 1 节', status:'已确认'},{time:'明天 10:30', name:'赵一诺', subject:'雅思口语 · 第 2 节', status:'已确认'}]" :key="booking.time" class="booking-row"><div class="booking-time">{{ booking.time }}</div><div class="avatar avatar-student">{{ booking.name.slice(0, 1) }}</div><div class="booking-name"><strong>{{ booking.name }}</strong><span>{{ booking.subject }}</span></div><span class="status-pill" :class="booking.status === '已确认' ? 'confirmed' : ''">{{ booking.status }}</span><button class="row-action">···</button></div></div><div class="panel"><div class="panel-head"><div><strong>固定授课时间</strong><span>每周重复</span></div><button class="text-button">编辑</button></div><div class="availability-row"><span>一 / 三 / 五</span><strong>14:00 — 18:00</strong><small>每节 60 分钟</small></div><div class="availability-row blocked"><span>周二</span><strong>不可预约</strong><small>会议日</small></div></div></div>
      </div>
    </main>
  </div>
  <transition name="toast"><div v-if="toast" class="toast" role="status"><span>✓</span>{{ toast }}</div></transition>
</template>
