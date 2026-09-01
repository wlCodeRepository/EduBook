# 管理员创建账号

EduBook 使用“管理员创建账号”模式，不使用真实邮箱注册、邮箱验证码或邮件通知。

## 首次初始化

1. 在 Supabase Dashboard 的 Authentication → Users 中创建一个初始用户，设置密码并勾选已确认邮箱。这里的邮箱只作为 Supabase Auth 的内部标识，不会用于发信。
2. 在 SQL Editor 执行：

```sql
update public.profiles
set role = 'ADMIN', username = 'admin'
where email = '你创建的内部账号邮箱';
```

3. 在 Supabase Dashboard 执行 `202609010001_admin_accounts_no_email.sql` 迁移，并部署 `admin-create-user` Edge Function。
4. 使用初始账号登录 EduBook，在“用户管理”中创建学生和老师账号。

## 账号规则

- 账号名 3–40 位，仅允许字母、数字、点、下划线和短横线。
- 密码 8–128 位。
- 管理员创建账号时服务端自动确认 Auth 身份，不触发邮件。
- 服务角色密钥只存在于 Edge Function 环境变量，不进入浏览器或仓库。
