# Learning Space 生产发布记录

## 授权与目标

用户明确授权“部署上线”。Supabase 项目 `ahhmaiazcimegsuihnrg`；Pages 地址 https://wlcoderepository.github.io/EduBook/ 。发布分支 `codex/learning-space`，前端提交 `5374edb5a5a6bf8f0e4e12017c0d854520ae7c4f`。不自动合并 main；本轮 Edge Function 参数与代码未变，不重新部署函数。

## 数据库（已完成）

- 迁移前 3 条预约，无无限起止时间，无 lesson_minutes / lesson_count 字段；原库未使用 supabase_migrations.schema_migrations，不能伪称 CLI 迁移历史已登记。
- 控制台在同一数据库的非公开 schema `edubook_release_backup` 保存 `bookings_20260905_learning_space`（3条）和 `function_20260905_learning_space`（旧函数定义1条）。这是迁移恢复副本，不是异地灾备。撤销 public/anon/authenticated 的 schema/table 权限，控制台选择额外启用 RLS。
- 通过 SQL Editor 单事务执行 `202609050001_continuous_booking.sql` 对应 DDL/函数逻辑，增加本次执行的 lock_timeout=5s、statement_timeout=30s。迁移返回 Success。
- 回填后全量 JSON 对比（去掉新增两字段）：3/3 原记录完全一致，全部快照正确。authenticated 不可执行 RPC，service_role 可执行；authenticated 不可使用备份 schema。
- 在生产库以 SET LOCAL ROLE service_role 运行事务回归：寻找一个无冲突未来区间，四节创建、重复区间拦截、确认、取消、释放重约、拒绝、单节再次预约全部通过。事务末尾 ROLLBACK，未持久化任何测试预约或通知。
- SQL Editor 的 fill 曾对虚拟编辑器局部替换，第一次回归提交语法失败，无写入；改为全选粘贴并复制回读确认完全一致后成功执行。迁移本身成功，未重复执行。

## 验证与发布

- 本轮重新执行 typecheck、47项测试（15文件）、build、git diff --check 全部通过。
- 流水线 https://github.com/wlCodeRepository/EduBook/actions/runs/33972795866 的 Verify frontend（类型检查、测试、构建、产物上传）成功，但 Pages 部署被环境保护规则拒绝：仅允许 main，不允许 codex/learning-space。未修改保护规则、未合并 main，等待用户批准合并后从 main 发布。线上前端仍是旧版。
- 浏览器当前无 EduBook 登录会话，真实 Auth/JWT 到 Edge Function 的已登录写入流程尚未本轮验证；数据库事务回归不能替代这一验证。

## 恢复注意事项

## main 合并发布续接

用户已授权合并 main 后继续上线。旧 main 已保存到 `codex/main-backup-20260905`（`e0d10f20e5898da1aeb1b9b6ac71119c1637959c`）。计划验证备份后正常合并 learning-space，再从 main 发布，不放宽 github-pages 分支保护，不重复生产数据库迁移。最终运行结果以下一条发布验收记录为准。

前端可重新发布已知上一版本，数据库优先保留新增字段和新函数以兼容旧前端单节请求。禁止直接恢复旧 RPC：旧函数不写快照，触发 NOT NULL。若必须数据库回退，遵照 docs/continuous-booking.md 的补偿迁移步骤，保留历史完整区间及备份。
