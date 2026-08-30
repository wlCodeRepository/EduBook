export type Language = 'en' | 'zh'

export const messages = {
  en: {
    workspace: 'Course booking workspace',
    loginTitle: 'Put every lesson in the right place.',
    signupTitle: 'Create your EduBook account.',
    intro: 'Meet the right teacher, across any timezone.',
    name: 'Your name', email: 'Email', password: 'Password', role: 'I am a', student: 'Student', teacher: 'Teacher', timezone: 'Your timezone',
    detectedTimezone: 'Detected timezone — you can change it', login: 'Sign in to EduBook →', signup: 'Create account →', processing: 'Working…',
    noAccount: 'New to EduBook? Create an account', hasAccount: 'Already have an account? Sign in',
    connected: 'Live Supabase connection', booking: 'Book a lesson', myBookings: 'My bookings', manage: 'Manage bookings', schedule: 'Schedule settings', signOut: 'Sign out',
    findLesson: 'Find the right lesson', featured: 'Featured teachers', choose: 'Choose a time that works for you', calendar: 'Availability', shownIn: 'Shown in your timezone',
    bookingConfirm: 'Booking request', pending: 'Pending confirmation', selectTime: 'Select a time to continue', teacherTime: 'Teacher local time', yourTime: 'Your time', submit: 'Submit request →', submitting: 'Submitting…',
    noTeachers: 'No teachers have joined yet', noSlots: 'No available times in this window', noBookings: 'No bookings yet', retry: 'Try again',
    teacherDesk: 'Teacher workspace', applications: 'Booking requests', pendingCount: 'pending requests', confirm: 'Confirm', reject: 'Reject', cancel: 'Cancel',
    fixedTimes: 'Weekly availability', lessonSettings: 'Lesson settings', minutes: 'Minutes per lesson', blocked: 'Blocked periods', add: 'Add', remove: 'Remove', save: 'Save',
    language: '中文', setupMissing: 'Supabase is not configured for this deployment yet.',
  },
  zh: {
    workspace: '课程预约工作台', loginTitle: '把每一次学习，安排在合适的时间。', signupTitle: '创建你的 EduBook 账户。', intro: '跨越时区，也能和合适的老师从容见面。',
    name: '你的称呼', email: '邮箱', password: '密码', role: '你的身份', student: '学生', teacher: '老师', timezone: '你的时区', detectedTimezone: '已自动识别时区，可修改', login: '登录 EduBook →', signup: '创建账户 →', processing: '处理中…', noAccount: '还没有账户？创建一个', hasAccount: '已有账户？返回登录', connected: 'Supabase 实时连接', booking: '预约课程', myBookings: '我的预约', manage: '预约管理', schedule: '排期设置', signOut: '退出', findLesson: '找到适合你的课堂', featured: '精选老师', choose: '选择一个适合你的时间', calendar: '可预约时间', shownIn: '按你的时区显示', bookingConfirm: '预约确认', pending: '待确认', selectTime: '选择时间后继续', teacherTime: '老师当地时间', yourTime: '你的时间', submit: '提交预约申请 →', submitting: '提交中…', noTeachers: '还没有老师入驻', noSlots: '这段时间暂无可预约时段', noBookings: '还没有预约记录', retry: '重试', teacherDesk: '老师工作台', applications: '预约申请', pendingCount: '条待处理', confirm: '确认', reject: '拒绝', cancel: '取消', fixedTimes: '固定授课时间', lessonSettings: '课程设置', minutes: '每节课分钟数', blocked: '不可预约时段', add: '添加', remove: '移除', save: '保存', language: 'EN', setupMissing: '当前部署尚未配置 Supabase。',
  },
} as const
