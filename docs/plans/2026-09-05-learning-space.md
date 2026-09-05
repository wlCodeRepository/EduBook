# Learning Space Implementation Plan

**Goal:** 将学生预约变成轻量数字教室、日期带、连续课时与课程票的一体化体验。
**Architecture:** Vue 组件分离。CSS 3D 教室不依赖 WebGL 或外部模型；日期候选按 UTC 实际时间递增并转换到查看者时区，规避 DST 不存在/重复时间。连续课程以单个完整区间创建，数据库保存预约当时的单节时长与节数。
**Tech Stack:** Vue 3 / TypeScript / CSS 3D / Supabase PostgreSQL。

## 设计

奶油纸 #f7f5ee、石墨 #252c2d、湖青 #63d9ce、淡蓝 #dce7ee、木色 #ccab80。显示标题用 Trebuchet MS，正文系统 sans，时间 monospace。特色是可切换老师姓名牌的立体教室；功能层不使用3D点击目标。学生/老师顶部导航替代后台侧栏，管理员保留高效目录。手机教室缩小、时间控件单列，reduced-motion关闭视角动画。

## Task 1: Continuous booking

Files: 新建版本化SQL、SQL回归脚本与接口文档。
先补整倍数课时、区间冲突及历史快照的断言，再实现 create_booking；保留原鉴权、15分钟起点和排他约束。不改变现有行的时间或状态。部署迁移之前不得宣称线上连续课时可用。

## Task 2: Booking studio

Files: src/components/BookingStudio.vue、src/lib/booking-studio.ts 及测试。
先测试整段占用、15分钟起点、跨日和DST；按实际UTC生成一天候选，日期带按本地日翻页。时长1至8节，冲突长度禁选；时间/老师切换清除旧选择。一次submit发出完整区间，繁忙时禁用重复提交。

## Task 3: Learning room and shell

Files: src/components/LearningRoom.vue、src/learning-space.css、src/App.vue。
CSS几何构成立体桌椅/书本/灯/墙面。师生顶栏、老师日历与学生场景统一；管理员保留目录。所有表单可键盘操作，视觉不是预约前提。

## Task 4: Integration and verification

接入现有book接口，刷新冲突后保留明确提示。更新视觉夹具与文档；运行npm test、npm run typecheck、npm run build、git diff --check，桌面/手机截图检查。工作仅在 codex/learning-space 分支；本轮不自动合并主分支，迁移与发布需记录实际状态。

## 续接与完成记录

2026-09-05 17:11 额度重置后续接，保留中断前全部改动。四任务实现及本地验证已完成，详见 `docs/verification/2026-09-05-learning-space.md`。变更仅在 `codex/learning-space` 分支，不自动合并、迁移或发布生产环境。若继续发布，必须先审阅迁移与回退文档，在真实Supabase验证后再发布前端；不要重复本轮实现。
