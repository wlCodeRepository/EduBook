# Workspace Layout Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构 EduBook 的角色工作台，把个人资料与密码管理收口到左下角头像入口，使课表、预约与人员管理成为页面的主内容。

**Architecture:** 保留 Vue 3、Supabase 与现有权限/预约规则；把应用壳、账号菜单及个人信息弹窗从 App.vue 拆分。业务数据仍由现有加载函数提供，账号弹窗独立维护表单状态，不改变当前业务页面。最终视觉布局以当前页面截图及 Product Design 视觉方案为依据。

**Tech Stack:** Vue 3 Composition API、TypeScript、既有 CSS tokens、Supabase Auth/RPC、Vitest、Vue Test Utils。

---

## 当前实现与证据范围

### 2026-09-05 执行更新
用户提供当前老师预约页截图并明确要求直接执行，采用上文建议的紧凑侧栏工作台；不再等待视觉方案选择。截图证明主区过窄、标题过大、待处理队列混入已确认且已结束课程。执行时复用现有业务应用壳并重写其布局规则，拆分 AccountMenu、AccountCenter、TeacherBookings 三个实际交互组件，避免仅为插槽新增一层壳组件。新增预约分组测试，覆盖已结束课程不可继续确认/取消的前端操作边界。

任务1–5已完成，任务6的本地类型检查、22项测试、构建及浏览器样例检查已完成。实际路径与验证边界见 `docs/verification/2026-09-05-workspace-layout-refactor.md`。保留现有应用壳而未新增 WorkspaceShell；抽出了三个具有独立行为的组件。发布前检查远端基线，不变更后端。

工作目录：`E:/EduBook/.worktrees/course-booking-mvp`，基线提交 `8b970d3`。工作区在开始本轮时无未提交改动。

- `src/App.vue`：导航包含独立 `profile` 项；左下角头像为 span，仅退出按钮可以操作。
- `src/App.vue`：个人资料作为独立页面渲染；`saveProfile()` 通过 `update_my_profile` RPC 保存。
- `src/components/PasswordSettings.vue`：已具备密码确认、异步状态和成功清空逻辑，可复用。
- `src/components/TeacherWeek.vue`：已实现按老师时区的七日课程分布。
- `src/styles.css`：现有 238px 侧栏、48px 顶部间距、大号标题；多处 overview-hero、stat-grid 与面板叠加。
- 以上是代码事实，尚非浏览器视觉审计。内置浏览器打开站点超时，已有 Chrome 目标返回 `Debugger unattached`。未取得本轮有效截图，未生成设计图或修改 UI。

## 候选布局与建议

1. **紧凑侧栏 + 主工作区（建议）**：208px 左侧栏，头像固定底部；顶部单行页面标题/上下文操作；中央直接展示课表、列表或预约步骤。业务入口保留文字，适合各角色共享应用壳。
2. **窄导航栏 + 双列工作台**：约80px 图标栏，主内容加详情列，内容面积更大，但需要额外处理图标识别和初次使用提示。
3. **侧栏 + 主区内页签**：适合人员目录与详情切换，但业务入口较少时容易多出一层导航。

用户明确要求左下角头像，不将个人入口挪到顶部。老师首页不使用宣传横幅；本周课程为主，待处理预约为辅。管理员首页以全局数据摘要、待处理记录为主。学生预约按选老师、选时间、确认三个阶段组织。

视觉方案生成与截图对照是 Product Design 的前置要求；取得有效截图后完成该步骤，再实施下列任务。

## Task 1: 头像菜单与键盘行为

**Files:**
- Create: `src/components/AccountMenu.vue`
- Create: `src/components/AccountMenu.test.ts`
- Modify: `src/App.vue` 的 sidebar/profile-mini 区域

**Step 1: Write the failing test**

```ts
it('opens account actions from the avatar without navigating', async () => {
  const view = mount(AccountMenu, {
    props: { displayName: 'Alex', username: 'alex', roleLabel: 'Teacher', language: 'en' },
  })
  await view.get('button[aria-haspopup="menu"]').trigger('click')
  expect(view.get('[role="menu"]').text()).toContain('Personal information')
  await view.get('[data-action="password"]').trigger('click')
  expect(view.emitted('open')).toEqual([['password']])
})
```

**Step 2:** `npm run test:unit -- --run src/components/AccountMenu.test.ts`；组件未创建时预期失败。

**Step 3:** 组件接收显示名称/账号/角色/语言，发出 `open: ['profile' | 'password']` 与 `signout` 事件。头像及名称组成一个 button，菜单展示账号摘要、个人资料、修改密码、退出登录。点击外部和 Escape 关闭，菜单关闭时恢复头像焦点。使用事件监听的卸载清理；不持有密码。

**Step 4:** 增加 Escape、外部点击、键盘进入菜单、关闭恢复焦点的测试；同一命令预期全部通过。

**Step 5:** `git add src/components/AccountMenu.vue src/components/AccountMenu.test.ts src/App.vue`，提交 `feat: add avatar account menu`。

## Task 2: 个人信息弹窗

**Files:**
- Create: `src/components/AccountCenter.vue`
- Create: `src/components/AccountCenter.test.ts`
- Modify: `src/App.vue`
- Reuse: `src/components/PasswordSettings.vue`

**Step 1:** 测试头像菜单打开资料/密码对应页签、关闭后业务页保留、账号/角色只读、保存失败不关闭弹窗。

**Step 2:** `npm run test:unit -- --run src/components/AccountCenter.test.ts`；实现前预期失败。

**Step 3:** 弹窗有“个人资料”“安全”页签。资料页复用名称/时区校验与 RPC，密码页复用 PasswordSettings。统一 close 按钮、Escape、焦点约束、焦点恢复；正在保存时不允许重复提交，成功状态就地反馈。关闭时销毁密码表单。未保存的资料不被切换语言或 token 刷新覆盖。

```ts
const accountSection = ref<'profile' | 'password' | null>(null)
function openAccount(section: 'profile' | 'password') {
  accountSection.value = section
}
// 头像操作仅改变 accountSection；业务 activeNav 保持不变。
```

**Step 4:** 移除 nav 中独立 profile 项以及 `activeNav === 'profile'` 页面分支；将原有资料字段迁入组件，保存后更新 sidebar 与预约时区数据。

**Step 5:** 跑上述测试与 `npm run typecheck`；通过后提交 `refactor: move personal settings into account dialog`。

## Task 3: 应用壳和视觉层级

**Files:**
- Create: `src/components/WorkspaceShell.vue`
- Create: `src/components/WorkspaceShell.test.ts`
- Modify: `src/App.vue`
- Modify: `src/styles.css`

**Step 1:** 为各角色导航、当前项标记、标题插槽、底部账号插槽补充组件测试。
**Step 2:** `npm run test:unit -- --run src/components/WorkspaceShell.test.ts`；实现前预期失败。
**Step 3:** 按选定视觉方案实现侧栏、紧凑工具栏和主区。使用明确的 grid/flex 列宽，避免大块无意义留白。删除旧的营销式 hero，标题使用清晰的产品字体和适中的字号，保留青绿作为行动与选中状态。
**Step 4:** 合并 CSS 重复规则，替换旧定义而非追加覆盖层；不引入第二套完整 UI 库。图标使用成熟图标库，不能用文字符号绘制假图标。
**Step 5:** 测试和类型检查通过后提交 `refactor: introduce compact workspace shell`。

## Task 4: 角色主页与列表

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/TeacherWeek.vue`
- Modify: `src/styles.css`
- Create: `src/components/TeacherWeek.test.ts`

**Step 1:** 写老师课程展示测试：时区标识、学生名称、待确认与已确认状态、空课程日。
**Step 2:** `npm run test:unit -- --run src/components/TeacherWeek.test.ts`。
**Step 3:** 老师主区以本周课表为第一视觉重点；待确认预约作为相邻或下方紧凑列表。管理员以数据摘要和全局记录为主体；人员目录共用一行搜索/筛选/新增工具栏。学生预约的老师、时间与确认信息按清晰顺序展示。
**Step 4:** 将加载、空数据、失败重试分别处理；失败时不显示具有误导性的“没有老师/没有课程”。所有新增文案同时提供中英文。
**Step 5:** 保留默认开放、15分钟档位、PENDING 占用与数据库冲突保护，避免 UI 重构改变权限/预约行为；通过测试后提交。

## Task 5: 移动端和弹层

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/WorkspaceShell.vue`
- Modify: `src/components/AccountCenter.vue`
- Modify: `src/components/AppSelect.vue`（仅当截图验证发现定位问题时）

**Step 1:** 在390、768、1440像素宽度下检查布局与弹层，账号入口在移动端同样可发现。
**Step 2:** 小屏个人中心采用可滚动弹层，表单单列，触控目标不小于44px。保留关闭按钮与底层滚动控制。
**Step 3:** 验证 Tab/Shift+Tab 焦点约束、Escape、下拉选项不被裁切、无整页横向溢出。
**Step 4:** 针对发现的问题补充组件测试，修复后重测同一场景。

## Task 6: 验证、文档和发布

**Files:**
- Create: `docs/verification/2026-09-05-workspace-layout-refactor.md`
- Modify: 本计划，逐项记录完成状态

**Step 1:** `npm run typecheck`，预期退出码0。
**Step 2:** `npm run test:unit -- --run`，预期旧业务测试和新增组件测试全部通过。
**Step 3:** `npm run build`，预期退出码0。
**Step 4:** `git diff --check`，预期无空白错误。
**Step 5:** 获取各角色主页、头像菜单和个人中心的截图，与选定视觉方案同视口对照；记录浏览器、视口和真实/测试数据来源。
**Step 6:** 检查远端基线及 staged 文件范围后提交/发布前端。没有接口变更时不重新部署后端。确认 GitHub 工作流成功并核验线上新资源。

## 保持的边界

- 账号与角色不可修改，包括超级管理员。
- 人员列表排除当前超管。
- 密码不进入日志、资料表、接口返回或仓库；只提交给既有 Auth 操作。
- 此轮没有数据库结构变更；删除账号的历史保护不变。
- 截图不可取得时明确记录缺口，不将源码分析或构建成功称作视觉验收。
