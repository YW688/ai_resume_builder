#!/usr/bin/env node
/**
 * 启动 cloudflared quick tunnel（指向本地 3000）并自动把新域名注册到
 * Neon Auth 的 Trusted domains，最后打印可用 URL。
 *
 * 背景：
 * - `cloudflared tunnel --url ...` 每次重启都会生成新的 *.trycloudflare.com 域名；
 * - Neon Auth（Better Auth）只接受 Trusted domains 白名单内的 Origin，
 *   否则登录时返回 403 INVALID_ORIGIN，表现为「登录失败，请稍后重试」，
 *   隧道能打开首页但登录后进不了 /dashboard；
 * - 旧域名在 cloudflared 断线后 Cloudflare 会返回 530，需要重新拉起并换新域名。
 *
 * 用法：
 *   npm run tunnel                 # 起隧道 + 注册域名
 *   npm run tunnel -- --keep-old   # 保留历史 *.trycloudflare.com 白名单记录
 *   TUNNEL_URL=http://localhost:3100 npm run tunnel   # 指向其它端口
 *
 * 依赖：cloudflared 可执行文件（默认找 PATH，找不到时回退到 Program Files）。
 * 只使用 Node 内置模块，不新增依赖。
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const ENV_FILE = path.join(ROOT, ".env.local");
const TARGET = process.env.TUNNEL_URL || "http://localhost:3000";
const KEEP_OLD = process.argv.includes("--keep-old");
const CLOUDFLARED = process.env.CLOUDFLARED_PATH ||
  "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const DOMAIN_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

function log(message) {
  console.log(`[tunnel] ${message}`);
}

async function neonAuth(pathname, init = {}) {
  const env = readEnv(ENV_FILE);
  const { NEON_API_KEY, NEON_PROJECT_ID, NEON_BRANCH_ID } = env;
  if (!NEON_API_KEY || !NEON_PROJECT_ID || !NEON_BRANCH_ID) {
    throw new Error("缺少 NEON_API_KEY / NEON_PROJECT_ID / NEON_BRANCH_ID（.env.local）");
  }
  const url =
    `https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}` +
    `/branches/${NEON_BRANCH_ID}/auth/domains${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${NEON_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  return { status: res.status, json, text };
}

async function addTrustedDomain(domain) {
  const res = await neonAuth("", {
    method: "POST",
    body: JSON.stringify({ domain, auth_provider: "better_auth" }),
  });
  if (res.status === 201 || res.status === 200) return "added";
  // 已存在时不同版本可能返回 4xx，重复添加视为成功
  const msg = `${res.json?.message ?? res.text}`;
  if (/already|exist|duplicate/i.test(msg)) return "exists";
  throw new Error(`注册可信域名失败（${res.status}）：${msg.slice(0, 200)}`);
}

async function pruneOldTunnels(keep) {
  const res = await neonAuth("");
  if (res.status !== 200 || !res.json?.domains) {
    log(`跳过清理：读取白名单失败（${res.status}）`);
    return;
  }
  const stale = res.json.domains
    .map((item) => item.domain)
    .filter((d) => d.includes(".trycloudflare.com") && d !== keep && new URL(d).hostname !== new URL(keep).hostname);
  for (const domain of stale) {
    const del = await neonAuth("", {
      method: "DELETE",
      body: JSON.stringify({
        domains: [{ domain }],
        auth_provider: "better_auth",
      }),
    });
    log(`清理旧隧道域名 ${domain} → ${del.status}`);
  }
}

function findCloudflared() {
  const candidates = [CLOUDFLARED, "cloudflared"];
  for (const candidate of candidates) {
    if (candidate === "cloudflared") return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return "cloudflared";
}

async function main() {
  const bin = findCloudflared();
  log(`cloudflared: ${bin}`);
  log(`origin: ${TARGET}`);

  const child = spawn(
    bin,
    ["tunnel", "--url", TARGET, "--no-autoupdate"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  let ready = false;
  const onData = (buf) => {
    const text = buf.toString();
    process.stderr.write(text);
    const match = text.match(DOMAIN_RE);
    if (match && !ready) {
      ready = true;
      const url = match[0];
      (async () => {
        log(`新隧道地址：${url}`);
        try {
          const result = await addTrustedDomain(url);
          log(`Neon Auth 可信域名：${result}`);
          if (!KEEP_OLD) await pruneOldTunnels(url);
          log("---------------------------------------------");
          log(`可以打开：${url}`);
          log("---------------------------------------------");
        } catch (error) {
          log(`警告：${error.message}`);
          log(`请手动把 ${url} 加到 Neon Auth → Trusted domains，否则登录会失败。`);
        }
      })();
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  child.on("exit", (code) => {
    log(`cloudflared 已退出（code=${code}），若已是 530 请重新运行 npm run tunnel`);
    process.exit(code ?? 0);
  });

  const stop = (signal) => {
    log(`收到 ${signal}，正在停止隧道…`);
    child.kill();
    setTimeout(() => process.exit(0), 500);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
}

main().catch((error) => {
  console.error(`[tunnel] 失败：${error.message}`);
  process.exit(1);
});
