#!/usr/bin/env node
// 一键上线：触发部署 → 等新版本起来 → 健康检查 → 冒烟。
//
// 用法：
//   node scripts/deploy.mjs                       # 默认项目 travel-world
//   node scripts/deploy.mjs travel-world          # 指定项目
//   node scripts/deploy.mjs travel-world --wait 180 --smoke
//   node scripts/deploy.mjs travel-world --hook https://api.render.com/deploy/srv-...
//   node scripts/deploy.mjs --list
//
// hook（部署触发地址）的四种来源，按优先级：
//   --hook 参数 > 环境变量 <hookEnv> > deploy.hooks.json > 环境变量 DEPLOY_HOOK
// deploy.hooks.json 已在 .gitignore 里，不会被提交。
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'deploy.config.json');
const HOOKS_PATH = path.join(ROOT, 'deploy.hooks.json');

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

async function trigger(hook) {
  // Render 的 Deploy Hook 同时接受 GET 和 POST，先 POST，405 再退回 GET。
  let response = await fetch(hook, { method: 'POST' });
  if (response.status === 405 || response.status === 404) {
    response = await fetch(hook, { method: 'GET' });
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
      console.log(`  - ${name.padEnd(16)} ${project.site || '(未配置 site)'}  hook: ${hook ? '已配置' : '缺失'}`);
    }
    console.log('\n加项目：在 deploy.config.json 里加一条，再把 hook 写进 deploy.hooks.json。');
    return 0;
  }

  const name = options.project || names[0];
  const project = projects[name];
  if (!project) {
    console.error(`没有项目 ${name}。已有：${names.join(', ') || '(空)'}`);
    return 1;
  }

  const resolved = resolveHook(name, project, options.hook);
  if (!resolved) {
    console.error(
      [
        `项目 ${name} 还没有部署 hook，所以发不出去。`,
        '',
        '获取方式（Render 面板）：travel-world → Settings → Deploy Hook → 复制那条',
        'https://api.render.com/deploy/srv-… 的地址，然后任选一种存法：',
        `  1. 写进 deploy.hooks.json：{ "${name}": "https://api.render.com/deploy/srv-…" }`,
        `  2. 设环境变量：set ${project.hookEnv || 'DEPLOY_HOOK'}=https://api.render.com/deploy/srv-…`,
        `  3. 临时用：node scripts/deploy.mjs ${name} --hook "https://api.render.com/deploy/srv-…"`,
      ].join('\n'),
    );
    return 2;
  }

  console.log(`触发上线：${name}`);
  console.log(`  站点：${project.site || '(未配置)'}`);
  console.log(`  hook：来自${resolved.from}`);
  const result = await trigger(resolved.hook);
  if (!result.ok) {
    console.error(`  触发失败：HTTP ${result.status} ${result.body}`);
    return 1;
  }
  console.log(`  已触发：HTTP ${result.status}${result.body ? ` · ${result.body}` : ''}`);

  if (options.wait > 0) {
    console.log(`\n等 ${options.wait} 秒让新版本起来…`);
    await sleep(options.wait * 1000);
  }

  if (options.wait > 0 || options.smoke) {
    const health = await waitForHealth(project.site, project.health, Math.max(options.wait, 60));
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
