// GitHub Git Data API 推送：本地 git push 被代理封锁(502)时的替代通道。
// 用法：GH_TOKEN=$(git credential fill 提取) node seo/api-push.mjs "commit message"
// 流程：取远程 main ref → 以远程 HEAD 为 base_tree → 批量建 blob → 建 tree → 建 commit → 更新 ref
// 文件清单来自 git status --porcelain（含新增/修改/删除），删除的路径以 sha:null 标记。
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = "qbx3171/my-index";
const BRANCH = "main";
const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]):/, "$1:");

const token = process.env.GH_TOKEN;
if (!token) {
  console.error("缺少 GH_TOKEN 环境变量");
  process.exit(1);
}
const msg = process.argv[2] || "site update";
const H = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "lezhesoft-publisher",
};
async function api(path, body, method = "GET") {
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: H,
    method: body ? (method === "GET" ? "POST" : method) : method,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method || "GET"} ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// 1. 解析 git status 清单
const raw = execSync("git status --porcelain -uall", { cwd: ROOT, encoding: "utf8" });
const items = [];
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  const st = line.slice(0, 2);
  let path = line.slice(3).trim();
  if (path.includes(" -> ")) path = path.split(" -> ")[1]; // 重命名取新路径
  path = path.replace(/^"|"$/g, "");
  if (path.startsWith(".workbuddy/")) continue; // 会话数据不上线
  items.push({ st: st.trim(), path });
}
if (!items.length) {
  console.log("无待推送文件");
  process.exit(0);
}
console.log(`待推送 ${items.length} 个文件（删除 ${items.filter((i) => i.st === "D").length} 个）`);

// 2. 取远程分支头与 base tree（recursive 拿全量路径清单，用于判断删除项是否真的存在于远程）
const ref = await api(`git/ref/heads/${BRANCH}`);
const baseCommit = await api(`git/commits/${ref.object.sha}`);
const baseTreeFull = await api(`git/trees/${baseCommit.tree.sha}?recursive=1`);
const remotePaths = new Set(baseTreeFull.tree.filter((e) => e.type === "blob").map((e) => e.path));
console.log(`远程 HEAD: ${ref.object.sha.slice(0, 7)} ${baseCommit.message.slice(0, 40)}（远程文件 ${remotePaths.size}）`);

// 2.5 内容级去重：本地索引长期落后远程，status 清单远大于真实变更。
// 计算本地文件 git blob sha（sha1("blob <size>\\0" + content)），与远程 blob sha 相同的跳过，
// 使定时任务重复调用时只推送真正变更的文件。
const crypto = await import("node:crypto");
const remoteSha = new Map(baseTreeFull.tree.filter((e) => e.type === "blob").map((e) => [e.path, e.sha]));
const localSha = (p) => {
  const buf = readFileSync(join(ROOT, p));
  return crypto.createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
};
const skipped = [];
const realItems = [];
let wfSkipped = [];
for (const it of items) {
  if (it.st === "D") { realItems.push(it); continue; }
  // GitHub 限制：工作流文件不能经 Git Data API 修改（base_tree 404）。令牌无 workflow
  // 写权限时 Contents API 同样 404——跳过并警告，避免整个推送失败。
  if (it.path.startsWith(".github/workflows/")) { wfSkipped.push(it.path); continue; }
  let ls;
  try { ls = localSha(it.path); } catch { continue; } // 文件已被删除/不可读，跳过
  if (remoteSha.get(it.path) === ls) { skipped.push(it.path); continue; }
  realItems.push(it);
}
if (wfSkipped.length) console.log(`⚠ 跳过工作流文件（需有 workflow 权限的令牌另行处理）: ${wfSkipped.join(", ")}`);
if (skipped.length) console.log(`内容未变跳过 ${skipped.length} 个`);
if (!realItems.length) {
  console.log("✅ 与远程完全一致，无需推送");
  process.exit(0);
}
console.log(`真实变更 ${realItems.length} 个文件（删除 ${realItems.filter((i) => i.st === "D").length} 个）`);

// 3. 批量建 blob（本地 HEAD 落后于远程时，status 里的 D 可能远程已删，跳过不存在的删除项）
const tree = [];
for (const it of realItems) {
  if (it.st === "D") {
    if (remotePaths.has(it.path)) tree.push({ path: it.path, mode: "100644", type: "blob", sha: null });
    continue;
  }
  const content = readFileSync(join(ROOT, it.path));
  const blob = await api(
    "git/blobs",
    { content: content.toString("base64"), encoding: "base64" },
    "POST"
  );
  tree.push({ path: it.path, mode: "100644", type: "blob", sha: blob.sha });
  process.stdout.write(`  blob ${it.path}\n`);
}
if (!tree.length) {
  console.log("✅ 过滤后无实际变更（删除项远程均已不存在），无需推送");
  process.exit(0);
}

// 4. 建 tree → commit → 更新 ref
const newTree = await api("git/trees", { base_tree: baseCommit.tree.sha, tree }, "POST");
const commit = await api(
  "git/commits",
  { message: msg, tree: newTree.sha, parents: [ref.object.sha] },
  "POST"
);
await api(`git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false }, "PATCH");
console.log(`✅ 已提交并推送: ${commit.sha.slice(0, 7)}（${realItems.length} 个文件）`);
