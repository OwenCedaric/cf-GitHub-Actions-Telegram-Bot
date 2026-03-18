export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GET /init: Automatically set Telegram Webhook and Register Commands
    if (request.method === "GET" && url.pathname === "/init") {
      return await handleInit(request, env);
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const update = await request.json();
      if (!update.message || !update.message.text) {
        return new Response("OK");
      }

      const chatId = update.message.chat.id;
      let text = update.message.text;
      const userId = update.message.from.id.toString();

      // Authorization Check
      if (env.ALLOWED_USER_ID && userId !== env.ALLOWED_USER_ID) {
        await sendMessage(chatId, "Unauthorized user 🚫", env.TG_BOT_TOKEN);
        return new Response("OK");
      }

      // Handle shortcuts like /deploy_alias -> /deploy alias
      if (text.startsWith("/deploy_")) {
        const alias = text.split(" ")[0].replace("/deploy_", "");
        const rest = text.split(" ").slice(1).join(" ");
        text = `/deploy ${alias} ${rest}`.trim();
      }

      // /start command
      if (text === "/start") {
        await sendMessage(chatId, "Welcome! \n\nUsage:\n/deploy <alias|repo> [workflow] [branch]\n\nExample:\n/deploy web build.yml main\n/deploy owner/repo dispatch.yml", env.TG_BOT_TOKEN);
      } 
      // /deploy command
      else if (text.startsWith("/deploy")) {
        await handleDeploy(chatId, text, env);
      }

      return new Response("OK");
    } catch (error) {
      console.error(error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

async function handleInit(request, env) {
  const url = new URL(request.url);
  const webhookUrl = `${url.protocol}//${url.host}/`;
  
  // 1. Set Webhook
  const setWebhookUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  const webhookRes = await (await fetch(setWebhookUrl)).json();

  // 2. Set Commands based on CONFIG_JSON
  const config = parseConfig(env.CONFIG_JSON);
  const commands = [
    { command: "start", description: "Show help and usage" },
    { command: "deploy", description: "Trigger a deployment: /deploy <alias|repo>" }
  ];

  if (config && config.github) {
    config.github.forEach(account => {
      (account.repos || []).forEach(repoInfo => {
        if (typeof repoInfo === "object" && repoInfo.alias) {
          // Telegram commands must be lowercase, digits, and underscores only
          const sanitizedAlias = repoInfo.alias.toLowerCase().replace(/[^a-z0-9_]/g, "_");
          commands.push({
            command: `deploy_${sanitizedAlias}`,
            description: `Trigger ${repoInfo.name}` // Hidden owner
          });
        }
      });
    });
  }

  const setCommandsUrl = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/setMyCommands`;
  const commandsRes = await (await fetch(setCommandsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands })
  })).json();

  return new Response(JSON.stringify({ webhook: webhookRes, commands: commandsRes }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}

// ... (Rest of handleDeploy, parseConfig, resolveRepo, triggerAction, sendMessage remain the same)

async function handleDeploy(chatId, text, env) {
  const parts = text.split(" ");
  if (parts.length < 2) {
    await sendMessage(chatId, "Missing repo name or alias. Usage: /deploy <alias|repo> [workflow] [branch]", env.TG_BOT_TOKEN);
    return;
  }

  const target = parts[1];
  let workflow = parts[2] || "main.yml";
  let branch = parts[3] || "main";

  const config = parseConfig(env.CONFIG_JSON);
  const resolved = resolveRepo(target, config);

  if (!resolved) {
    let owner, repo;
    if (target.includes("/")) {
      [owner, repo] = target.split("/");
    } else {
      owner = env.OWNER;
      repo = env.REPO;
    }

    if (!owner || !repo) {
      await sendMessage(chatId, `❌ Unknown target: ${target}. Please check your CONFIG_JSON.`, env.TG_BOT_TOKEN);
      return;
    }

    const token = env.GH_TOKEN;
    if (!token) {
      await sendMessage(chatId, `❌ No token found. Please configure GH_TOKEN or CONFIG_JSON.`, env.TG_BOT_TOKEN);
      return;
    }

    await triggerAction(chatId, token, owner, repo, workflow, branch, env.TG_BOT_TOKEN);
  } else {
    const { owner, repo, github_token, default_workflow, default_branch } = resolved;
    workflow = parts[2] || default_workflow || workflow;
    branch = parts[3] || default_branch || branch;

    await triggerAction(chatId, github_token, owner, repo, workflow, branch, env.TG_BOT_TOKEN);
  }
}

function parseConfig(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (e) {
    console.error("Invalid CONFIG_JSON", e);
    return null;
  }
}

function resolveRepo(target, config) {
  if (!config || !config.github) return null;

  for (const account of config.github) {
    if (!account.repos) continue;
    
    for (const repoInfo of account.repos) {
      const isObject = typeof repoInfo === "object";
      const repoName = isObject ? repoInfo.name : repoInfo;
      const alias = isObject ? repoInfo.alias : null;
      const fullPath = `${account.owner}/${repoName}`;

      // Case-insensitive matching for alias
      const matchAlias = alias && target.toLowerCase() === alias.toLowerCase();
      const matchPath = target.toLowerCase() === fullPath.toLowerCase();
      const matchName = !target.includes("/") && target.toLowerCase() === repoName.toLowerCase();

      if (matchAlias || matchPath || matchName) {
        return {
          owner: account.owner,
          repo: repoName,
          github_token: account.github_token,
          default_workflow: isObject ? repoInfo.workflow : null,
          default_branch: isObject ? repoInfo.branch : null
        };
      }
    }
  }
  return null;
}

async function triggerAction(chatId, token, owner, repo, workflow, branch, tgToken) {
  await sendMessage(chatId, `🚀 Triggering GitHub Action...\nRepo: ${owner}/${repo}\nWorkflow: ${workflow}\nBranch: ${branch}`, tgToken);

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-UnifiedBot"
      },
      body: JSON.stringify({ ref: branch })
    });

    if (response.status === 204) {
      await sendMessage(chatId, `✅ Successfully triggered!`, tgToken);
    } else {
      await sendMessage(chatId, `❌ Failed with status ${response.status}.`, tgToken);
    }
  } catch (err) {
    await sendMessage(chatId, `❌ Error: ${err.message}`, tgToken);
  }
}

async function sendMessage(chatId, text, token) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });
}
