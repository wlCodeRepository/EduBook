<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { supabase, supabaseConfigured } from './lib/supabase'
import { formatViewerTime, generateSlots, type BookingSlot } from './lib/booking'
import type { Availability, BlockedPeriod, Booking, Profile, Role } from './lib/types'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { messages, type Language } from './lib/i18n'

const session = ref<{ user: { id: string; email?: string } } | null>(null)
const profile = ref<Profile | null>(null)
const authForm = ref({ email: '', password: '', displayName: '', role: 'STUDENT' as Role, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' })
const authView = ref<'login' | 'signup' | 'forgot' | 'reset'>('login')
const resetStep = ref<'email' | 'code' | 'password'>('email')
const resetCode = ref('')
const newPassword = ref('')
const recoveryMode = ref(false)
const loading = ref(true); const busy = ref(false); const errorMessage = ref(''); const toast = ref('')
const activeNav = ref('预约课程'); const teachers = ref<Profile[]>([]); const bookings = ref<Booking[]>([])
const availability = ref<Availability[]>([]); const blocked = ref<BlockedPeriod[]>([]); const selectedTeacherId = ref(''); const selectedSlot = ref<BookingSlot | null>(null)
const weekStart = ref(new Date()); const newRule = ref({ weekday: 1, start: '09:00', end: '12:00' }); const blockedForm = ref({ start: '', end: '', reason: '' })
const demoState = ref<'success' | 'loading' | 'empty' | 'error'>('success')
let unsubscribeAuth: (() => void) | null = null
const language = ref<Language>((localStorage.getItem('edubook-language') as Language) || 'en')
const copy = computed(() => messages[language.value])
const detectedTimezone = (() => { try { const zone = Intl.DateTimeFormat().resolvedOptions().timeZone; if (zone) new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(); return zone || '' } catch { return '' } })()
const timezoneAutoDetected = Boolean(detectedTimezone)
const timezoneOptions = Array.from(new Set([detectedTimezone, 'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Asia/Kolkata', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney'])).filter(Boolean)

const currentTeacher = computed(() => teachers.value.find((item) => item.id === selectedTeacherId.value) ?? teachers.value[0])
const viewerTimezone = computed(() => profile.value?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
const teacherSlots = computed(() => {
  if (!currentTeacher.value || demoState.value !== 'success') return []
  const start = weekStart.value; const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
  return generateSlots(date, 7, currentTeacher.value.timezone, viewerTimezone.value, currentTeacher.value.default_lesson_minutes, availability.value.filter((item) => item.teacher_id === currentTeacher.value.id), blocked.value.filter((item) => item.teacher_id === currentTeacher.value.id), bookings.value.filter((item) => item.teacher_id === currentTeacher.value.id))
})
const availableSlots = computed(() => teacherSlots.value.filter((slot) => slot.available))
const pendingBookings = computed(() => bookings.value.filter((item) => item.status === 'PENDING'))
const teacherBookings = computed(() => bookings.value.filter((item) => item.teacher_id === profile.value?.id).sort((a, b) => a.start_at_utc.localeCompare(b.start_at_utc)))
const studentBookings = computed(() => bookings.value.filter((item) => item.student_id === profile.value?.id).sort((a, b) => b.start_at_utc.localeCompare(a.start_at_utc)))

function showToast(message: string) { toast.value = message; window.setTimeout(() => { toast.value = '' }, 3000) }
function toggleLanguage() { language.value = language.value === 'en' ? 'zh' : 'en'; localStorage.setItem('edubook-language', language.value) }
function setError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : ''
  const errorMap: Record<string, string> = {
    invalid_credentials: copy.value.authInvalid,
    email_not_confirmed: copy.value.authNotConfirmed,
    otp_expired: copy.value.authExpired,
    token_expired: copy.value.authExpired,
    over_request_rate_limit: copy.value.authRateLimited,
    user_already_exists: copy.value.authAlreadyRegistered,
  }
  errorMessage.value = errorMap[code] || (error instanceof Error ? error.message : copy.value.authGeneric)
}

async function loadData() {
  if (!profile.value) return; loading.value = true; errorMessage.value = ''
  try {
    const teachersResponse = await supabase.from('profiles').select('*').eq('role', 'TEACHER').order('display_name')
    if (teachersResponse.error) throw teachersResponse.error
    teachers.value = teachersResponse.data as Profile[]; if (!selectedTeacherId.value && teachers.value[0]) selectedTeacherId.value = teachers.value[0].id
    const bookingResponse = await supabase.from('bookings').select('*').or(`student_id.eq.${profile.value.id},teacher_id.eq.${profile.value.id}`)
    if (bookingResponse.error) throw bookingResponse.error
    bookings.value = bookingResponse.data as Booking[]
    const teacherId = profile.value.role === 'TEACHER' ? profile.value.id : selectedTeacherId.value
    if (teacherId) {
      const [availabilityResponse, blockedResponse] = await Promise.all([supabase.from('teacher_availability').select('*').eq('teacher_id', teacherId).order('weekday').order('local_start_time'), supabase.from('teacher_blocked_periods').select('*').eq('teacher_id', teacherId).order('start_at_utc')])
      if (availabilityResponse.error) throw availabilityResponse.error; if (blockedResponse.error) throw blockedResponse.error
      availability.value = availabilityResponse.data as Availability[]; blocked.value = blockedResponse.data as BlockedPeriod[]
    }
  } catch (error) { setError(error) } finally { loading.value = false }
}

async function submitAuth() {
  busy.value = true; errorMessage.value = ''
  try {
    if (!supabaseConfigured) throw new Error('请先配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
    if (authView.value === 'login') {
      const result = await supabase.auth.signInWithPassword({ email: authForm.value.email, password: authForm.value.password })
      if (result.error) throw result.error
    } else if (authView.value === 'signup') {
      const result = await supabase.auth.signUp({ email: authForm.value.email, password: authForm.value.password, options: { data: { display_name: authForm.value.displayName, role: authForm.value.role, timezone: authForm.value.timezone } } })
      if (result.error) throw result.error
      if (result.data.user && result.data.session) await ensureProfile(result.data.user.id, result.data.user.email || authForm.value.email)
      if (!result.data.session) showToast('注册成功，请查收邮箱完成验证')
    } else if (authView.value === 'forgot') {
      const result = await supabase.auth.resetPasswordForEmail(authForm.value.email)
      if (result.error) throw result.error
      resetStep.value = 'code'; showToast('重置验证码已发送，请检查邮箱')
    } else if (resetStep.value === 'code') {
      recoveryMode.value = true
      const result = await supabase.auth.verifyOtp({ email: authForm.value.email, token: resetCode.value.trim(), type: 'recovery' })
      if (result.error) throw result.error
      authView.value = 'reset'; resetStep.value = 'password'; showToast('验证码已验证，请设置新密码')
    } else {
      const result = await supabase.auth.updateUser({ password: newPassword.value })
      if (result.error) throw result.error
      await supabase.auth.signOut(); session.value = null; profile.value = null; recoveryMode.value = false; authView.value = 'login'; resetStep.value = 'email'; resetCode.value = ''; newPassword.value = ''; showToast('密码已重置，请使用新密码登录')
    }
  } catch (error) { if (authView.value === 'forgot') recoveryMode.value = false; setError(error) } finally { busy.value = false }
}

async function resendResetCode() {
  if (!authForm.value.email) return
  busy.value = true; errorMessage.value = ''
  try { const result = await supabase.auth.resetPasswordForEmail(authForm.value.email); if (result.error) throw result.error; resetCode.value = ''; showToast('新的重置验证码已发送') } catch (error) { setError(error) } finally { busy.value = false }
}

async function ensureProfile(id: string, email: string) {
  const values = { id, email, display_name: authForm.value.displayName || email.split('@')[0], role: authForm.value.role, timezone: authForm.value.timezone, default_lesson_minutes: 60 }
  const response = await supabase.from('profiles').upsert(values); if (response.error) throw response.error; profile.value = values as Profile
}
async function restoreProfile(userId: string, email = '') { const response = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(); if (response.error) { setError(response.error); return }; if (response.data) profile.value = response.data as Profile; else if (email) await ensureProfile(userId, email); await loadData() }
async function signOut() { await supabase.auth.signOut(); session.value = null; profile.value = null }

async function submitBooking() {
  if (!selectedSlot.value || !currentTeacher.value) return; busy.value = true; errorMessage.value = ''
  try { const response = await supabase.functions.invoke('create-booking', { body: { teacherId: currentTeacher.value.id, startAtUtc: selectedSlot.value.startAtUtc, endAtUtc: selectedSlot.value.endAtUtc } }); if (response.error) throw response.error; showToast('预约申请已提交，等待老师确认'); selectedSlot.value = null; await loadData() } catch (error) { setError(error) } finally { busy.value = false }
}
async function bookingAction(id: string, action: 'confirm' | 'reject' | 'cancel') {
  busy.value = true; errorMessage.value = ''
  try { const response = await supabase.functions.invoke('booking-action', { body: { bookingId: id, action } }); if (response.error) throw response.error; showToast(action === 'confirm' ? '预约已确认' : action === 'reject' ? '预约已拒绝' : '预约已取消'); await loadData() } catch (error) { setError(error) } finally { busy.value = false }
}
async function addAvailability() { if (!profile.value) return; busy.value = true; try { const response = await supabase.from('teacher_availability').insert({ teacher_id: profile.value.id, weekday: newRule.value.weekday, local_start_time: newRule.value.start, local_end_time: newRule.value.end }).select().single(); if (response.error) throw response.error; showToast('固定授课时间已添加'); await loadData() } catch (error) { setError(error) } finally { busy.value = false } }
async function removeAvailability(id: string) { const response = await supabase.from('teacher_availability').delete().eq('id', id); if (response.error) setError(response.error); else await loadData() }
async function addBlockedPeriod() { if (!profile.value || !blockedForm.value.start || !blockedForm.value.end) return; const response = await supabase.from('teacher_blocked_periods').insert({ teacher_id: profile.value.id, start_at_utc: new Date(blockedForm.value.start).toISOString(), end_at_utc: new Date(blockedForm.value.end).toISOString(), reason: blockedForm.value.reason || null }); if (response.error) setError(response.error); else { showToast('不可预约时段已添加'); blockedForm.value = { start: '', end: '', reason: '' }; await loadData() } }
async function saveLessonMinutes() { if (!profile.value) return; const response = await supabase.from('profiles').update({ default_lesson_minutes: profile.value.default_lesson_minutes }).eq('id', profile.value.id); if (response.error) setError(response.error); else showToast('课程时长已保存') }
function selectTeacher(id: string) { selectedTeacherId.value = id; selectedSlot.value = null; loadData() }
function shiftWeek(days: number) { weekStart.value = new Date(weekStart.value.getTime() + days * 86400000) }
function slotLabel(slot: BookingSlot) { return `${slot.viewerStart} — ${slot.viewerEnd}` }

onMounted(async () => { const isRecoveryRedirect = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery'; if (isRecoveryRedirect) { recoveryMode.value = true; authView.value = 'reset'; resetStep.value = 'password' }; const current = await supabase.auth.getSession(); session.value = current.data.session ? { user: { id: current.data.session.user.id, email: current.data.session.user.email } } : null; if (session.value && !recoveryMode.value) await restoreProfile(session.value.user.id, session.value.user.email); const { data } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, next: Session | null) => { if (event === 'PASSWORD_RECOVERY') { recoveryMode.value = true; authView.value = 'reset'; resetStep.value = 'password' } session.value = next ? { user: { id: next.user.id, email: next.user.email } } : null; if (next && !recoveryMode.value) await restoreProfile(next.user.id, next.user.email) }); unsubscribeAuth = () => data.subscription.unsubscribe(); loading.value = false })
onUnmounted(() => { unsubscribeAuth?.(); unsubscribeAuth = null })
</script>

<template>
  <div v-if="!session || !profile || recoveryMode" class="auth-shell"><div class="auth-card"><div class="auth-top"><div class="brand"><span class="brand-mark">E</span><span>EduBook</span></div><button class="language-button" @click="toggleLanguage">{{ copy.language }}</button></div><span class="section-kicker">{{ copy.workspace }}</span><h1>{{ authView === 'forgot' ? copy.forgotTitle : authView === 'reset' ? copy.resetTitle : authView === 'login' ? copy.loginTitle : copy.signupTitle }}</h1><p class="auth-intro">{{ authView === 'forgot' || authView === 'reset' ? copy.resetHint : copy.intro }}</p><div v-if="!supabaseConfigured" class="notice error-state">{{ copy.setupMissing }}</div><form @submit.prevent="submitAuth"><template v-if="authView === 'login' || authView === 'signup'"><label v-if="authView === 'signup'">{{ copy.name }}<input v-model="authForm.displayName" required placeholder="Alex" /></label><label>{{ copy.email }}<input v-model="authForm.email" type="email" required placeholder="you@example.com" /></label><label>{{ copy.password }}<input v-model="authForm.password" type="password" minlength="6" required placeholder="••••••••" /></label><template v-if="authView === 'signup'"><label>{{ copy.role }}<select v-model="authForm.role"><option value="STUDENT">{{ copy.student }}</option><option value="TEACHER">{{ copy.teacher }}</option></select></label><label>{{ timezoneAutoDetected ? copy.detectedTimezone : copy.timezone }}<select v-model="authForm.timezone"><option v-for="zone in timezoneOptions" :key="zone" :value="zone">{{ zone }}</option></select></label></template></template><label v-else-if="authView === 'forgot' && resetStep === 'email'">{{ copy.email }}<input v-model="authForm.email" type="email" required placeholder="you@example.com" /></label><label v-else-if="authView === 'forgot' && resetStep === 'code'">{{ copy.resetCode }}<input v-model="resetCode" inputmode="numeric" autocomplete="one-time-code" minlength="6" maxlength="8" required placeholder="12345678" /></label><label v-else>{{ copy.newPassword }}<input v-model="newPassword" type="password" minlength="6" required placeholder="••••••••" /></label><p v-if="authView === 'forgot' && resetStep === 'code'" class="otp-hint">{{ copy.otpHint }}</p><p v-if="errorMessage" class="form-error">{{ errorMessage }}</p><button class="primary-button full" :disabled="busy || !supabaseConfigured">{{ busy ? copy.processing : authView === 'login' ? copy.login : authView === 'signup' ? copy.signup : resetStep === 'email' ? copy.sendResetCode : resetStep === 'code' ? copy.verifyCode : copy.resetPassword }}</button></form><button v-if="authView === 'forgot' && resetStep === 'code'" class="text-button auth-switch" :disabled="busy" @click="resendResetCode">{{ copy.sendResetCode }}</button><button class="text-button auth-switch" @click="authView = authView === 'login' ? 'signup' : 'login'; resetStep = 'email'; recoveryMode = false; errorMessage = ''">{{ authView === 'login' ? copy.noAccount : authView === 'signup' ? copy.hasAccount : copy.backToLogin }}</button><button v-if="authView === 'login'" class="text-button forgot-link" @click="authView = 'forgot'; errorMessage = ''; resetStep = 'email'">{{ copy.forgotPassword }}</button></div></div>
  <div v-else class="app-shell"><aside class="sidebar" :aria-label="language === 'en' ? 'Main navigation' : '主导航'"><div class="brand"><span class="brand-mark">E</span><span>EduBook</span></div><div class="workspace-label">{{ copy.workspace }}</div><nav class="nav-list"><button class="nav-item" :class="{ active: activeNav === '预约课程' }" @click="activeNav = '预约课程'">□ {{ copy.booking }}</button><button class="nav-item" :class="{ active: activeNav === '我的预约' }" @click="activeNav = '我的预约'">↗ {{ copy.myBookings }} <span class="nav-count">{{ studentBookings.length }}</span></button><template v-if="profile.role === 'TEACHER'"><button class="nav-item" :class="{ active: activeNav === '预约管理' }" @click="activeNav = '预约管理'">≡ {{ copy.manage }} <span class="nav-count warm">{{ pendingBookings.length }}</span></button><button class="nav-item" :class="{ active: activeNav === '排期设置' }" @click="activeNav = '排期设置'">＋ {{ copy.schedule }}</button></template></nav><div class="sidebar-bottom"><button class="nav-item">? Help</button><div class="profile-mini"><div class="avatar avatar-user">{{ profile.display_name.slice(0, 2) }}</div><div><strong>{{ profile.display_name }}</strong><small>{{ profile.timezone }}</small></div><button class="signout" @click="signOut">{{ copy.signOut }}</button></div></div></aside>
    <main class="main-content"><header class="topbar"><div><p class="eyebrow">{{ new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', { dateStyle: 'full', timeZone: viewerTimezone }).format(new Date()) }}</p><h1>{{ profile.role === 'TEACHER' && activeNav !== '预约课程' ? copy.teacherDesk : copy.findLesson }}</h1><span class="connection-status">● {{ copy.connected }}</span></div><div class="top-actions"><button class="language-button" @click="toggleLanguage">{{ copy.language }}</button><label class="state-control">{{ language === 'en' ? 'State' : '状态' }} <select v-model="demoState"><option value="success">Success</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option></select></label><button class="avatar avatar-user" aria-label="当前用户">{{ profile.display_name.slice(0, 2) }}</button></div></header><div v-if="errorMessage" class="notice error-state">{{ errorMessage }} <button class="text-button" @click="loadData">{{ copy.retry }}</button></div>
      <div v-if="activeNav === '预约课程'" class="content-grid"><section class="primary-column"><div class="section-heading"><div><span class="section-kicker">{{ copy.featured }}</span><h2>{{ copy.findLesson }}</h2></div></div><div v-if="loading" class="state-panel"><span class="spinner"></span><strong>Loading live teacher availability…</strong></div><div v-else-if="!teachers.length" class="state-panel"><span class="state-symbol">○</span><strong>{{ copy.noTeachers }}</strong><small>Ask a teacher to create an account and add their hours.</small></div><div v-else class="teacher-list" aria-label="Teacher list"><button v-for="teacher in teachers" :key="teacher.id" class="teacher-card" :class="{ chosen: selectedTeacherId === teacher.id }" @click="selectTeacher(teacher.id)"><span class="avatar avatar-coral">{{ teacher.display_name.slice(0, 2) }}</span><span class="teacher-info"><strong>{{ teacher.display_name }}</strong><span>{{ teacher.timezone }}</span><small>{{ teacher.default_lesson_minutes }} min lessons</small></span><span class="teacher-arrow">→</span></button></div><div class="section-heading calendar-heading"><div><span class="section-kicker">{{ copy.calendar }}</span><h2>{{ currentTeacher?.display_name || 'Select a teacher' }}</h2><p class="subtle">{{ copy.shownIn }}: {{ viewerTimezone }}</p></div><div class="calendar-nav"><button aria-label="Previous week" @click="shiftWeek(-7)">‹</button><span>Next 7 days</span><button aria-label="Next week" @click="shiftWeek(7)">›</button></div></div><div class="calendar-card"><div v-if="demoState === 'loading'" class="state-panel"><span class="spinner"></span><strong>Loading live availability…</strong></div><div v-else-if="demoState === 'empty' || !availableSlots.length" class="state-panel"><span class="state-symbol">○</span><strong>{{ copy.noSlots }}</strong><small>Try the next week.</small></div><div v-else-if="demoState === 'error'" class="state-panel error-state"><span class="state-symbol">!</span><strong>Could not load availability</strong><button class="outline-button" @click="demoState = 'success'">{{ copy.retry }}</button></div><div v-else class="slot-list"><button v-for="slot in teacherSlots" :key="slot.startAtUtc" class="slot-item" :class="{ unavailable: !slot.available, selected: selectedSlot?.startAtUtc === slot.startAtUtc }" :disabled="!slot.available" @click="selectedSlot = slot"><span>{{ slot.viewerStart }}</span><strong>{{ slot.available ? 'Available' : 'Booked' }}</strong></button></div></div></section><aside class="booking-summary"><div class="summary-top"><span class="section-kicker">{{ copy.bookingConfirm }}</span><span class="status-pill">{{ copy.pending }}</span></div><h3>{{ selectedSlot ? 'Confirm this lesson' : copy.selectTime }}</h3><div v-if="currentTeacher" class="summary-person"><span class="avatar avatar-coral">{{ currentTeacher.display_name.slice(0, 2) }}</span><div><strong>{{ currentTeacher.display_name }}</strong><span>{{ currentTeacher.timezone }}</span></div></div><div v-if="selectedSlot" class="summary-details"><div><span>{{ copy.teacherTime }}</span><strong>{{ selectedSlot.localDate }} · {{ selectedSlot.localStart }} — {{ selectedSlot.localEnd }}</strong></div><div><span>{{ copy.yourTime }}</span><strong>{{ slotLabel(selectedSlot) }}</strong></div></div><button class="primary-button" :disabled="!selectedSlot || busy" @click="submitBooking">{{ busy ? copy.submitting : copy.submit }}</button><p class="summary-note">The teacher confirms each request. No payment is taken.</p></aside></div>
      <section v-else-if="activeNav === '我的预约'" class="dashboard-panel"><div class="teacher-hero"><div><span class="section-kicker">学生工作台 / 我的预约</span><h2>每一节课，都有清晰安排。</h2></div></div><div class="panel wide"><div v-if="!studentBookings.length" class="state-panel"><strong>还没有预约记录</strong><small>去预约课程，找到下一位老师</small></div><div v-for="booking in studentBookings" :key="booking.id" class="booking-row"><div class="booking-time">{{ formatViewerTime(booking.start_at_utc, viewerTimezone) }}</div><div class="booking-name"><strong>{{ booking.status === 'PENDING' ? '等待老师确认' : booking.status === 'CONFIRMED' ? '预约已确认' : booking.status === 'COMPLETED' ? '已完成' : '预约已结束' }}</strong><span>{{ new Date(booking.start_at_utc).toLocaleString('zh-CN', { timeZone: viewerTimezone }) }}</span></div><span class="status-pill" :class="{ confirmed: booking.status === 'CONFIRMED' }">{{ booking.status }}</span></div></div></section>
      <section v-else class="teacher-view"><div class="teacher-hero"><div><span class="section-kicker">老师工作台 / {{ activeNav }}</span><h2>{{ activeNav === '排期设置' ? '安排你的授课时间' : '预约申请，一目了然' }}</h2><p>用清晰的排期，把每一次专注的教学留给真正重要的事。</p></div></div><div v-if="activeNav === '预约管理'" class="teacher-panels"><div class="panel wide"><div class="panel-head"><div><strong>预约申请</strong><span>{{ pendingBookings.length }} 条待处理</span></div></div><div v-if="!teacherBookings.length" class="state-panel"><strong>暂时没有预约</strong></div><div v-for="booking in teacherBookings" :key="booking.id" class="booking-row"><div class="booking-time">{{ new Date(booking.start_at_utc).toLocaleString('zh-CN', { timeZone: profile.timezone }) }}</div><div class="avatar avatar-student">学</div><div class="booking-name"><strong>学生预约</strong><span>{{ booking.student_id }}</span></div><span class="status-pill" :class="{ confirmed: booking.status === 'CONFIRMED' }">{{ booking.status }}</span><div class="row-actions"><button v-if="booking.status === 'PENDING'" class="mini-button" @click="bookingAction(booking.id, 'confirm')">确认</button><button v-if="booking.status === 'PENDING'" class="mini-button ghost" @click="bookingAction(booking.id, 'reject')">拒绝</button><button v-if="booking.status === 'CONFIRMED'" class="mini-button ghost" @click="bookingAction(booking.id, 'cancel')">取消</button></div></div></div></div><div v-else class="teacher-panels"><div class="panel wide"><div class="panel-head"><div><strong>固定授课时间</strong><span>按 {{ profile.timezone }} 解释</span></div></div><div v-for="rule in availability" :key="rule.id" class="availability-row"><span>周{{ ['日','一','二','三','四','五','六'][rule.weekday] }}</span><strong>{{ rule.local_start_time.slice(0,5) }} — {{ rule.local_end_time.slice(0,5) }}</strong><button class="text-button" @click="removeAvailability(rule.id)">移除</button></div><div class="inline-form"><select v-model="newRule.weekday"><option v-for="(day, index) in ['日','一','二','三','四','五','六']" :key="day" :value="index">周{{ day }}</option></select><input v-model="newRule.start" type="time" /><input v-model="newRule.end" type="time" /><button class="primary-button" @click="addAvailability">添加</button></div></div><div class="panel"><div class="panel-head"><div><strong>课程设置</strong><span>默认课程时长</span></div></div><label>每节课分钟数<input v-model.number="profile.default_lesson_minutes" type="number" min="5" max="240" step="5" /></label><button class="outline-button" @click="saveLessonMinutes">保存时长</button></div><div class="panel wide"><div class="panel-head"><div><strong>不可预约时段</strong><span>请假、会议或个人安排</span></div></div><div v-for="item in blocked" :key="item.id" class="availability-row blocked"><strong>{{ new Date(item.start_at_utc).toLocaleString('zh-CN', { timeZone: profile.timezone }) }}</strong><small>{{ item.reason || '不可预约' }}</small></div><div class="inline-form"><input v-model="blockedForm.start" type="datetime-local" /><input v-model="blockedForm.end" type="datetime-local" /><input v-model="blockedForm.reason" placeholder="原因（可选）" /><button class="primary-button" @click="addBlockedPeriod">添加</button></div></div></div></section>
    </main>
  </div><transition name="toast"><div v-if="toast" class="toast" role="status"><span>✓</span>{{ toast }}</div></transition>
</template>
