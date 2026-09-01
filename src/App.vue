<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatViewerTime, generateSlots, type BookingSlot } from './lib/booking'
import { messages, type Language } from './lib/i18n'
import { initialNavForRole } from './lib/navigation'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { Availability, BlockedPeriod, Booking, BusySlot, Profile, Role } from './lib/types'

const language = ref<Language>((localStorage.getItem('edubook-language') as Language) || 'en')
const copy = computed(() => messages[language.value])
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
const timezoneOptions = Array.from(new Set([detectedTimezone, 'UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney']))
const session = ref<{ user: { id: string } } | null>(null)
const profile = ref<Profile | null>(null)
const auth = ref({ username: '', password: '' })
const adminForm = ref({ username: '', password: '', displayName: '', role: 'TEACHER' as Role, timezone: detectedTimezone })
const teachers = ref<Profile[]>([])
const users = ref<Profile[]>([])
const bookings = ref<Booking[]>([])
const availability = ref<Availability[]>([])
const blocked = ref<BlockedPeriod[]>([])
const busySlots = ref<BusySlot[]>([])
const selectedTeacherId = ref('')
const selectedSlot = ref<BookingSlot | null>(null)
const weekStart = ref(new Date())
const activeNav = ref('book')
const loading = ref(false)
const busy = ref(false)
const errorMessage = ref('')
const toast = ref('')
const newRule = ref({ weekday: 1, start: '09:00', end: '12:00' })
const blockedForm = ref({ start: '', end: '', reason: '' })

const viewerTimezone = computed(() => profile.value?.timezone || detectedTimezone)
const currentTeacher = computed(() => teachers.value.find((item) => item.id === selectedTeacherId.value) || teachers.value[0])
const studentBookings = computed(() => bookings.value.filter((item) => item.student_id === profile.value?.id))
const teacherBookings = computed(() => bookings.value.filter((item) => item.teacher_id === profile.value?.id))
const studentCount = computed(() => users.value.filter((item) => item.role === 'STUDENT').length)
const teacherCount = computed(() => users.value.filter((item) => item.role === 'TEACHER').length)
const title = computed(() => {
  if (activeNav.value === 'admin') return tr('Team setup', '账号与团队设置')
  if (activeNav.value === 'schedule') return tr('Teaching schedule', '授课排期')
  if (activeNav.value === 'requests') return tr('Booking requests', '预约申请')
  if (activeNav.value === 'history') return tr('My lessons', '我的课程')
  return copy.value.findLesson
})
const slots = computed(() => {
  if (!currentTeacher.value) return []
  const date = `${weekStart.value.getFullYear()}-${String(weekStart.value.getMonth() + 1).padStart(2, '0')}-${String(weekStart.value.getDate()).padStart(2, '0')}`
  return generateSlots(date, 7, currentTeacher.value.timezone, viewerTimezone.value, currentTeacher.value.default_lesson_minutes, availability.value, blocked.value, busySlots.value)
})

function tr(en: string, zh: string) { return language.value === 'en' ? en : zh }
function toggleLanguage() { language.value = language.value === 'en' ? 'zh' : 'en'; localStorage.setItem('edubook-language', language.value) }
function showToast(message: string) { toast.value = message; window.setTimeout(() => { toast.value = '' }, 3500) }
function statusLabel(status: string) { return ({ PENDING: tr('Pending', '待确认'), CONFIRMED: tr('Confirmed', '已确认'), REJECTED: tr('Declined', '已拒绝'), CANCELLED: tr('Cancelled', '已取消'), COMPLETED: tr('Completed', '已完成') }[status] || status) }
function roleLabel(role: Role) { return role === 'TEACHER' ? tr('Teacher', '老师') : role === 'ADMIN' ? tr('Administrator', '管理员') : tr('Student', '学生') }

async function setError(error: unknown) {
  let code = ''
  if (typeof error === 'object' && error !== null && 'context' in error) {
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      try { code = String((await context.clone().json() as { error?: string }).error || '') } catch { /* use a safe fallback */ }
    } else if (context && typeof context === 'object' && 'error' in context) code = String((context as { error?: string }).error || '')
  }
  const known: Record<string, string> = {
    unauthorized: tr('Your session has expired. Please sign in again.', '登录已过期，请重新登录。'),
    admin_only: tr('This account is not an administrator account.', '当前账号不是管理员账号。'),
    operator_lookup_failed: tr('The administrator service is unavailable. Please retry in a moment.', '管理员服务暂不可用，请稍后重试。'),
    teacher_only: tr('Only teachers can perform this action.', '只有老师可以执行此操作。'),
    student_only: tr('Only students can submit booking requests.', '只有学生可以提交预约。'),
    slot_unavailable: tr('This time was just taken. Please choose another one.', '该时间刚被占用，请选择其他时间。'),
    invalid_account_profile: tr('Choose a valid role and timezone.', '请选择有效的账号角色和时区。'),
    invalid_busy_slot_input: tr('The selected date range is invalid.', '所选日期范围无效。'),
  }
  errorMessage.value = known[code] || (error instanceof Error && error.message !== 'Edge Function returned a non-2xx status code' ? error.message : code || copy.value.authGeneric)
}

async function loadData() {
  if (!profile.value) return
  loading.value = true; errorMessage.value = ''
  try {
    const teacherResult = await supabase.from('profiles').select('*').eq('role', 'TEACHER').order('display_name')
    if (teacherResult.error) throw teacherResult.error
    teachers.value = teacherResult.data as Profile[]
    if (!selectedTeacherId.value && teachers.value[0]) selectedTeacherId.value = teachers.value[0].id
    const bookingResult = await supabase.from('bookings').select('*').or(`student_id.eq.${profile.value.id},teacher_id.eq.${profile.value.id}`)
    if (bookingResult.error) throw bookingResult.error
    bookings.value = bookingResult.data as Booking[]
    if (profile.value.role === 'ADMIN') {
      const accountResult = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (accountResult.error) throw accountResult.error
      users.value = accountResult.data as Profile[]
      return
    }
    const teacherId = profile.value.role === 'TEACHER' ? profile.value.id : selectedTeacherId.value
    if (!teacherId) return
    const [availabilityResult, blockedResult] = await Promise.all([
      supabase.from('teacher_availability').select('*').eq('teacher_id', teacherId).order('weekday'),
      supabase.from('teacher_blocked_periods').select('*').eq('teacher_id', teacherId).order('start_at_utc'),
    ])
    if (availabilityResult.error) throw availabilityResult.error
    if (blockedResult.error) throw blockedResult.error
    availability.value = availabilityResult.data as Availability[]
    blocked.value = blockedResult.data as BlockedPeriod[]
    const from = new Date(weekStart.value.getFullYear(), weekStart.value.getMonth(), weekStart.value.getDate()).toISOString()
    const until = new Date(new Date(from).getTime() + 604800000).toISOString()
    const busyResult = await supabase.functions.invoke('teacher-busy-slots', { body: { teacherId, from, until } })
    if (busyResult.error) throw busyResult.error
    busySlots.value = (busyResult.data?.slots || []) as BusySlot[]
  } catch (error) { await setError(error) } finally { loading.value = false }
}

async function restore(id: string) {
  const result = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (result.error || !result.data) { await setError(result.error || new Error('profile_not_found')); return }
  profile.value = result.data as Profile
  activeNav.value = initialNavForRole(profile.value.role)
  await loadData()
}
async function signIn() { busy.value = true; try { if (!supabaseConfigured) throw new Error(copy.value.setupMissing); const result = await supabase.auth.signInWithPassword({ email: `${auth.value.username.trim().toLowerCase()}@accounts.edubook.internal`, password: auth.value.password }); if (result.error) throw result.error } catch (error) { await setError(error) } finally { busy.value = false } }
async function signOut() { await supabase.auth.signOut(); session.value = null; profile.value = null; errorMessage.value = '' }
async function createUser() { busy.value = true; try { const result = await supabase.functions.invoke('admin-create-user', { body: adminForm.value }); if (result.error) throw result.error; const createdRole = adminForm.value.role; adminForm.value = { username: '', password: '', displayName: '', role: createdRole, timezone: detectedTimezone }; showToast(tr('Account created. Share the username and temporary password securely.', '账号已创建，请通过安全方式提供账号和临时密码。')); await loadData() } catch (error) { await setError(error) } finally { busy.value = false } }
async function addAvailability() { if (!profile.value) return; try { const result = await supabase.from('teacher_availability').insert({ teacher_id: profile.value.id, weekday: newRule.value.weekday, local_start_time: newRule.value.start, local_end_time: newRule.value.end }); if (result.error) throw result.error; await loadData() } catch (error) { await setError(error) } }
async function removeAvailability(id: string) { const result = await supabase.from('teacher_availability').delete().eq('id', id); if (result.error) await setError(result.error); else await loadData() }
async function addBlocked() { if (!profile.value || !blockedForm.value.start || !blockedForm.value.end) return; try { const result = await supabase.from('teacher_blocked_periods').insert({ teacher_id: profile.value.id, start_at_utc: new Date(blockedForm.value.start).toISOString(), end_at_utc: new Date(blockedForm.value.end).toISOString(), reason: blockedForm.value.reason || null }); if (result.error) throw result.error; blockedForm.value = { start: '', end: '', reason: '' }; await loadData() } catch (error) { await setError(error) } }
async function saveMinutes() { if (!profile.value) return; const result = await supabase.rpc('update_my_profile', { p_display_name: profile.value.display_name, p_timezone: profile.value.timezone, p_default_lesson_minutes: profile.value.default_lesson_minutes }); if (result.error) await setError(result.error); else { profile.value = result.data as Profile; showToast(tr('Lesson duration saved.', '课程时长已保存。')) } }
async function book() { if (!selectedSlot.value || !currentTeacher.value) return; busy.value = true; try { const result = await supabase.functions.invoke('create-booking', { body: { teacherId: currentTeacher.value.id, startAtUtc: selectedSlot.value.startAtUtc, endAtUtc: selectedSlot.value.endAtUtc } }); if (result.error) throw result.error; selectedSlot.value = null; showToast(tr('Booking request sent. Your teacher will confirm it soon.', '预约申请已提交，老师确认后课程才会成立。')); await loadData() } catch (error) { await setError(error) } finally { busy.value = false } }
async function action(id: string, value: 'confirm' | 'reject' | 'cancel') { try { const result = await supabase.functions.invoke('booking-action', { body: { bookingId: id, action: value } }); if (result.error) throw result.error; showToast(tr('Booking updated.', '预约已更新。')); await loadData() } catch (error) { await setError(error) } }
function selectTeacher(id: string) { selectedTeacherId.value = id; selectedSlot.value = null; void loadData() }
function shift(days: number) { weekStart.value = new Date(weekStart.value.getTime() + days * 86400000); selectedSlot.value = null; void loadData() }

onMounted(async () => {
  const result = await supabase.auth.getSession()
  session.value = result.data.session ? { user: { id: result.data.session.user.id } } : null
  if (session.value) await restore(session.value.user.id)
  supabase.auth.onAuthStateChange(async (_event, next) => { session.value = next ? { user: { id: next.user.id } } : null; if (next) await restore(next.user.id) })
})
</script>

<template>
  <main v-if="!session || !profile" class="auth-shell">
    <section class="auth-card">
      <div class="auth-top"><div class="brand"><span class="brand-mark">E</span><span>EduBook</span></div><button class="language-button" @click="toggleLanguage">{{ copy.language }}</button></div>
      <p class="eyebrow">{{ copy.workspace }}</p><h1>{{ copy.loginTitle }}</h1><p class="auth-intro">{{ copy.intro }}</p>
      <p v-if="!supabaseConfigured" class="alert alert-error">{{ copy.setupMissing }}</p>
      <form @submit.prevent="signIn"><label>{{ tr('Username', '账号名') }}<input v-model="auth.username" autocomplete="username" required /></label><label>{{ copy.password }}<input v-model="auth.password" type="password" autocomplete="current-password" minlength="8" required /></label><p v-if="errorMessage" class="form-error">{{ errorMessage }}</p><button class="primary-button" :disabled="busy || !supabaseConfigured">{{ busy ? copy.processing : copy.login }}</button></form>
      <p class="auth-note">{{ tr('Accounts are created by an administrator. No email is required.', '账户由管理员创建，无需邮箱。') }}</p>
    </section>
  </main>

  <div v-else class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">E</span><span>EduBook</span></div>
      <p class="workspace-label">{{ profile.role === 'ADMIN' ? tr('Administration', '系统管理') : copy.workspace }}</p>
      <nav class="nav-list">
        <button v-if="profile.role !== 'ADMIN'" class="nav-item" :class="{ active: activeNav === 'book' }" @click="activeNav = 'book'">{{ copy.booking }}</button>
        <button v-if="profile.role !== 'ADMIN'" class="nav-item" :class="{ active: activeNav === 'history' }" @click="activeNav = 'history'">{{ copy.myBookings }}</button>
        <button v-if="profile.role === 'ADMIN'" class="nav-item" :class="{ active: activeNav === 'admin' }" @click="activeNav = 'admin'">{{ tr('User management', '用户管理') }}</button>
        <button v-if="profile.role === 'TEACHER'" class="nav-item" :class="{ active: activeNav === 'requests' }" @click="activeNav = 'requests'">{{ copy.manage }}<span v-if="teacherBookings.filter(item => item.status === 'PENDING').length" class="nav-count">{{ teacherBookings.filter(item => item.status === 'PENDING').length }}</span></button>
        <button v-if="profile.role === 'TEACHER'" class="nav-item" :class="{ active: activeNav === 'schedule' }" @click="activeNav = 'schedule'">{{ copy.schedule }}</button>
      </nav>
      <div class="profile-mini"><span class="avatar avatar-user">{{ profile.display_name.slice(0, 2) }}</span><div><strong>{{ profile.display_name }}</strong><small>{{ roleLabel(profile.role) }} · {{ profile.timezone }}</small></div><button class="signout" @click="signOut">{{ copy.signOut }}</button></div>
    </aside>

    <section class="main-content">
      <header class="topbar"><div><p class="eyebrow">{{ new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', { dateStyle: 'full', timeZone: viewerTimezone }).format(new Date()) }}</p><h1>{{ title }}</h1></div><button class="language-button" @click="toggleLanguage">{{ copy.language }}</button></header>
      <div v-if="errorMessage" class="alert alert-error"><span>{{ errorMessage }}</span><button class="text-button" @click="loadData">{{ copy.retry }}</button></div>

      <section v-if="activeNav === 'admin'" class="admin-layout">
        <div class="admin-intro"><div><p class="eyebrow">{{ tr('Account provisioning', '账号开通流程') }}</p><h2>{{ tr('Set up the people who will teach and learn.', '先建立老师与学生，预约流程即可开始。') }}</h2><p>{{ tr('Create teachers first so students can see availability. Accounts use usernames and passwords only; no email is sent.', '建议先创建老师，再创建学生。账号仅使用用户名和密码登录，不发送邮件。') }}</p></div><div class="metric-grid"><div class="metric"><strong>{{ teacherCount }}</strong><span>{{ tr('Teachers', '老师') }}</span></div><div class="metric"><strong>{{ studentCount }}</strong><span>{{ tr('Students', '学生') }}</span></div></div></div>
        <div class="panel create-panel"><div class="panel-heading"><div><p class="eyebrow">01 · {{ tr('Create an account', '创建账号') }}</p><h3>{{ tr('New teacher or student', '新增老师或学生') }}</h3></div><span class="secure-note">{{ tr('No email required', '无需邮箱') }}</span></div><form class="account-form" @submit.prevent="createUser"><label><span>{{ tr('Account username', '登录账号') }}</span><input v-model="adminForm.username" autocomplete="off" required pattern="[A-Za-z0-9_.-]{3,40}" :placeholder="tr('e.g. alex.chen', '例如 alex.chen')" /></label><label><span>{{ tr('Temporary password', '临时密码') }}</span><input v-model="adminForm.password" type="password" minlength="8" required :placeholder="tr('At least 8 characters', '至少 8 位')" /></label><label><span>{{ tr('Display name', '显示名称') }}</span><input v-model="adminForm.displayName" required :placeholder="tr('e.g. Alex Chen', '例如 陈老师')" /></label><label><span>{{ tr('Role', '角色') }}</span><select v-model="adminForm.role"><option value="TEACHER">{{ copy.teacher }}</option><option value="STUDENT">{{ copy.student }}</option></select></label><label><span>{{ tr('Timezone', '时区') }}</span><select v-model="adminForm.timezone"><option v-for="zone in timezoneOptions" :key="zone">{{ zone }}</option></select></label><button class="primary-button create-button" :disabled="busy">{{ busy ? copy.processing : tr('Create account', '创建账号') }}</button></form></div>
        <div class="panel account-list"><div class="panel-heading"><div><p class="eyebrow">02 · {{ tr('Directory', '账号目录') }}</p><h3>{{ tr('Active accounts', '现有账号') }}</h3></div><span>{{ users.length }} {{ tr('total', '个') }}</span></div><div v-if="users.length" class="account-table"><div v-for="user in users" :key="user.id" class="account-row"><span class="avatar" :class="user.role === 'TEACHER' ? 'avatar-teal' : user.role === 'ADMIN' ? 'avatar-user' : 'avatar-gold'">{{ user.display_name.slice(0, 2) }}</span><div><strong>{{ user.display_name }}</strong><small>{{ user.username || '—' }}</small></div><span class="role-tag" :class="user.role.toLowerCase()">{{ roleLabel(user.role) }}</span><small class="timezone">{{ user.timezone }}</small></div></div><div v-else class="empty-inline"><strong>{{ tr('Your first teacher belongs here.', '创建第一位老师后会显示在这里。') }}</strong><span>{{ tr('Use the form above to open the first teaching account.', '请使用上方表单开通首个老师账号。') }}</span></div></div>
      </section>

      <section v-else-if="activeNav === 'schedule'" class="two-column"><div class="panel"><div class="panel-heading"><div><p class="eyebrow">{{ copy.fixedTimes }}</p><h3>{{ tr('Your recurring availability', '每周固定可授课时间') }}</h3></div></div><div v-if="availability.length" class="setting-list"><div v-for="rule in availability" :key="rule.id" class="setting-row"><span>{{ tr(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][rule.weekday], ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][rule.weekday]) }}</span><strong>{{ rule.local_start_time.slice(0, 5) }} – {{ rule.local_end_time.slice(0, 5) }}</strong><button class="text-button" @click="removeAvailability(rule.id)">{{ copy.remove }}</button></div></div><p v-else class="empty-inline">{{ tr('Add a weekly time window to receive booking requests.', '添加每周可授课时间，学生才能提交预约。') }}</p><form class="compact-form" @submit.prevent="addAvailability"><select v-model="newRule.weekday"><option v-for="day in 7" :key="day" :value="day - 1">{{ tr(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day - 1], ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day - 1]) }}</option></select><input v-model="newRule.start" type="time" required /><input v-model="newRule.end" type="time" required /><button class="primary-button">{{ copy.add }}</button></form></div><div class="stack"><div class="panel"><p class="eyebrow">{{ copy.lessonSettings }}</p><h3>{{ copy.minutes }}</h3><div class="duration-row"><input v-model.number="profile.default_lesson_minutes" type="number" min="5" max="240" step="5" /><span>min</span><button class="outline-button" @click="saveMinutes">{{ copy.save }}</button></div></div><div class="panel"><p class="eyebrow">{{ copy.blocked }}</p><div v-if="blocked.length" class="setting-list blocked-list"><div v-for="period in blocked" :key="period.id" class="setting-row"><strong>{{ formatViewerTime(period.start_at_utc, profile.timezone) }}</strong><small>{{ period.reason }}</small></div></div><form class="blocked-form" @submit.prevent="addBlocked"><input v-model="blockedForm.start" type="datetime-local" required /><input v-model="blockedForm.end" type="datetime-local" required /><input v-model="blockedForm.reason" :placeholder="tr('Reason (optional)', '原因（可选）')" /><button class="outline-button">{{ copy.add }}</button></form></div></div></section>

      <section v-else-if="activeNav === 'requests' || activeNav === 'history'" class="panel booking-list"><div class="panel-heading"><div><p class="eyebrow">{{ activeNav === 'requests' ? tr('Teacher inbox', '老师收件箱') : tr('Learning history', '学习记录') }}</p><h3>{{ activeNav === 'requests' ? tr('Requests awaiting your decision', '待你处理的预约') : tr('Your booking history', '你的预约记录') }}</h3></div></div><div v-if="(activeNav === 'requests' ? teacherBookings : studentBookings).length" class="booking-records"><div v-for="booking in activeNav === 'requests' ? teacherBookings : studentBookings" :key="booking.id" class="booking-record"><div><strong>{{ formatViewerTime(booking.start_at_utc, viewerTimezone) }}</strong><small>{{ tr('Ends', '结束') }} {{ formatViewerTime(booking.end_at_utc, viewerTimezone) }}</small></div><span class="status-pill" :class="booking.status.toLowerCase()">{{ statusLabel(booking.status) }}</span><div v-if="activeNav === 'requests'" class="row-actions"><button v-if="booking.status === 'PENDING'" class="mini-button" @click="action(booking.id, 'confirm')">{{ copy.confirm }}</button><button v-if="booking.status === 'PENDING'" class="mini-button ghost" @click="action(booking.id, 'reject')">{{ copy.reject }}</button><button v-if="booking.status === 'CONFIRMED'" class="mini-button ghost" @click="action(booking.id, 'cancel')">{{ copy.cancel }}</button></div></div></div><div v-else class="empty-state"><span class="empty-glyph">○</span><h3>{{ activeNav === 'requests' ? tr('No requests yet', '还没有预约申请') : copy.noBookings }}</h3><p>{{ activeNav === 'requests' ? tr('New requests will arrive here after students book an available time.', '学生预约可用时间后，申请会显示在这里。') : tr('Once a teacher confirms your request, it will appear here.', '老师确认预约后，课程记录会显示在这里。') }}</p></div></section>

      <section v-else class="booking-workspace">
        <div class="booking-intro"><p class="eyebrow">{{ copy.shownIn }} · {{ viewerTimezone }}</p><h2>{{ tr('Choose a teacher, then a time that fits.', '选择老师，再挑选适合自己的时间。') }}</h2><p>{{ tr('All times are converted automatically. A submitted request holds the time until the teacher confirms or declines it.', '所有时间会自动转换。提交申请后，该时段将被保留，等待老师确认或拒绝。') }}</p></div>
        <div v-if="!teachers.length" class="empty-state full-empty"><span class="empty-glyph">＋</span><h3>{{ copy.noTeachers }}</h3><p>{{ tr('There are no teaching accounts yet. An administrator needs to create a teacher and set their weekly availability first.', '目前还没有老师账号。管理员需要先创建老师，再由老师设置每周可授课时间。') }}</p></div>
        <template v-else><div class="teacher-picker"><button v-for="teacher in teachers" :key="teacher.id" class="teacher-card" :class="{ chosen: currentTeacher?.id === teacher.id }" @click="selectTeacher(teacher.id)"><span class="avatar avatar-teal">{{ teacher.display_name.slice(0, 2) }}</span><span><strong>{{ teacher.display_name }}</strong><small>{{ teacher.default_lesson_minutes }} min · {{ teacher.timezone }}</small></span><span class="teacher-check">{{ currentTeacher?.id === teacher.id ? '✓' : '' }}</span></button></div><div class="availability-layout"><div class="panel time-panel"><div class="panel-heading"><div><p class="eyebrow">{{ copy.calendar }}</p><h3>{{ currentTeacher?.display_name }}</h3></div><div class="date-controls"><button class="icon-button" @click="shift(-7)" aria-label="Previous week">←</button><span>{{ new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', timeZone: viewerTimezone }).format(weekStart) }}</span><button class="icon-button" @click="shift(7)" aria-label="Next week">→</button></div></div><p class="timezone-note">{{ tr('Times below are shown in', '以下时间按') }} {{ viewerTimezone }} {{ tr('time.', '显示。') }}</p><div v-if="loading" class="loading-state">{{ copy.processing }}</div><div v-else-if="slots.length" class="slot-grid"><button v-for="slot in slots" :key="slot.startAtUtc" class="slot-item" :class="{ selected: selectedSlot?.startAtUtc === slot.startAtUtc, unavailable: !slot.available }" :disabled="!slot.available" @click="selectedSlot = slot"><span>{{ slot.viewerStart }}</span><small>{{ slot.available ? tr('Available', '可预约') : tr('Unavailable', '不可用') }}</small></button></div><div v-else class="empty-inline"><strong>{{ copy.noSlots }}</strong><span>{{ tr('Try another week or ask the teacher to add availability.', '请切换其他日期，或请老师添加可授课时间。') }}</span></div></div><aside class="booking-summary"><p class="eyebrow">{{ copy.bookingConfirm }}</p><h3>{{ selectedSlot ? tr('Ready to request?', '确认提交预约？') : copy.selectTime }}</h3><template v-if="selectedSlot"><div class="summary-detail"><span>{{ tr('Teacher', '老师') }}</span><strong>{{ currentTeacher?.display_name }}</strong></div><div class="summary-detail"><span>{{ tr('Your time', '你的时间') }}</span><strong>{{ selectedSlot.viewerStart }} – {{ selectedSlot.viewerEnd }}</strong></div><div class="summary-detail"><span>{{ tr('Teacher local time', '老师当地时间') }}</span><strong>{{ selectedSlot.localDate }} · {{ selectedSlot.localStart }} – {{ selectedSlot.localEnd }}</strong></div></template><p v-else class="summary-placeholder">{{ tr('Select an available time to review the lesson details.', '选择一个可预约时段，即可查看课程详情。') }}</p><button class="primary-button" :disabled="!selectedSlot || busy" @click="book">{{ busy ? copy.submitting : copy.submit }}</button><small>{{ tr('Your request reserves this time while the teacher decides.', '提交后，该时段会被保留，等待老师处理。') }}</small></aside></div></template>
      </section>
    </section>
  </div>
  <div v-if="toast" class="toast" role="status">{{ toast }}</div>
</template>
