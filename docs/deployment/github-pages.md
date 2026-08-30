# GitHub Pages 发布

仓库的 `.github/workflows/ci.yml` 在 `main` push 和 Pull Request 上执行前端验证：安装依赖、类型检查、单元测试和构建。

当前仓库尚未包含 `package.json`，所以验证 job 会明确提示并跳过 npm 命令。前端骨架加入后必须提供以下 scripts：

```json
{
  "scripts": {
    "typecheck": "vue-tsc --noEmit",
    "test:unit": "vitest",
    "build": "vite build"
  }
}
```

## 首次配置

1. 在 GitHub 仓库 Settings → Pages → Build and deployment 中选择 GitHub Actions。
2. 确认 workflow 使用 `github-pages` environment，并允许 Actions 写入 Pages。
3. 在仓库 Variables 中配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`（仅公开 anon key）。
4. 不要将 service role key、邮件 Token 或数据库密码配置为 `VITE_` 变量。

## 发布方式

默认 push 和 Pull Request 只验证，不发布。需要发布时，在 Actions 页面手动运行 `CI`，将 `deploy_pages` 设为 `true`。发布 job 会上传 `dist` 并调用 GitHub Pages deployment。

发布前验证：

```bash
npm ci
npm run typecheck
npm run test:unit -- --run
npm run build
```

GitHub Pages 是静态托管；预约写操作、邮件发送、定时提醒和密钥处理必须继续由 Supabase Auth、Edge Functions、Cron 和 Secrets 承担。
