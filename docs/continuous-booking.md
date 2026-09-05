# 连续课时数据库契约

对应迭代计划 `docs/plans/2026-09-05-learning-space.md` Task 1。本变更仅新增迁移和 SQL 回归；不部署、不提交、不修改前端或 Edge Function。

## 接口与业务含义

`create_booking(p_teacher_id uuid, p_student_id uuid, p_start_at_utc timestamptz, p_end_at_utc timestamptz)` 保留四参数签名及 `public.bookings` 返回类型。调用方提交完整起止时间，不传入可被伪造的单节时长或节数。

- 单节时长取本次函数读取到的老师 `default_lesson_minutes`（5–240 整数分钟）。总时长必须恰好为其 1–8 整数倍；校验整除后才转整数，避免四舍五入放行。
- 一次预约只生成一条 `PENDING` booking 和一条创建通知，保存完整半开区间 `[start,end)`。跨日允许；时长按 UTC 实际经过时间计算。
- `bookings.lesson_minutes` 是单节分钟数快照；`lesson_count` 是节数快照。修改老师设置不会更新旧预约。
- 原有未来时间、老师/学生角色、blocked 全区间相交检查、`PENDING`/`CONFIRMED` GiST 排他约束保持。相邻预约允许，冲突返回 `23P01 / slot_unavailable`，无效时长返回 `22023 / invalid_lesson_duration`。
- 起点按 UTC 严格对齐 15 分钟，秒必须精确为零；补充拒绝 NULL、无限时间及小数秒。旧函数的小数秒整数转换可能舍入，本次消除该漏洞。

鉴权仍由 `create-booking` Edge Function 验证 JWT，并从已认证用户读取 `p_student_id`；RPC 仅授予 `service_role`，浏览器角色不能执行，也不能直接 INSERT booking。数据库函数不接受浏览器自行指定身份。原有 blocked 检查并未提供与同时新增 blocked 的跨表串行化，本迁移不扩大这一并发保证；预约之间的并发排他由原数据库约束负责。

## 历史回填与约束

迁移：`supabase/migrations/202609050001_continuous_booking.sql`。

所有历史记录按一节回填：`lesson_count = 1`，`lesson_minutes = extract(epoch from (end_at_utc-start_at_utc))/60`。不能用老师当前设置推断历史单节时长。原起止时间、状态、标识及其他列均不变。

`lesson_minutes` 使用不限精度 `numeric`，允许历史记录保留非整数分钟或超过当前老师配置上限的原始区间；除以 60 的结果遵循 PostgreSQL numeric 精度，不宣称恢复无法获知的原始设置。新 RPC 创建的快照始终为老师的整数分钟值。约束要求快照非空、分钟数正且有限、节数 1–8，以及快照乘积等于原区间分钟数。无默认值，后端绕过 RPC 的写入也必须明确提供快照。

若历史存在无限起止时间，迁移显式失败，需人工核对原数据；不会自动改写时间或推测时长。部署时需在单事务中执行，回填及约束验证会持有表锁，应在低峰安排并按数据量评估耗时。执行前备份 bookings 与原 RPC 定义；本次未连接线上数据库。

## 回归执行

一键隔离回归：`pwsh -NoProfile -File supabase/tests/run-continuous-booking.ps1`。需要Docker及postgres:17-alpine镜像；脚本无端口映射、无网络，退出时删除本次创建的临时容器及其匿名卷，不触碰其他容器。主代理在额度恢复后已复跑成功。

脚本使用 PostgreSQL 原生断言，不依赖 pgTAP；需要拥有建表、创建函数及测试角色操作权限的隔离测试库。失败即报错。基础回归和历史回填的正常结束会回滚全部测试数据；并发脚本使用独立连接提交夹具，成功或捕获异常后主动清理，若进程被强杀则应销毁测试库。

1. 测试库先按顺序执行旧迁移至 `202609010005`。
2. `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/continuous_booking_backfill.sql`：在事务内创建旧数据、引入新迁移、比对所有原列与快照，最后回滚至旧结构。
3. `psql -X -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/202609050001_continuous_booking.sql`。
4. `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/continuous_booking.sql`。
5. `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/continuous_booking_concurrency.sql`：需要 `dblink` 扩展及当前数据库管理员的本机 libpq 连接认证。使用两条真实连接，确认第二条等待未提交区间的锁，提交第一条后第二条应返回冲突，最终一条预约、一条通知。

覆盖 1–8 节、零/负/非整倍数/9 节、跨日、NULL/无限/过去时间、15 分钟及小数秒、角色错误、后续课时 blocked、相邻可约、PENDING/CONFIRMED 冲突、取消释放、配置改变后快照稳定、表约束及 RPC 权限。并发双连接验证与实际执行结果见下方验证记录。

## 恢复方案

- 未提交的迁移失败：回滚整笔事务，旧函数和表结构保留。禁止逐条自动提交执行此文件。
- 已上线后的首选恢复：暂停新预约写入，修复后追加前向迁移；保留已有连续预约及快照，不截短、不拆分、不删除已有区间。
- 必须恢复单节创建时：追加补偿迁移，将本迁移的函数时长判断改为只允许 `duration_seconds = lesson_seconds`，仍写入 `lesson_minutes` 与 `lesson_count = 1`。保留新增列、约束、原 GiST 排他约束及权限；已有多节预约照常占用完整区间及处理状态。切勿直接恢复旧函数，它不写快照，会触发 NOT NULL。
- 必须完全撤销结构时：先暂停写入并导出含快照的 bookings 及函数定义；在同一事务恢复 `202609010005` 的函数定义、移除三个新增 CHECK、再移除 `lesson_count` 和 `lesson_minutes`（不得 CASCADE）。恢复原 RPC 权限并回归鉴权/冲突后再放开写入。该路径会丢失快照含义，须保留导出备份；已有 booking 的起止和状态不变。通过新版本补偿迁移记录恢复，不删除已应用的迁移历史。

## 验证记录

2026-09-05：在无网络、无端口映射的临时 `postgres:17-alpine` Docker 容器中，按顺序执行全部既有迁移及本次迁移；三份 SQL 回归均通过，包括真实双连接锁等待与冲突、service_role 实际创建、anon/authenticated 实际调用拒绝，以及 5/240 分钟的老师时长边界。

普通 PostgreSQL 测试库使用最小 Supabase 环境替身：`anon`、`authenticated`、`service_role BYPASSRLS` 三个角色、仅含 UUID 主键的 `auth.users` 和返回 NULL UUID 的 `auth.uid()`。这能验证迁移语法、数据约束、函数权限、区间逻辑和数据库并发，不能替代真实 Supabase JWT / RLS 身份联调。线上迁移、Supabase Auth/Edge Function 联调及发布均未执行。
