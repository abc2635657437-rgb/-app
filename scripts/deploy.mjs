#!/usr/bin/env node
// 一键上线：触发部署 → 轮询到新版本真的 live → 健康检查 → 冒烟。
//
// 用法：
//   node scripts/deploy.mjs                       # 默认项目 travel-world
//   node scripts/deploy.mjs travel-world --smoke  # 发完顺带跑冒烟
//   node scripts/deploy.mjs travel-world --hook https://api.render.com/deploy/srv-...
//   node scripts/deploy.mjs --list
//
// 两种触发方式：
//   1. Render API（推荐）：项目配了 render.serviceId + 环境变量 RENDER_API_KEY，
//      直接 POST /deploys 并轮询 GET /deploys/{id}，能确认"live"而不只是"服务活着"。
//   2. Deploy Hook：--hook 参数 > 环境变量 <hookEnv> > deploy.hooks.json > DEPLOY_HOOK。
//      hook 只能触发，拿不到部署状态，所以只能按 --wait 秒数等。
// deploy.hooks.json 已在 .gitignore 里，不会被提交；RENDER_API_KEY 只从环境变量读。
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'deploy.config.json');
const HOOKS_PATH = path.join(ROOT, 'deploy.hooks.json');
const RENDER_API = 'https://api.render.com/v1';

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`读不了 ${path.relative(ROOT, file)}：${error.message}`);
  }
}

function parseArgs(argv) {
  const options = { project: null, hook: '', wait: 0, smoke: false, list: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') options.list = true;
    else if (arg === '--smoke') options.smoke = true;
    else if (arg === '--hook') options.hook = argv[++index] || '';
    else if (arg === '--wait') options.wait = Number(argv[++index] || 0);
    else if (arg.startsWith('--hook=')) options.hook = arg.slice('--hook='.length);
    else if (arg.startsWith('--wait=')) options.wait = Number(arg.slice('--wait='.length) || 0);
    else if (!arg.startsWith('-') && !options.project) options.project = arg;
  }
  return options;
}

function resolveHook(projectName, project, cliHook) {
  if (cliHook) return { hook: cliHook, from: '--hook' };
  if (project.hookEnv && process.env[project.hookEnv]) {
    return { hook: process.env[project.hookEnv], from: `环境变量 ${project.hookEnv}` };
  }
  if (existsSync(HOOKS_PATH)) {
    const hooks = readJson(HOOKS_PATH);
    if (hooks[projectName]) return { hook: hooks[projectName], from: 'deploy.hooks.json' };
  }
  if (process.env.DEPLOY_HOOK) return { hook: process.env.DEPLOY_HOOK, from: '环境变量 DEPLOY_HOOK' };
  return null;
}

function localSecrets() {
  const file = path.join(ROOT, 'deploy.local.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

// 优先环境变量，其次本机 deploy.local.json（已 gitignore），都不写进仓库。
function renderKey(project) {
  const envName = project.render?.apiKeyEnv || 'RENDER_API_KEY';
  const key = process.env[envName] || localSecrets().renderApiKey || '';
  return { key, envName };
}

async function renderApi(project, method, pathname, body) {
  const { key, envName } = renderKey(project);
  if (!key) throw new Error(`没有 ${envName} 环境变量，也没有 deploy.local.json 里的 renderApiKey`);
  const response = await fetch(`${RENDER_API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = (await response.text()).trim();
  if (!response.ok) {
    throw new Error(`Render API ${method} ${pathname} → HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function deployViaRender(project) {
  const sid = project.render.serviceId;
  const timeoutSeconds = project.render.timeoutSeconds || 900;
  const deploy = await renderApi(project, 'POST', `/services/${sid}/deploys`, { clearCache: 'do_not_clear' });
  const sha = deploy.commit?.id ? deploy.commit.id.slice(0, 7) : '?';
  const firstLine = (deploy.commit?.message || '').split('\n')[0];
  console.log(`  已触发：${deploy.id} · commit ${sha}${firstLine ? ` · ${firstLine}` : ''}`);

  const deadline = Date.now() + timeoutSeconds * 1000;
  let last = '';
  while (Date.now() < deadline) {
    await sleep(10000);
    const current = await renderApi(project, 'GET', `/services/${sid}/deploys/${deploy.id}`);
    if (current.status !== last) {
      console.log(`  ${new Date().toLocaleTimeString()} ${current.status}`);
      last = current.status;
    }
    if (current.status === 'live') return { ok: true, deploy: current };
    if (['build_failed', 'update_failed', 'canceled', 'deactivated'].includes(current.status)) {
      const detail = current.status === 'build_failed' ? current.buildCommand || '' : '';
      return { ok: false, deploy: current, reason: `${current.status}${detail ? ` · ${detail}` : ''}` };
    }
  }
  return { ok: false, reason: `超时 ${timeoutSeconds}s，最后状态 ${last || '未知'}` };
}

async function triggerHook(project, resolved) {
  // Render 的 Deploy Hook 同时接受 GET 和 POST，先 POST，405/404 再退回 GET。
  let response = await fetch(resolved.hook, { method: 'POST' });
  if (response.status === 405 || response.status === 404) {
    response = await fetch(resolved.hook, { method: 'GET' });
  }
  const text = (await response.text()).trim();
  return { ok: response.ok, status: response.status, body: text.slice(0, 500) };
}

async function waitForHealth(site, healthPath, timeoutSeconds) {
  const url = new URL(healthPath || '/api/health', site).toString();
  const deadline = Date.now() + timeoutSeconds * 1000;
  let last = 'no response yet';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
      const text = (await response.text()).trim();
      last = `HTTP ${response.status} ${text.slice(0, 120)}`;
      if (response.ok) return { ok: true, detail: last };
    } catch (error) {
      last = error.message;
    }
    await sleep(10000);
  }
  return { ok: false, detail: last };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = readJson(CONFIG_PATH);
  const projects = config.projects || {};
  const names = Object.keys(projects);

  if (options.list) {
    console.log(`可上线项目（${names.length}）：`);
    for (const name of names) {
      const project = projects[name];
      const hook = resolveHook(name, project, '');
      const { key, envName } = renderKey(project);
      const api = project.render?.serviceId ? (key ? `已就绪（${envName}）` : `缺 ${envName}`) : '未配置';
      console.log(`  - ${name.padEnd(16)} ${project.site || '(未配置 site)'}  API: ${api}  hook: ${hook ? '已配置' : '缺失'}`);
    }
    console.log('\n加项目：在 deploy.config.json 里加一条，再配 render.serviceId（+ 环境变量）或 hook。');
    return 0;
  }

  const name = options.project || names[0];
  const project = projects[name];
  if (!project) {
    console.error(`没有项目 ${name}。已有：${names.join(', ') || '(空)'}`);
    return 1;
  }

  let deployed = false;
  const useApi = project.render?.serviceId && !options.hook && renderKey(project).key;

  if (useApi) {
    console.log(`触发上线：${name}（Render API）`);
    console.log(`  站点：${project.site || '(未配置)'}`);
    try {
      const result = await deployViaRender(project);
      if (!result.ok) {
        console.error(`  部署未成功：${result.reason}`);
        return 1;
      }
      console.log(`  部署完成：${result.deploy.id} · ${result.deploy.status}`);
      deployed = true;
    } catch (error) {
      console.error(`  触发失败：${error.message}`);
      return 1;
    }
  } else {
    const resolved = resolveHook(name, project, options.hook);
    if (!resolved) {
      const { envName } = renderKey(project);
      console.error(
        [
          `项目 ${name} 既没有 Render API 凭据（${envName}），也没有部署 hook，发不出去。`,
          '',
          '任选一种：',
          `  1. 设环境变量 ${envName}=rnd_…，或写进 deploy.local.json：{ "renderApiKey": "rnd_…" }（Render → Account Settings → API Keys）`,
          `  2. 把 Deploy Hook 写进 deploy.hooks.json：{ "${name}": "https://api.render.com/deploy/srv-…" }`,
          `  3. 临时用：node scripts/deploy.mjs ${name} --hook "https://api.render.com/deploy/srv-…"`,
        ].join('\n'),
      );
      return 2;
    }
    console.log(`触发上线：${name}（Deploy Hook）`);
    console.log(`  站点：${project.site || '(未配置)'}`);
    console.log(`  hook：来自${resolved.from}`);
    const result = await triggerHook(project, resolved);
    if (!result.ok) {
      console.error(`  触发失败：HTTP ${result.status} ${result.body}`);
      return 1;
    }
    console.log(`  已触发：HTTP ${result.status}${result.body ? ` · ${result.body}` : ''}`);
    if (options.wait > 0) {
      console.log(`\n等 ${options.wait} 秒让新版本起来…`);
      await sleep(options.wait * 1000);
    }
    deployed = true;
  }

  if (!deployed) return 1;

  if (options.wait > 0 || options.smoke || useApi) {
    const health = await waitForHealth(project.site, project.health, Math.max(options.wait, 120));
    console.log(`健康检查：${health.ok ? '通过' : '未通过'} · ${health.detail}`);
    if (!health.ok) return 1;
  }

  if (options.smoke && project.smoke) {
    const smokePath = path.join(ROOT, project.smoke);
    if (existsSync(smokePath)) {
      console.log(`\n冒烟：node ${project.smoke} ${project.site}`);
      const run = spawnSync(process.execPath, [smokePath, project.site], { cwd: ROOT, stdio: 'inherit' });
      if (run.status !== 0) {
        console.error('冒烟未通过。');
        return 1;
      }
    } else {
      console.warn(`冒烟脚本不存在：${project.smoke}`);
    }
  }

  console.log('\n上线流程结束。');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.message);
    process.exit(1);
  },
);
