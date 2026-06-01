# Prelog

Prelog 是一个基于 Next.js、TypeScript、PostgreSQL、Prisma 和 Pretext 的个人博客系统。它包含前台博客、后台管理、文章编辑、评论审核、搜索、访问统计、站点设置、暗色/亮色主题，以及基于 Pretext 的阅读和编辑体验增强。

## 技术栈

- Next.js 16 / React 19
- TypeScript
- PostgreSQL
- Prisma 7
- NextAuth
- Vitest
- Playwright
- Framer Motion
- Pretext

## 功能

- 前台：首页、文章详情、分类、标签、搜索、关于页
- 后台：登录、文章管理、分类管理、标签查看、评论审核、站点设置
- Markdown 写作：实时预览、编辑建议、本地草稿恢复
- 中文标题拼音 slug 生成
- 评论审核：回复、蜜罐字段、垃圾评论评分
- 搜索：标题、slug、摘要、正文、分类、标签综合匹配并按相关度排序
- 访问统计：首页后台看板展示页面访问数据
- 主题切换：亮色/暗色
- 动态构建策略：生产构建不依赖数据库在线，页面在运行期动态查询数据

## 环境变量

复制 `.env.example` 为 `.env`：

```sh
cp .env.example .env
```

在 Windows PowerShell 中可以使用：

```powershell
Copy-Item .env.example .env
```

必填变量：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prelog?schema=public"
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/prelog_test?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://127.0.0.1:3000"
ADMIN_PATH="/admin"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-strong-password"
```

说明：

- `DATABASE_URL`：运行环境数据库连接串。
- `DATABASE_URL_TEST`：集成测试和 E2E 测试使用的独立测试库。连接串必须包含 `test`，测试脚本会拒绝清理非测试库。
- `AUTH_SECRET`：NextAuth 会话签名密钥，生产环境必须使用足够长的随机值。
- `NEXTAUTH_URL`：站点访问地址。本地通常是 `http://127.0.0.1:3000`，生产环境应改成正式域名。
- `ADMIN_PATH`：后台入口别名，例如 `/studio-x9`。应用内部仍使用 `/admin` 路由结构，对外访问走该别名。
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`：只在执行 seed 时注入数据库。后续在后台修改管理员邮箱或密码，不会回写 `.env`。再次执行 seed 会用 `.env` 的值覆盖管理员账号。

生成强随机 `AUTH_SECRET`：

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

如果环境里有 OpenSSL，也可以使用：

```sh
openssl rand -base64 32
```

## 本地开发

安装依赖：

```sh
npm install
```

生成 Prisma Client：

```sh
npm run prisma:generate
```

执行数据库迁移：

```sh
npm run prisma:migrate
```

初始化管理员、站点设置和示例数据：

```sh
npm run prisma:seed
```

启动开发服务：

```sh
npm run dev
```

打开 `http://127.0.0.1:3000`。

## 测试

测试分为三层：

- 单元测试：纯业务逻辑，不访问数据库。
- 集成测试：使用真实 Prisma + PostgreSQL，访问 `DATABASE_URL_TEST`。
- E2E 测试：使用 Playwright 启动浏览器和 Next 服务，访问 `DATABASE_URL_TEST`。

首次运行 E2E 前安装 Playwright 浏览器：

```sh
npx playwright install chromium
```

运行单元测试：

```sh
npm run test:unit
```

运行集成测试：

```sh
npm run test:integration
```

运行 E2E 测试：

```sh
npm run test:e2e
```

运行全部测试：

```sh
npm test
```

发布前完整检查（不包含构建）：

```sh
npm run check:ci
```

发布前完整检查并构建：

```sh
npm run test:ci
```

`check:ci` 会依次运行 lint、typecheck、单元测试、集成测试和 E2E 测试。`test:ci` 会在 `check:ci` 通过后再执行 build。

## 生产部署

当前项目采用动态渲染策略：`layout`、首页、关于页、文章页、分类页、标签页、搜索页和后台页面都会在运行期查询数据库。因此 `npm run build` 不要求生产数据库在线，但生产服务启动后必须能访问 `DATABASE_URL`。

推荐部署流程：

1. 准备 PostgreSQL 数据库。
2. 配置生产环境变量：
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL`
   - `ADMIN_PATH`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. 安装依赖：

```sh
npm ci
```

4. 构建应用：

```sh
npm run build
```

5. 对生产数据库执行迁移：

```sh
npx prisma migrate deploy
```

6. 首次部署时执行 seed：

```sh
npm run prisma:seed
```

7. 启动生产服务：

```sh
npx next start
```

部署平台配置示例：

```text
Install Command: npm ci
Build Command: npm run build
Start Command: npx next start
```

## GitHub Actions 自动部署

仓库包含 `.github/workflows/deploy.yml`，用于在 push 到 `main` 后自动检查并部署到服务器。

流程：

1. GitHub Actions 启动 PostgreSQL 测试服务。
2. 执行 `npm ci`。
3. 安装 Playwright Chromium。
4. 执行 `npm run check:ci`。
5. 检查通过后，GitHub Actions 执行 `npm run build` 并打包 `.next/standalone` 产物。
6. GitHub Actions 通过 SSH 上传产物压缩包到服务器。
7. 服务器解压到 `DEPLOY_PATH/releases/<commit-sha>`，复制服务器本地维护的 `.env` / `.env.production`。
8. 服务器执行生产数据库迁移，切换 `DEPLOY_PATH/current` 软链接，并通过 PM2 启动或重载 `server.js`。

服务器前置条件：

- 已安装 Node.js 24 或兼容版本。
- 已安装 PM2。
- 已安装 `tar`、`bash`、`ssh` 等基础命令。
- 服务器可以访问生产 PostgreSQL。
- `DEPLOY_PATH` 目录存在，且部署用户有写入权限。
- `DEPLOY_PATH/.env` 或 `DEPLOY_PATH/.env.production` 已经配置好生产环境变量。
- Nginx 反向代理到 PM2 使用的 `127.0.0.1:3000`，或按需调整 workflow 中的 `PORT`。
- PM2 首次可以由 workflow 自动创建应用；也可以提前手动创建，例如：

```sh
pm2 start "npx next start -p 3000" --name prelog
pm2 save
```

GitHub 仓库需要配置以下 Secrets：

```text
DEPLOY_HOST     服务器 IP 或域名
DEPLOY_USER     SSH 用户名
DEPLOY_KEY      SSH 私钥内容
DEPLOY_PATH     服务器上的项目目录，例如 /var/www/prelog
DEPLOY_PORT     SSH 端口，可选，默认 22
PM2_APP_NAME    PM2 应用名，可选，默认 prelog
```

部署 job 在服务器上执行的核心动作：

```sh
tar -xzf "$REMOTE_TAR" -C "$RELEASE_DIR"
ln -sfn "$RELEASE_DIR" "$DEPLOY_PATH/current"
node node_modules/prisma/build/index.js migrate deploy --config ./prisma.config.ts
pm2 startOrReload ecosystem.config.cjs --update-env
```

注意：

- `DEPLOY_KEY` 对应的公钥需要加入服务器用户的 `~/.ssh/authorized_keys`。
- 生产 `.env` 不应该由 GitHub Actions 写入服务器，建议直接在服务器上维护。
- 当前工作流按 PM2 部署编写。如果服务器使用 Docker、systemd 或面板托管，需要替换 deploy job 的远程命令。

注意：

- `prisma migrate deploy` 应在生产数据库上执行，用于应用已提交的迁移。
- `prisma:seed` 会创建或更新固定管理员账号、站点设置和示例文章。生产环境首次初始化后，如果已经在后台修改过管理员账号，重复执行 seed 会按 `.env` 覆盖管理员邮箱和密码。
- 因为页面运行期查库，生产服务必须能持续访问数据库。
- `ADMIN_PATH` 不是权限机制，只是隐藏后台入口；真正的后台访问仍依赖 NextAuth 登录态。

## 常用脚本

```sh
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm test
npm run check:ci
npm run test:ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio
```

## 项目结构

```text
src/
  app/            Next.js App Router 页面、API Route 和 Server Actions
  components/     前后台共享组件和阅读体验组件
  lib/            Prisma 访问、校验、搜索、编辑分析、业务 helper
  types/          类型扩展
prisma/
  migrations/     数据库迁移
  seed.ts         初始化脚本
scripts/          本地维护脚本
tests/
  e2e/            Playwright E2E 测试
  helpers/        测试数据库 reset 和 seed helper
  integration/    Prisma/PostgreSQL 集成测试
```

## 设计约定

- Prisma Client 生成到 `src/generated/prisma/`，不提交到仓库。
- 失败应清晰暴露，不添加静默 fallback 或 mock 成功路径。
- 搜索排序目前在应用层实现，没有使用 PostgreSQL 全文索引。
- 测试数据库必须和开发/生产数据库隔离。

## License

MIT. See [LICENSE](./LICENSE).
