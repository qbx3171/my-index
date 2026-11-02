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

// 3. 批量建 blob（本地 HEAD 落后于远程时，status 里的 D 可能远程已删，跳过不存在的删除项）
const tree = [];
for (const it of items) {
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

// 4. 建 tree → commit → 更新 ref
const newTree = await api("git/trees", { base_tree: baseCommit.tree.sha, tree }, "POST");
const commit = await api(
  "git/commits",
  { message: msg, tree: newTree.sha, parents: [ref.object.sha] },
  "POST"
);
await api(`git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false }, "PATCH");
console.log(`✅ 已提交并推送: ${commit.sha.slice(0, 7)}（${items.length} 个文件）`);
