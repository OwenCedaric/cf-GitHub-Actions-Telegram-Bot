# GitHub Actions Telegram Bot

通过 Telegram 界面触发多个 GitHub 账号和仓库的 Actions。

## 前置条件

- **Telegram 机器人 Token**: 从 [@BotFather](https://t.me/botfather) 获取。
- **GitHub 个人访问令牌 (PAT)**:
    - **Classic Token (经典)**: 勾选 `repo` (或 `public_repo`) 和 `workflow` 权限。
    - **Fine-grained Token (精细化)**: 
        - `Actions`: **Read and write** (读写)
        - `Metadata`: **Read-only** (只读)
- **Telegram 用户 ID**: 用于鉴权，确保只有你能触发机器人。

> [!NOTE]
> 触发 Action 是**异步执行**的。机器人仅反馈请求是否成功发送给 GitHub，不会通知 Action 的最终执行结果。如需执行结果反馈，请在你的 Workflow 文件末尾添加通知步骤。

## 快速开始

### 1. 配置项 (`CONFIG_JSON`)

在 Cloudflare Secrets 中设置统一配置：

```bash
npx wrangler secret put CONFIG_JSON
```

**JSON 结构示例：**

```json
{
  "github": [
    {
      "github_token": "ghp_your_token_1",
      "owner": "账号1",
      "repos": [
        { "name": "项目A", "alias": "web", "workflow": "main.yml", "branch": "main" },
        "项目B"
      ]
    }
  ]
}
```

### 2. 部署

```bash
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put ALLOWED_USER_ID
npm run deploy
```

### 3. 设置 Webhook 与 菜单命令 (初始化)
部署完成后，在浏览器中访问 Worker 的初始化地址：
```
https://你的域名.workers.dev/init
```
此操作将自动：
1.  将 Telegram 机器人关联到 Worker。
2.  将配置中的 **别名 (alias)** 注册为菜单快捷命令（例如 `/deploy_web`）。

或者使用 `curl` 手动设置：

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://你的域名.workers.dev/"
```

## GitHub Actions 自动部署 (CI/CD)

若要自动部署此机器人，请在 GitHub 仓库中配置以下 Secrets：

- `CLOUDFLARE_API_TOKEN`: Cloudflare 令牌。
- `TG_BOT_TOKEN`: Telegram 机器人 Token。
- `ALLOWED_USER_ID`: 授权的电报 ID。
- `CONFIG_JSON`: 统一的 JSON 配置。

## 使用方法

在 Telegram 中发送以下命令：

- `/deploy <别名|仓库> [工作流文件名] [分支]`
- **示例**: `/deploy web`

## 许可证

MIT
