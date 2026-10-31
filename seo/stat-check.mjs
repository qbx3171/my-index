#!/usr/bin/env node
/* 访问统计通道自检
   用法：node seo/stat-check.mjs
   作用：判断页脚计数当前走的是「自家 Supabase」还是「abacus 兜底」，
        并打印两边的当前值。只读，不会写计数。 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const URL_ = html.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
const KEY = html.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
const NS = "lezhesoft-main";
const ABACUS = "https://abacus.jasoncameron.dev";

async function j(url, opt, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text()).slice(0, 160) };
    return { ok: true, data: await r.json().catch(() => null) };
  } catch (e) {
    return { ok: false, status: 0, body: e.message };
  } finally {
    clearTimeout(t);
  }
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const rpc = (fn, key) =>
  j(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify({ p_key: key }) });

const own = await rpc("site_get", "site_pv");
const enabled = own.ok;
console.log(`自家通道（Supabase site_get）：${enabled ? "✅ 已启用" : "❌ 未启用"}`);
if (!enabled) {
  console.log(`  原因：HTTP ${own.status} ${String(own.body || "").replace(/\s+/g, " ").slice(0, 120)}`);
  console.log("  处理：在 Supabase SQL Editor 执行 seo/site-stats.sql（只需一次）");
}

const rows = [];
if (enabled) {
  for (const k of ["site_pv", "site_uv"]) {
    const r = await rpc("site_get", k);
    rows.push([k, r.ok ? String(r.data) : "err"]);
  }
  const d = new Date();
  const dayKey = `day-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rd = await rpc("site_get", dayKey);
  rows.push([dayKey, rd.ok ? String(rd.data) : "err"]);
  console.log("\n自家计数器当前值：");
  rows.forEach(([k, v]) => console.log(`  ${k.padEnd(14)} ${v}`));
}

const ab = await j(`${ABACUS}/get/${NS}/site_pv`);
console.log(`\nabacus 兜底值：site_pv = ${ab.ok ? JSON.stringify(ab.data) : `不可用(${ab.status})`}`);
console.log(`\n当前线上实际来源：${enabled ? "自家 Supabase（零第三方）" : "abacus（第三方兜底）"}`);
process.exit(0);
