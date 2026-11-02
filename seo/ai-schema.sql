-- AI 工具集板块建表脚本（在 Supabase Dashboard → SQL Editor 中执行一次）
-- 结构：ai_collections（工具集）1 ←→ N ai_tools（集内工具）
-- 权限：游客只读已发布；登录用户（后台 ai-admin.html）可增删改

create table if not exists ai_collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- 页面文件名（英文/拼音），如 ai-huihua
  name        text not null,                 -- 工具集名称，如「AI 绘画工具集」
  description text default '',               -- 一句话介绍（会作为页面导语和 meta description）
  icon        text default '🧩',             -- emoji 图标
  logo        text default '',               -- 封面图 URL（选填，卡片/侧栏展示；留空自动用 emoji）
  sort        int default 0,                 -- 排序，小的在前
  is_published boolean default true,         -- 下架开关
  created_at  timestamptz default now()
);

create table if not exists ai_tools (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references ai_collections(id) on delete cascade,
  name          text not null,               -- 工具名
  url           text not null,               -- 官网地址
  slug          text default '',             -- 详情页标识（选填，英文/数字/横线；留空自动用 id）
  intro         text default '',             -- 详细介绍（空行分段，详情页展示）
  screenshots   text default '',             -- 封面截图 URL，多张换行分隔
  summary       text default '',             -- 一句话简介（卡片展示）
  tags          text default '',             -- 逗号分隔标签，如「图像生成,中文」
  pricing       text default '免费',          -- 免费 / 免费额度 / 订阅 / 买断
  icon          text default '🤖',           -- emoji 图标（无封面图时备用）
  logo          text default '',             -- 封面图 URL（选填；留空自动生成渐变字母封面）
  sort          int default 0,
  is_published  boolean default true,
  created_at    timestamptz default now()
);

create index if not exists ai_tools_collection_idx on ai_tools(collection_id);

alter table ai_collections enable row level security;
alter table ai_tools enable row level security;

-- 游客：只能读已发布（静态生成器用 anon key 拉数据）
create policy "ai_collections_public_read" on ai_collections
  for select using (is_published = true);
create policy "ai_tools_public_read" on ai_tools
  for select using (is_published = true);

-- 登录用户：全部权限（后台管理用）
create policy "ai_collections_admin_all" on ai_collections
  for all to authenticated using (true) with check (true);
create policy "ai_tools_admin_all" on ai_tools
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 升级（2026-11-02 新增封面字段）——已建过表的只需执行下面两行：
-- ============================================================
alter table ai_collections add column if not exists logo text default '';
alter table ai_tools       add column if not exists logo text default '';
alter table ai_tools       add column if not exists slug  text default '';
alter table ai_tools       add column if not exists intro text default '';
alter table ai_tools       add column if not exists screenshots text default '';
