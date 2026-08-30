# Supabase 本地开发

## 前置条件

- Node.js 22 或更高版本
- Docker Desktop（Supabase CLI 的本地服务依赖 Docker）
- Supabase CLI

在项目根目录执行：

```bash
npx supabase init
npx supabase start
```

`supabase init` 只需要执行一次。生成的 `supabase/config.toml` 用于本地开发配置；不要把本地密钥、数据库密码或服务端 Token 写入前端文件。

## 环境变量

复制根目录模板：

```bash
cp .env.example .env.local
```

Windows PowerShell 可执行：

```powershell
Copy-Item .env.example .env.local
```

本地启动后，用 `npx supabase status` 查看本地 API URL 和 anon key，再填入 `.env.local`。`VITE_` 前缀变量会进入浏览器构建产物，因此只能放 Supabase anon public key；`service_role` key 和邮件服务 Token 只能放在 Supabase Secrets：

```bash
npx supabase secrets set RESEND_API_KEY=replace-with-local-or-project-secret
```

不要提交 `.env.local`、`.env`、Supabase 临时目录或任何真实密钥。

## 数据库与函数

后续添加版本化迁移后，在本地执行：

```bash
npx supabase db reset
npx supabase functions serve
```

提交迁移文件前先确认它们包含业务含义、权限边界以及回滚/恢复说明。预约写操作必须由 Edge Function 校验身份和角色，客户端不能直接持有服务端密钥。

## 停止服务

```bash
npx supabase stop
```
