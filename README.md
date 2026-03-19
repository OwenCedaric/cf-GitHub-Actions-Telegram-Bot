# GitHub Actions Telegram Bot

Trigger GitHub Actions across multiple accounts and repositories via a sleek Telegram interface.

## Prerequisites

- **Telegram Bot Token**: Get it from [@BotFather](https://t.me/botfather).
- **GitHub Personal Access Token**:
    - **Classic Token**: Scopes `repo` (or `public_repo`) and `workflow`.
    - **Fine-grained Token** (Recommended): 
        - `Actions`: **Read and write**
        - `Metadata`: **Read-only**
- **Telegram User ID**: To restrict access to your account only.

> [!NOTE]
> Triggering an action is **asynchronous**. The bot confirms the request was sent to GitHub, but won't notify you on completion. To get status feedback, add a notification step to your workflow file.

## Quick Start

### 1. Configuration (`CONFIG_JSON`)

Set your unified configuration in Cloudflare Secrets:

```bash
npx wrangler secret put CONFIG_JSON
```

**JSON Structure Example:**

```json
{
  "github": [
    {
      "github_token": "ghp_your_token_1",
      "owner": "account1",
      "repos": [
        { "name": "project-foo", "alias": "foo", "workflow": "main.yml", "branch": "main" },
        "project-bar"
      ]
    }
  ]
}
```

### 2. Deployment

```bash
npx wrangler secret put TG_BOT_TOKEN
npx wrangler secret put ALLOWED_USER_ID
npm run deploy
```

### 3. Register Webhook & Commands
Simply visit your worker's initialization URL in your browser:
```
https://your-worker.workers.dev/init
```
This will automatically:
1.  Connect your Telegram Bot to the Worker.
2.  Register your **aliases** as shortcut commands in the Bot menu (e.g., `/deploy_web`).

## GitHub Actions Deployment (CI/CD)

To automate deployment of this worker, add these Secrets to your GitHub repository:

- `CLOUDFLARE_API_TOKEN`: Your Cloudflare API Token.
- `TG_BOT_TOKEN`: Your Telegram Bot Token.
- `ALLOWED_USER_ID`: Your authorized Telegram ID.
- `CONFIG_JSON`: The unified JSON configuration.

## Usage

Send the following command to your bot:

- `/deploy <alias|repo> [workflow] [branch]`
- **Example**: `/deploy web`

## License

MIT
